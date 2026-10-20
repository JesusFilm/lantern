import type { Pool, PoolClient } from 'pg';

type Database = Pool | PoolClient;
export interface DatabaseRoles { runtime: string; migration: string; admin: string }
export function identifier(value: string) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new Error('Use a lowercase PostgreSQL identifier (maximum 63 characters).');
  return `"${value}"`;
}
function validateRoles(roles: DatabaseRoles) {
  for (const role of Object.values(roles)) identifier(role);
  if (new Set(Object.values(roles)).size !== 3) throw new Error('Database roles must be distinct.');
}

/** Human bootstrap only. Fresh dedicated database/schema; never adopts existing objects or roles. */
export async function bootstrapDatabaseRoles(db: Pool, config: DatabaseRoles & { expectedDatabase: string; schema: string; requireEmpty?: boolean; expectedOwner?: string }) {
  validateRoles({ runtime: config.runtime, migration: config.migration, admin: config.admin });
  const schema = identifier(config.schema), database = identifier(config.expectedDatabase);
  if (['public', 'information_schema'].includes(config.schema) || config.schema.startsWith('pg_')) throw new Error('Use a dedicated application schema.');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const target = await client.query('SELECT current_database() AS name, current_user AS role, session_user AS login');
    if (target.rows[0].name !== config.expectedDatabase) throw new Error('Database target mismatch.');
    if (config.expectedOwner && (target.rows[0].role !== config.expectedOwner || target.rows[0].login !== config.expectedOwner)) throw new Error('Bootstrap owner mismatch.');
    if (config.requireEmpty) {
      const existing = await client.query(`SELECT EXISTS(
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      ) OR EXISTS(
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      ) AS occupied`);
      if (existing.rows[0].occupied) throw new Error('Fresh setup requires an empty database.');
    }
    for (const role of [config.migration, config.runtime, config.admin]) {
      await client.query(`CREATE ROLE ${identifier(role)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    }
    await client.query(`CREATE SCHEMA ${schema} AUTHORIZATION ${identifier(config.migration)}`);
    await client.query(`REVOKE CREATE, TEMPORARY ON DATABASE ${database} FROM PUBLIC`);
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await client.query(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);
    for (const role of [config.migration, config.runtime, config.admin]) {
      await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${identifier(role)}`);
      await client.query(`ALTER ROLE ${identifier(role)} IN DATABASE ${database} SET search_path = ${schema}`);
    }
    // Function EXECUTE is granted to PUBLIC by PostgreSQL unless revoked globally
    // for the creating role. A schema-local default revoke does not remove it.
    await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(config.migration)} REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

/** Explicit allowlist: new tables/functions receive no runtime grants by default. */
export async function grantApplicationPrivileges(db: Database, roles: DatabaseRoles) {
  validateRoles(roles);
  const context = await db.query('SELECT current_user AS role, current_schema() AS schema');
  if (context.rows[0].role !== roles.migration) throw new Error('Privilege grants require the migration role.');
  const safeRoles = await db.query(`SELECT rolname FROM pg_roles r WHERE rolname=ANY($1::text[])
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
    AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)`, [Object.values(roles)]);
  if (safeRoles.rowCount !== 3) throw new Error('All database roles must exist without elevated privileges or role memberships.');
  const schema = identifier(context.rows[0].schema);
  const runtime = identifier(roles.runtime), admin = identifier(roles.admin);
  await db.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM PUBLIC, ${runtime}, ${admin}`);
  await db.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${schema} FROM PUBLIC, ${runtime}, ${admin}`);
  await db.query(`GRANT USAGE ON SCHEMA ${schema} TO ${runtime}, ${admin}`);
  await db.query(`GRANT SELECT ON schema_migrations, allowed_domains, approved_emails, users, departments, memberships, position_focuses, sessions, login_attempts TO ${runtime}, ${admin}`);
  await db.query(`GRANT INSERT ON users TO ${runtime}`);
  await db.query(`GRANT UPDATE (name, email, hosted_domain) ON users TO ${runtime}`);
  await db.query(`GRANT INSERT, DELETE ON sessions, login_attempts TO ${runtime}`);
  await db.query(`GRANT INSERT ON position_focuses TO ${runtime}`);
  await db.query(`GRANT UPDATE (title, period_start, period_end, sections, version, updated_at, status, confirmed_at, confirmed_by) ON position_focuses TO ${runtime}`);
  await db.query(`GRANT EXECUTE ON FUNCTION enroll_member(uuid,text,boolean), enroll_member(uuid,text) TO ${runtime}, ${admin}`);
  await db.query(`GRANT INSERT, UPDATE, DELETE ON allowed_domains, approved_emails, users, departments, memberships, position_focuses, sessions, login_attempts TO ${admin}`);
}

export async function assertDatabaseTarget(db: Database, expected: { database: string; schema: string; role: string }) {
  for (const value of Object.values(expected)) identifier(value);
  const result = await db.query(`SELECT current_database() AS database, current_schema() AS schema,
    current_user AS role, session_user AS login, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS member_of_role
    FROM pg_roles r WHERE rolname=current_user`);
  const row = result.rows[0];
  if (!row || row.database !== expected.database || row.schema !== expected.schema || row.role !== expected.role || row.login !== expected.role
    || row.rolsuper || row.rolcreatedb || row.rolcreaterole || row.rolreplication || row.rolbypassrls || row.member_of_role) {
    throw new Error('Database target or role privileges do not match the intended scope.');
  }
}

export function databaseRoleConfig(env: NodeJS.ProcessEnv = process.env) {
  const required = (name: string) => { const value = env[name]; if (!value) throw new Error(`${name} is required.`); identifier(value); return value; };
  const config = { expectedDatabase: required('LANTERN_DB_NAME'), schema: required('LANTERN_DB_SCHEMA'),
    runtime: required('LANTERN_DB_RUNTIME_ROLE'), migration: required('LANTERN_DB_MIGRATION_ROLE'), admin: required('LANTERN_DB_ADMIN_ROLE') };
  validateRoles({runtime:config.runtime,migration:config.migration,admin:config.admin});
  return config;
}

/** Refuse the common misconfiguration: serving requests with an owner/admin login. */
export async function assertRuntimePrivileges(db: Database) {
  const result = await db.query(`SELECT
    r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
    OR current_user <> session_user
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
    OR has_database_privilege(current_database(), 'CREATE')
    OR has_database_privilege(current_database(), 'TEMPORARY')
    OR EXISTS(SELECT 1 FROM pg_namespace WHERE has_schema_privilege(oid, 'CREATE'))
    OR EXISTS(SELECT 1 FROM pg_class WHERE relowner=r.oid AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname=current_schema()))
    OR EXISTS(SELECT 1 FROM unnest(ARRAY['schema_migrations','approved_emails','departments','memberships']) AS t(name)
      WHERE has_any_column_privilege(name, 'INSERT') OR has_any_column_privilege(name, 'UPDATE')
        OR has_table_privilege(name, 'DELETE') OR has_table_privilege(name, 'TRUNCATE') OR has_table_privilege(name, 'TRIGGER'))
    OR has_column_privilege('users','google_sub','UPDATE') OR has_column_privilege('users','id','UPDATE')
    AS forbidden FROM pg_roles r WHERE rolname=current_user`);
  if (result.rows[0]?.forbidden !== false) throw new Error('Runtime database privileges exceed the application scope.');
}
