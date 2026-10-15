import type { Pool } from 'pg';

export async function migrate(database: Pool) {
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
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function assertSchemaReady(database: Pool) {
  const result = await database.query('SELECT version FROM schema_migrations WHERE version = 1');
  if (!result.rowCount) throw new Error('Required migration is missing.');
  await database.query(`SELECT u.id, d.id, m.user_id, f.id, s.token_hash, l.state_hash, a.domain
    FROM users u, departments d, memberships m, position_focuses f, sessions s, login_attempts l, allowed_domains a LIMIT 0`);
}
