import type { Pool, PoolClient } from 'pg';
import { identifier, type DatabaseRoles } from './database-privileges.js';

const columns = {
  allowed_domains:['domain'], approved_emails:['email'], departments:['id','name','deleted_at'],
  login_attempts:['state_hash','nonce','verifier','expires_at'],
  memberships:['user_id','department_id','role','deleted_at'],
  position_focuses:['id','user_id','department_id','title','period_start','period_end','sections','version','updated_at'],
  schema_migrations:['version','applied_at'], sessions:['token_hash','user_id','expires_at'],
  users:['id','google_sub','email','name','hosted_domain'],
};
export const legacyTables = Object.keys(columns).sort() as (keyof typeof columns)[];
export type LegacyCounts = Record<keyof typeof columns, number>;
export interface LegacyTarget extends DatabaseRoles {
  expectedDatabase: string; sourceSchema: string; schema: string; sourceOwner: string;
}
function validate(target: LegacyTarget) {
  for (const value of Object.values(target)) identifier(value);
  if (target.sourceSchema !== 'public' || target.schema === 'public' || target.schema.startsWith('pg_')
    || new Set([target.runtime,target.migration,target.admin,target.sourceOwner]).size !== 4) {
    throw new Error('Transfer requires the public baseline and distinct owner/application roles.');
  }
}
export function validateLegacyCounts(value: unknown): asserts value is LegacyCounts {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== legacyTables.join(',')) throw new Error('Expected counts must cover exactly the baseline tables.');
  for (const count of Object.values(value)) if (!Number.isSafeInteger(count) || count < 0) throw new Error('Expected counts must be nonnegative safe integers.');
}
async function checkTarget(client: PoolClient, target: LegacyTarget) {
  validate(target);
  const result = await client.query(`SELECT current_database() AS database, current_user AS role, session_user AS login`);
  const row = result.rows[0];
  if (row.database !== target.expectedDatabase || row.role !== target.sourceOwner || row.login !== target.sourceOwner) throw new Error('Transfer database or owner login mismatch.');
  const schema = await client.query('SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname=$1', [target.schema]);
  if (schema.rowCount !== 1 || schema.rows[0].owner !== target.migration) throw new Error('Prepare the migration-owned destination schema first.');
}
async function inventory(client: PoolClient, schema: string, owner: string): Promise<LegacyCounts> {
  const objects = await client.query(`SELECT c.oid,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relacl,
      c.relrowsecurity,c.relforcerowsecurity,
      EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid) AS inherited
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind <> 'i' ORDER BY c.relname`, [schema]);
  if (objects.rows.map(row => row.relname).join(',') !== legacyTables.join(',')
    || objects.rows.some(row => row.relkind !== 'r' || row.owner !== owner || row.relacl !== null || row.relrowsecurity || row.relforcerowsecurity || row.inherited)) {
    throw new Error('Source objects, owners or grants differ from the supported baseline.');
  }
  const custom = await client.query(`SELECT
    EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname=$1))
    OR EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal)
    OR EXISTS(SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1) AS found`, [schema]);
  if (custom.rows[0].found) throw new Error('Custom routines, triggers or policies require a separately reviewed transfer.');
  const counts = {} as LegacyCounts;
  for (const table of legacyTables) {
    const attrs = await client.query(`SELECT attname,attacl FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`, [`${identifier(schema)}.${identifier(table)}`]);
    if (attrs.rows.map(row => row.attname).join(',') !== columns[table].join(',') || attrs.rows.some(row => row.attacl !== null)) throw new Error('Source columns or grants differ from the supported baseline.');
    counts[table] = Number((await client.query(`SELECT count(*) AS count FROM ${identifier(schema)}.${identifier(table)}`)).rows[0].count);
  }
  const ledger = await client.query(`SELECT version FROM ${identifier(schema)}.schema_migrations ORDER BY version`);
  if (ledger.rows.map(row => row.version).join(',') !== '1,2') throw new Error('Transfer supports exactly schema versions 1 and 2.');
  validateLegacyCounts(counts);
  return counts;
}
async function requireEmptySchema(client: PoolClient, schema: string) {
  const result = await client.query(`SELECT
    EXISTS(SELECT 1 FROM pg_class WHERE relnamespace=(SELECT oid FROM pg_namespace WHERE nspname=$1))
    OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname=$1)) AS occupied`, [schema]);
  if (result.rows[0].occupied) throw new Error('Destination schema must be empty.');
}

/** Read-only inventory; contains table counts, never records or credentials. */
export async function inspectLegacyDatabase(db: Pool, target: LegacyTarget): Promise<LegacyCounts> {
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await checkTarget(client, target); await requireEmptySchema(client, target.schema);
    const result = await inventory(client, target.sourceSchema, target.sourceOwner);
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** Moves the same relation objects: rows, indexes and constraints are not recreated. */
export async function transferLegacyDatabase(db: Pool, target: LegacyTarget, expected: LegacyCounts, direction: 'forward' | 'reverse' = 'forward') {
  validateLegacyCounts(expected);
  if (!['forward','reverse'].includes(direction)) throw new Error('Unknown transfer direction.');
  const source = direction === 'forward' ? target.sourceSchema : target.schema;
  const destination = direction === 'forward' ? target.schema : target.sourceSchema;
  const oldOwner = direction === 'forward' ? target.sourceOwner : target.migration;
  const newOwner = direction === 'forward' ? target.migration : target.sourceOwner;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await checkTarget(client, target);
    await client.query('SELECT pg_advisory_xact_lock(603106)');
    await client.query('SELECT pg_advisory_xact_lock(hashtext(current_database()),hashtext($1))', [target.schema]);
    await requireEmptySchema(client, destination);
    await client.query(`LOCK TABLE ${legacyTables.map(table => `${identifier(source)}.${identifier(table)}`).join(',')} IN ACCESS EXCLUSIVE MODE`);
    const before = await inventory(client, source, oldOwner);
    for (const table of legacyTables) if (before[table] !== expected[table]) throw new Error('Source row counts changed; nothing was transferred.');
    for (const table of legacyTables) {
      await client.query(`ALTER TABLE ${identifier(source)}.${identifier(table)} SET SCHEMA ${identifier(destination)}`);
      await client.query(`ALTER TABLE ${identifier(destination)}.${identifier(table)} OWNER TO ${identifier(newOwner)}`);
    }
    const after = await inventory(client, destination, newOwner);
    for (const table of legacyTables) if (after[table] !== expected[table]) throw new Error('Transfer verification failed.');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
