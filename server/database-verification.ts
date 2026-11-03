import type { Pool } from 'pg';
import { assertDatabaseTarget, assertRuntimePrivileges, identifier, type DatabaseRoles } from './database-privileges.js';
import { assertSchemaReady } from './schema.js';
const applicationTables = ['ai_members','ai_member_focuses','ai_member_tokens','coach_checkpoints','focus_review_requests','focus_review_notes','focus_note_reads','department_direction','approved_emails','departments','login_attempts','memberships','position_focuses','schema_migrations','sessions','users'];

export async function verifyDatabase(db: Pool, config: DatabaseRoles & {expectedDatabase:string;schema:string}, scope: keyof DatabaseRoles, expectEmpty = false) {
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await assertDatabaseTarget(client,{database:config.expectedDatabase,schema:config.schema,role:config[scope]});
    await assertSchemaReady(client);
    const owners = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND pg_get_userbyid(c.relowner)=$3`,[config.schema,applicationTables,config.migration]);
    if (owners.rowCount !== applicationTables.length) throw new Error('Application table ownership differs from the migration role.');
    if (scope === 'runtime') {
      await assertRuntimePrivileges(client);
      const required = await client.query(`SELECT
        has_table_privilege('users','INSERT')
        AND has_table_privilege('sessions','INSERT') AND has_table_privilege('sessions','DELETE')
        AND has_table_privilege('login_attempts','INSERT') AND has_table_privilege('login_attempts','DELETE')
        AND has_table_privilege('position_focuses','INSERT')
        AND has_table_privilege('department_direction','SELECT')
        AND has_table_privilege('department_direction','INSERT')
        AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['ai_members','ai_member_focuses','ai_member_tokens']) AS t(name)
          WHERE NOT (has_table_privilege(name,'SELECT') AND has_table_privilege(name,'INSERT') AND has_table_privilege(name,'DELETE')))
        AND has_function_privilege('enroll_member(uuid,text)','EXECUTE')
        AND NOT EXISTS (
          SELECT 1 FROM (VALUES
            ('ai_members','name'),('ai_members','purpose'),('ai_members','profile_revision'),('ai_members','updated_at'),
            ('ai_members','last_retrieved_at'),('ai_members','last_retrieved_version'),
            ('ai_member_focuses','objective'),('ai_member_focuses','goals'),('ai_member_focuses','version'),('ai_member_focuses','updated_at'),
            ('ai_member_tokens','verifier_hash'),('ai_member_tokens','suffix'),('ai_member_tokens','credential_revision'),('ai_member_tokens','rotated_at'),
            ('department_direction','mission'), ('department_direction','initiatives'), ('department_direction','version'),
            ('users','name'), ('users','email'),
            ('position_focuses','title'), ('position_focuses','period_start'),
            ('position_focuses','period_end'), ('position_focuses','sections'),
            ('position_focuses','version'), ('position_focuses','updated_at'),
            ('position_focuses','status'), ('position_focuses','confirmed_at'), ('position_focuses','confirmed_by')
          ) AS required(table_name,column_name)
          WHERE NOT has_column_privilege(table_name,column_name,'UPDATE')
        ) AS allowed`);
      if (!required.rows[0].allowed) throw new Error('Runtime data or enrollment permission is missing.');
    }
    if (scope === 'admin') {
      const permissions = await client.query(`SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE has_schema_privilege(oid,'CREATE'))
        OR has_database_privilege(current_database(),'CREATE') OR has_database_privilege(current_database(),'TEMPORARY')
        OR has_any_column_privilege('schema_migrations','INSERT') OR has_any_column_privilege('schema_migrations','UPDATE')
        OR has_table_privilege('schema_migrations','DELETE') OR has_table_privilege('schema_migrations','TRUNCATE') AS elevated`);
      if (permissions.rows[0].elevated) throw new Error('Administrative credential has schema or ledger privileges.');
      for (const table of applicationTables.filter(name => name !== 'schema_migrations')) {
        for (const privilege of ['INSERT','UPDATE','DELETE']) {
          const result = await client.query('SELECT has_table_privilege($1,$2) AS allowed',[table,privilege]);
          if (!result.rows[0].allowed) throw new Error('Administrative data permission is missing.');
        }
      }
    }
    if (expectEmpty) for (const table of applicationTables.filter(name => name !== 'schema_migrations')) {
      const result = await client.query(`SELECT EXISTS(SELECT 1 FROM ${identifier(config.schema)}.${identifier(table)}) AS present`);
      if (result.rows[0].present) throw new Error('Expected an empty application database.');
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
