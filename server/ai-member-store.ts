import { randomUUID, randomBytes, createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { AiMemberDetail, AiMemberProfile, AiMemberFocusContent, AiMemberToken, AiMemberFocusResponse } from '../shared/ai-members.js';
import { AccessError } from './membership.js';
import { aiMemberEligible, requireAiMemberOwner } from './ai-member-eligibility.js';

const profileColumns = `id,name,purpose,profile_revision AS "profileRevision",created_at AS "createdAt",updated_at AS "updatedAt",
  last_retrieved_at AS "lastRetrievedAt",last_retrieved_version AS "lastRetrievedVersion"`;
const tokenColumns = `id,name,suffix,credential_revision AS "credentialRevision",created_at AS "createdAt",rotated_at AS "rotatedAt"`;
export const tokenVerifier = (secret: string) => createHash('sha256').update(secret).digest('hex');
const credential = () => { const secret = 'lam_' + randomBytes(32).toString('base64url'); return { secret, verifier: tokenVerifier(secret), suffix: secret.slice(-6) }; };
export async function aiMemberTransaction<T>(db: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export function aiMemberStore(db: Pool, emails: ReadonlySet<string>) {
  async function owned(client: Pool | PoolClient, owner: string, id: string, lock = false): Promise<AiMemberProfile> {
    await requireAiMemberOwner(client, owner, emails);
    const result = await client.query(`SELECT ${profileColumns} FROM ai_members WHERE id::text=$1 AND owner_user_id=$2 ${lock ? 'FOR UPDATE' : ''}`, [id, owner]);
    if (!result.rowCount) throw new AccessError(404, 'AI member not found.');
    return result.rows[0];
  }
  async function detail(client: Pool | PoolClient, owner: string, id: string): Promise<AiMemberDetail> {
    const member = await owned(client, owner, id);
    const focus = (await client.query('SELECT objective,goals,version,updated_at AS "updatedAt" FROM ai_member_focuses WHERE ai_member_id=$1', [id])).rows[0] ?? null;
    const tokens = (await client.query(`SELECT ${tokenColumns} FROM ai_member_tokens WHERE ai_member_id=$1 ORDER BY created_at,id`, [id])).rows;
    return { ...member, focus, tokens };
  }
  return {
    async list(owner: string): Promise<AiMemberProfile[]> {
      await requireAiMemberOwner(db, owner, emails);
      return (await db.query(`SELECT ${profileColumns} FROM ai_members WHERE owner_user_id=$1 ORDER BY created_at,id`, [owner])).rows;
    },
    async get(owner: string, id: string) { return aiMemberTransaction(db, async c => { await owned(c, owner, id, true); return detail(c, owner, id); }); },
    async create(owner: string, profile: { name: string; purpose: string }) {
      return aiMemberTransaction(db, async c => {
        await requireAiMemberOwner(c, owner, emails);
        const id = randomUUID();
        await c.query('INSERT INTO ai_members(id,owner_user_id,name,purpose) VALUES($1,$2,$3,$4)', [id, owner, profile.name, profile.purpose]);
        return detail(c, owner, id);
      });
    },
    async edit(owner: string, id: string, profile: { name: string; purpose: string }, revision: number) {
      return aiMemberTransaction(db, async c => {
        const member = await owned(c, owner, id, true);
        if (member.profileRevision !== revision) throw new AccessError(409, 'This profile changed. Your pending edits are retained; reopen Manage to load the current profile.');
        await c.query('UPDATE ai_members SET name=$2,purpose=$3,profile_revision=profile_revision+1,updated_at=now() WHERE id=$1', [id, profile.name, profile.purpose]);
        return detail(c, owner, id);
      });
    },
    async saveFocus(owner: string, id: string, content: AiMemberFocusContent, version: number) {
      return aiMemberTransaction(db, async c => {
        await owned(c, owner, id, true);
        const current = await detail(c, owner, id);
        if ((current.focus?.version ?? 0) !== version) throw new AccessError(409, 'This focus changed. Your pending edits are retained; reopen Position focus to load the current version.');
        if (!current.focus) {
          await c.query('INSERT INTO ai_member_focuses(ai_member_id,objective,goals,version) VALUES($1,$2,$3,1)', [id, content.objective, JSON.stringify(content.goals)]);
        } else if (current.focus.objective !== content.objective || JSON.stringify(current.focus.goals) !== JSON.stringify(content.goals)) {
          await c.query('UPDATE ai_member_focuses SET objective=$2,goals=$3,version=version+1,updated_at=now() WHERE ai_member_id=$1', [id, content.objective, JSON.stringify(content.goals)]);
        }
        return detail(c, owner, id);
      });
    },
    async issue(owner: string, id: string, name: string) {
      return aiMemberTransaction(db, async c => {
        await owned(c, owner, id, true);
        const value = credential();
        const token: AiMemberToken = (await c.query(`INSERT INTO ai_member_tokens(id,ai_member_id,name,verifier_hash,suffix) VALUES($1,$2,$3,$4,$5) RETURNING ${tokenColumns}`, [randomUUID(), id, name, value.verifier, value.suffix])).rows[0];
        return { token, secret: value.secret };
      });
    },
    async tokenAction(owner: string, id: string, tokenId: string, revision: number, rotate: boolean) {
      return aiMemberTransaction(db, async c => {
        await owned(c, owner, id, true);
        const current = (await c.query('SELECT credential_revision AS revision FROM ai_member_tokens WHERE id::text=$1 AND ai_member_id=$2', [tokenId, id])).rows[0];
        if (!current) throw new AccessError(404, 'Token not found.');
        if (current.revision !== revision) throw new AccessError(409, 'This token changed. Reopen Manage before trying again.');
        if (!rotate) { await c.query('DELETE FROM ai_member_tokens WHERE id=$1', [tokenId]); return; }
        const value = credential();
        const token: AiMemberToken = (await c.query(`UPDATE ai_member_tokens SET verifier_hash=$2,suffix=$3,credential_revision=credential_revision+1,rotated_at=now() WHERE id=$1 RETURNING ${tokenColumns}`, [tokenId, value.verifier, value.suffix])).rows[0];
        return { token, secret: value.secret };
      });
    },
    async retrieve(secret: string): Promise<AiMemberFocusResponse> {
      return aiMemberTransaction(db, async c => {
        const verifier = tokenVerifier(secret);
        // The initial lookup is a hint only. Lock the member first, then recheck
        // the credential. Every mutation uses this same member -> child order.
        const hint = (await c.query('SELECT ai_member_id FROM ai_member_tokens WHERE verifier_hash=$1', [verifier])).rows[0];
        const denied = () => new AccessError(401, 'Invalid credentials.');
        if (!hint) throw denied();
        const member = (await c.query('SELECT id,name,owner_user_id FROM ai_members WHERE id=$1 FOR UPDATE', [hint.ai_member_id])).rows[0];
        if (!member || !await aiMemberEligible(c, member.owner_user_id, emails)) throw denied();
        if (!(await c.query('SELECT id FROM ai_member_tokens WHERE ai_member_id=$1 AND verifier_hash=$2', [member.id, verifier])).rowCount) throw denied();
        const focus = (await c.query('SELECT objective,goals,version,updated_at AS "updatedAt" FROM ai_member_focuses WHERE ai_member_id=$1', [member.id])).rows[0];
        if (!focus) throw new AccessError(404, 'Position focus is not configured.');
        await c.query('UPDATE ai_members SET last_retrieved_at=clock_timestamp(),last_retrieved_version=$2 WHERE id=$1', [member.id, focus.version]);
        return { member: { id: member.id, name: member.name }, focus };
      });
    },
    async remove(owner: string, id: string) {
      await aiMemberTransaction(db, async c => {
        await owned(c, owner, id, true);
        await c.query('DELETE FROM ai_members WHERE id=$1', [id]);
      });
    },
  };
}
