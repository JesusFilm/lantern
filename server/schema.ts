import type { Pool } from 'pg';

export async function migrate(database: Pool) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS approved_emails (
      email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email <> '')
    );
    CREATE TABLE IF NOT EXISTS allowed_domains (domain text PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY, google_sub text UNIQUE NOT NULL, email text NOT NULL,
      name text NOT NULL, hosted_domain text NOT NULL
    );
    ALTER TABLE users ALTER COLUMN hosted_domain DROP NOT NULL;
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
}
