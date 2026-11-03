import type { Pool, PoolClient } from 'pg';
import { normalizeEmail } from './admission.js';
import { AccessError } from './membership.js';

export function parseAiMemberManagers(value?: string): ReadonlySet<string> {
  try {
    const entries = (value ?? '').split(/[,\n]/).map(s => s.trim()).filter(Boolean).map(normalizeEmail);
    for (const email of entries) {
      const [local, domain] = email.split('@') as [string, string];
      if (email.length > 254 || local.length > 64 || domain.split('.').some(label => label.length > 63)
        || !/^[a-z0-9!#$%&'+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'+/=?^_`{|}~-]+)*$/.test(local)) throw new Error('Invalid address.');
    }
    return new Set(entries);
  } catch { throw new Error('AI_MEMBER_MANAGER_EMAILS must contain exact valid email addresses.'); }
}
export async function aiMemberEligible(db: Pool | PoolClient, id: string, emails: ReadonlySet<string>): Promise<boolean> {
  if (!emails.size) return false;
  const result = await db.query(`SELECT lower(btrim(u.email)) AS email FROM users u
    JOIN approved_emails a ON a.email=lower(btrim(u.email))
    JOIN memberships m ON m.user_id=u.id AND m.deleted_at IS NULL
    JOIN departments d ON d.id=m.department_id AND d.deleted_at IS NULL WHERE u.id=$1`, [id]);
  return !!result.rows[0] && emails.has(result.rows[0].email);
}
export async function requireAiMemberOwner(db: Pool | PoolClient, id: string, emails: ReadonlySet<string>) {
  if (!await aiMemberEligible(db, id, emails)) throw new AccessError(403, 'AI member management is unavailable.');
}
