import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './database.js';
import { migrate, assertSchemaReady } from './schema.js';
import { configureDomains } from './membership.js';
test('empty schema is unready; concurrent and repeated migrations preserve operator configuration', async () => {
  const admin = createDatabase(process.env.DATABASE_URL!);
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('options', `-c search_path=${schema}`);
  const db = createDatabase(url.href);
  try {
    await assert.rejects(assertSchemaReady(db));
    await Promise.all([migrate(db), migrate(db), migrate(db)]);
    await configureDomains(db, ['example.test']);
    await migrate(db);
    await assertSchemaReady(db);
    // Migration/operator storage boundary: verify existing rows, not just successful DDL.
    assert.deepEqual((await db.query('SELECT domain FROM allowed_domains')).rows, [{ domain: 'example.test' }]);
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
