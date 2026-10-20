import type { Pool, PoolClient } from 'pg';
import { grantApplicationPrivileges, type DatabaseRoles } from './database-privileges.js';
import { migrateEnrollment } from './enrollment-migration.js';

export async function migrate(database: Pool, roles?: DatabaseRoles) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    // Transaction-scoped lock, shared by every migration runner in this schema.
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_database()), hashtext(current_schema()))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = await client.query('SELECT version FROM schema_migrations WHERE version = 1');
    if (!applied.rowCount) {
      await client.query(`
    CREATE TABLE IF NOT EXISTS allowed_domains (domain text PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY, google_sub text UNIQUE NOT NULL, email text NOT NULL,
      name text NOT NULL, hosted_domain text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS departments (
      id uuid PRIMARY KEY, name text NOT NULL, deleted_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS memberships (
      user_id uuid PRIMARY KEY REFERENCES users(id), department_id uuid NOT NULL REFERENCES departments(id),
      role text NOT NULL CHECK (role IN ('member', 'career-lead')), deleted_at timestamptz
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_career_lead ON memberships(department_id)
      WHERE role = 'career-lead' AND deleted_at IS NULL;
    CREATE TABLE IF NOT EXISTS position_focuses (
      id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
      department_id uuid NOT NULL REFERENCES departments(id), title text NOT NULL,
      period_start date NOT NULL, period_end date NOT NULL CHECK(period_end >= period_start),
      sections jsonb NOT NULL DEFAULT '[]', version integer NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS focus_owner_department ON position_focuses(user_id,department_id);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_attempts (
      state_hash text PRIMARY KEY, nonce text NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL
    );
      `);
      await client.query('INSERT INTO schema_migrations(version) VALUES (1)');
    }
    const approvals = await client.query('SELECT version FROM schema_migrations WHERE version = 2');
    if (!approvals.rowCount) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS approved_emails (
          email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> '')
        );
        ALTER TABLE users ALTER COLUMN hosted_domain DROP NOT NULL;
      `);
      await client.query('INSERT INTO schema_migrations(version) VALUES (2)');
    }
    const enrollment = await client.query('SELECT version FROM schema_migrations WHERE version = 3');
    if (!enrollment.rowCount) {
      await migrateEnrollment(client);
      await client.query('INSERT INTO schema_migrations(version) VALUES (3)');
    }
    const confirmation = await client.query('SELECT version FROM schema_migrations WHERE version = 4');
    if (!confirmation.rowCount) {
      await client.query(`ALTER TABLE position_focuses
        ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed')),
        ADD COLUMN confirmed_at timestamptz,
        ADD COLUMN confirmed_by uuid REFERENCES users(id),
        ADD CONSTRAINT focus_confirmation_metadata CHECK (
          (status='draft' AND confirmed_at IS NULL AND confirmed_by IS NULL) OR
          (status='confirmed' AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)
        )`);
      await client.query('INSERT INTO schema_migrations(version) VALUES (4)');
    }
    const direction = await client.query('SELECT version FROM schema_migrations WHERE version = 5');
    if (!direction.rowCount) {
      await client.query(`CREATE TABLE department_direction (
        department_id uuid PRIMARY KEY REFERENCES departments(id),
        mission text NOT NULL DEFAULT '' CHECK (length(mission) <= 1000),
        initiatives jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(initiatives)='array'),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0)
      )`);
      await client.query('INSERT INTO schema_migrations(version) VALUES (5)');
    }
    if (roles) await grantApplicationPrivileges(client, roles);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function assertSchemaReady(database: Pool | PoolClient) {
  const result = await database.query('SELECT version FROM schema_migrations WHERE version IN (1,2,3,4,5)');
  if (result.rowCount !== 5) throw new Error('Required migration is missing.');
  await database.query('SELECT department_id,mission,initiatives,version FROM department_direction LIMIT 0');
  await database.query(`SELECT u.id, d.id, m.user_id, f.id, f.status, f.confirmed_at, f.confirmed_by, s.token_hash, l.state_hash, a.domain, e.email
    FROM users u, departments d, memberships m, position_focuses f, sessions s, login_attempts l, allowed_domains a, approved_emails e LIMIT 0`);
}
