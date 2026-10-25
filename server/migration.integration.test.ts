import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './database.js';
import { migrate, assertSchemaReady } from './schema.js';
import { approveEmail } from './admission.js';
test('empty schema is unready; concurrent and repeated migrations preserve operator configuration', async () => {
  const admin = createDatabase(process.env.DATABASE_URL!);
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('options', `-c search_path=${schema}`);
  const db = createDatabase(url.href);
  try {
    await assert.rejects(assertSchemaReady(db));
    await Promise.all([migrate(db), migrate(db), migrate(db)]);
    await approveEmail(db, 'person@example.test');
    await migrate(db);
    await assertSchemaReady(db);
    // Migration/operator storage boundary: verify existing rows, not just successful DDL.
    assert.deepEqual((await db.query('SELECT email FROM approved_emails')).rows, [{ email: 'person@example.test' }]);
    await db.query('ALTER TABLE users RENAME TO unavailable_users');
    await assert.rejects(assertSchemaReady(db));
  } finally { await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});

test('failed migration rolls back partial DDL and a blocked migrator fails within the database timeout', { timeout: 15000 }, async () => {
  const admin = createDatabase(process.env.DATABASE_URL!);
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('options', `-c search_path=${schema}`);
  const db = createDatabase(url.href);
  try {
    // A legacy incompatible relation forces a failure part-way through baseline adoption.
    await db.query('CREATE TABLE memberships (invalid text)');
    await assert.rejects(migrate(db));
    assert.equal((await db.query("SELECT to_regclass('schema_migrations') AS table_name")).rows[0].table_name, null);
    await db.query('DROP TABLE memberships');
    const blocker = await db.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT pg_advisory_xact_lock(hashtext(current_database()), hashtext(current_schema()))');
      await assert.rejects(migrate(db));
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
    await migrate(db);
    await assertSchemaReady(db);
  } finally { await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});


test('upgrading the hosted baseline preserves existing accounts and requires the approval migration', async () => {
  const admin = createDatabase(process.env.DATABASE_URL!);
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('options', `-c search_path=${schema}`);
  const db = createDatabase(url.href);
  try {
    await migrate(db);
    // Reconstruct migration 1's deployed shape without destroying its legacy account.
    await db.query('DROP TABLE IF EXISTS approved_emails');
    await db.query('DELETE FROM schema_migrations WHERE version IN (2,3,5,6)');
    await db.query('ALTER TABLE users ADD COLUMN hosted_domain text NOT NULL; CREATE TABLE allowed_domains(domain text PRIMARY KEY); DROP FUNCTION enroll_member(uuid,text)');
    const userId = randomUUID();
    await db.query("INSERT INTO users VALUES($1,'legacy-sub','legacy@example.test','Legacy person','example.test')", [userId]);
    await assert.rejects(assertSchemaReady(db));
    await Promise.all([migrate(db), migrate(db)]);
    await assertSchemaReady(db);
    assert.deepEqual((await db.query('SELECT id,name FROM users')).rows, [{id:userId,name:'Legacy person'}]);
    assert.deepEqual((await db.query('SELECT email FROM approved_emails')).rows, []);
    await db.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,'personal-sub','personal@gmail.com','Personal')", [randomUUID()]);
    await migrate(db);
    assert.equal((await db.query('SELECT count(*) FROM users')).rows[0].count, '2');
  } finally { await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});
