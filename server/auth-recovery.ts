import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { normalizeEmail, isAdmitted } from './admission.js';
import { identifier } from './database-privileges.js';

interface Target { database: string; schema: string }
interface Mapping {
  accountId: string; expectedSubject: string; authSubject: string; email: string;
  duplicateAccountId?: string;
}
interface Summary { name: string; department: string | null; role: string | null; membershipState: string; focusCount: number }
interface RecoveryPlan { kind: 'auth-recovery'; version: 1; target: Target; mapping: Mapping; summary: Summary; candidateVerifiedAt?: string }
interface SessionPlan { kind: 'auth-session-cutover'; version: 1; target: Target; snapshot: string; count: number }
const refused = 'Auth recovery refused. Verify the private plan, trusted identity mapping, account bindings and absence of duplicate history.';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(refused);
}
function mappingInput(value: unknown): Mapping {
  object(value, ['accountId', 'expectedSubject', 'authSubject', 'email', 'duplicateAccountId']);
  if (typeof value.accountId !== 'string' || !uuid.test(value.accountId) ||
    typeof value.expectedSubject !== 'string' || !value.expectedSubject || value.expectedSubject.length > 512 || /\s/.test(value.expectedSubject) ||
    typeof value.authSubject !== 'string' || !value.authSubject || value.authSubject.length > 255 || /\s/.test(value.authSubject) || value.authSubject.startsWith('jesusfilm:') ||
    typeof value.email !== 'string' ||
    (value.duplicateAccountId !== undefined && (typeof value.duplicateAccountId !== 'string' || !uuid.test(value.duplicateAccountId) || value.duplicateAccountId === value.accountId))) throw new Error(refused);
  return { accountId: value.accountId, expectedSubject: value.expectedSubject, authSubject: value.authSubject,
    email: normalizeEmail(value.email), ...(value.duplicateAccountId ? { duplicateAccountId: value.duplicateAccountId as string } : {}) };
}
async function transaction<T>(db: Pool, readonly: boolean, work: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();
  try {
    await client.query(readonly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    if (!readonly) await client.query('SELECT pg_advisory_xact_lock(603106)');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch {
    await client.query('ROLLBACK');
    throw new Error(refused);
  } finally { client.release(); }
}
async function target(client: PoolClient): Promise<Target> {
  return (await client.query('SELECT current_database() AS database, current_schema() AS schema')).rows[0];
}
async function matchTarget(client: PoolClient, expected: unknown) {
  object(expected, ['database', 'schema']);
  const current = await target(client);
  if (current.database !== expected.database || current.schema !== expected.schema) throw new Error(refused);
}
async function requireEmptyDuplicate(client: PoolClient, id: string) {
  // Inspect every FK, including historical authors/readers and future tables.
  // Unexpected or inaccessible dependencies fail closed; no cascading deletion.
  const references = await client.query(`SELECT n.nspname AS schema,c.relname AS table,a.attname AS column,
    cardinality(f.conkey) AS columns,referenced.attname AS referenced_column
    FROM pg_constraint f JOIN pg_class c ON c.oid=f.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=f.conkey[1]
    JOIN pg_attribute referenced ON referenced.attrelid=f.confrelid AND referenced.attnum=f.confkey[1]
    WHERE f.contype='f' AND f.confrelid='users'::regclass`);
  const current = await target(client);
  for (const reference of references.rows) {
    // Only single-column references to the account UUID are supported. Never
    // compare a different referenced key (such as google_sub) with a UUID.
    if (reference.columns !== 1 || reference.referenced_column !== 'id') throw new Error(refused);
    if (reference.schema === current.schema && reference.table === 'sessions' && reference.column === 'user_id') continue;
    const present = await client.query(`SELECT 1 FROM ${identifier(reference.schema)}.${identifier(reference.table)} WHERE ${identifier(reference.column)}=$1 LIMIT 1`, [id]);
    if (present.rowCount) throw new Error(refused);
  }
}
async function inspect(client: PoolClient, mapping: Mapping, lock: boolean) {
  const principal = `jesusfilm:${mapping.authSubject}`;
  const result = await client.query(`SELECT id,google_sub,email FROM users
    WHERE id=$1 OR google_sub=$2 OR lower(btrim(email))=$3 OR id=$4 ORDER BY id${lock ? ' FOR UPDATE' : ''}`,
  [mapping.accountId, principal, mapping.email, mapping.duplicateAccountId ?? null]);
  const original = result.rows.find(row => row.id === mapping.accountId);
  const duplicate = result.rows.find(row => row.id === mapping.duplicateAccountId);
  if (!original || normalizeEmail(original.email) !== mapping.email || !await isAdmitted(client, mapping)) throw new Error(refused);
  if (result.rows.some(row => row.id !== mapping.accountId && row.id !== mapping.duplicateAccountId)) throw new Error(refused);
  if ((await client.query(`SELECT 1 FROM auth_identity_candidates
    WHERE email=$1 AND subject<>$2 AND verified_at>now()-interval '1 day' LIMIT 1`, [mapping.email, principal])).rowCount) throw new Error(refused);
  if (original.google_sub === principal && !duplicate) return { principal, alreadyApplied: true };
  if (original.google_sub !== mapping.expectedSubject || original.google_sub.startsWith('jesusfilm:')) throw new Error(refused);
  if (mapping.duplicateAccountId) {
    if (!duplicate || duplicate.google_sub !== principal || normalizeEmail(duplicate.email) !== mapping.email) throw new Error(refused);
    await requireEmptyDuplicate(client, duplicate.id);
  }
  return { principal, alreadyApplied: false };
}
async function summary(client: PoolClient, id: string): Promise<Summary> {
  return (await client.query(`SELECT u.name,d.name AS department,m.role,
    CASE WHEN m.user_id IS NULL THEN 'none' WHEN m.deleted_at IS NOT NULL OR d.deleted_at IS NOT NULL THEN 'former' ELSE 'active' END AS "membershipState",
    (SELECT count(*)::integer FROM position_focuses WHERE user_id=u.id) AS "focusCount"
    FROM users u LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN departments d ON d.id=m.department_id WHERE u.id=$1`, [id])).rows[0];
}
async function preparePlan(client: PoolClient, mapping: Mapping): Promise<RecoveryPlan> {
  await inspect(client, mapping, false);
  return { kind: 'auth-recovery', version: 1, target: await target(client), mapping, summary: await summary(client, mapping.accountId) };
}

/** Mapping provenance is verified by the operator using trusted Auth records. */
export async function planAuthRecovery(db: Pool, input: unknown): Promise<RecoveryPlan> {
  const mapping = mappingInput(input);
  return transaction(db, true, client => preparePlan(client, mapping));
}

/** Email locates a reviewable plan; only an explicit administrative apply grants continuity. */
export async function planAuthRecoveryByEmail(db: Pool, emailInput: string): Promise<RecoveryPlan> {
  const email = normalizeEmail(emailInput);
  return transaction(db, true, async client => {
    const users = (await client.query('SELECT id,google_sub FROM users WHERE lower(btrim(email))=$1 ORDER BY id', [email])).rows;
    const legacy = users.filter(user => !user.google_sub.startsWith('jesusfilm:'));
    const registered = users.filter(user => user.google_sub.startsWith('jesusfilm:'));
    const candidates = (await client.query("SELECT subject,verified_at FROM auth_identity_candidates WHERE email=$1 AND verified_at>now()-interval '1 day'", [email])).rows;
    const subjects = new Set<string>([...registered.map(user => user.google_sub), ...candidates.map(candidate => candidate.subject)]);
    if (subjects.size !== 1 || legacy.length > 1 || registered.length > 1 || !users.length) throw new Error(refused);
    const principal = [...subjects][0]!;
    const original = legacy[0] ?? registered[0]!;
    const duplicate = legacy.length ? registered[0] : undefined;
    const mapping = mappingInput({ accountId: original.id, expectedSubject: original.google_sub,
      authSubject: principal.slice('jesusfilm:'.length), email, ...(duplicate ? { duplicateAccountId: duplicate.id } : {}) });
    const plan = await preparePlan(client, mapping);
    if (!registered.length) plan.candidateVerifiedAt = new Date(candidates[0]!.verified_at).toISOString();
    return plan;
  });
}
export async function applyAuthRecovery(db: Pool, input: unknown) {
  object(input, ['kind', 'version', 'target', 'mapping', 'summary', 'candidateVerifiedAt']);
  if (input.kind !== 'auth-recovery' || input.version !== 1) throw new Error(refused);
  const mapping = mappingInput(input.mapping);
  return transaction(db, false, async client => {
    await matchTarget(client, input.target);
    const { principal, alreadyApplied } = await inspect(client, mapping, true);
    if (alreadyApplied) return;
    object(input.summary, ['name', 'department', 'role', 'membershipState', 'focusCount']);
    const current = await summary(client, mapping.accountId);
    if (Object.entries(current).some(([key, value]) => (input.summary as Record<string, unknown>)[key] !== value)) throw new Error(refused);
    if (input.candidateVerifiedAt !== undefined) {
      const candidate = (await client.query("SELECT verified_at FROM auth_identity_candidates WHERE subject=$1 AND email=$2 AND verified_at>now()-interval '1 day'", [principal, mapping.email])).rows[0];
      if (!candidate || new Date(candidate.verified_at).toISOString() !== input.candidateVerifiedAt) throw new Error(refused);
    }
    const ids = [mapping.accountId, ...(mapping.duplicateAccountId ? [mapping.duplicateAccountId] : [])];
    await client.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])', [ids]);
    if (mapping.duplicateAccountId) await client.query('DELETE FROM users WHERE id=$1', [mapping.duplicateAccountId]);
    await client.query('UPDATE users SET google_sub=$1 WHERE id=$2', [principal, mapping.accountId]);
    await client.query('DELETE FROM auth_identity_candidates WHERE subject=$1', [principal]);
  });
}
async function sessionSnapshot(client: PoolClient) {
  const rows = (await client.query('SELECT token_hash,user_id,expires_at FROM sessions ORDER BY token_hash')).rows;
  return { snapshot: createHash('sha256').update(JSON.stringify(rows)).digest('hex'), count: rows.length };
}
export async function planAuthSessionCutover(db: Pool): Promise<SessionPlan> {
  return transaction(db, true, async client => ({ kind: 'auth-session-cutover', version: 1, target: await target(client), ...await sessionSnapshot(client) }));
}
export async function applyAuthSessionCutover(db: Pool, input: unknown) {
  object(input, ['kind', 'version', 'target', 'snapshot', 'count']);
  if (input.kind !== 'auth-session-cutover' || input.version !== 1 || typeof input.snapshot !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.snapshot) || !Number.isSafeInteger(input.count) || (input.count as number) < 0) throw new Error(refused);
  return transaction(db, false, async client => {
    await matchTarget(client, input.target);
    // Exclude concurrent session issuance/deletion while revalidating the plan.
    await client.query('LOCK TABLE sessions IN SHARE ROW EXCLUSIVE MODE');
    const current = await sessionSnapshot(client);
    if (!current.count) return;
    if (current.snapshot !== input.snapshot || current.count !== input.count) throw new Error(refused);
    await client.query('DELETE FROM sessions');
  });
}
