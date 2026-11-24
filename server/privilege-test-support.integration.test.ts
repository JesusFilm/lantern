import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createDatabase } from './database.js';
import { privilegeFixture } from './privilege-test-support.js';

test('fixture cleanup waits for a temporary lock and removes its database and roles', async () => {
  const fixture = await privilegeFixture();
  const owner = createDatabase(process.env.DATABASE_URL!);
  const locker = await owner.connect();
  let closed = false;
  let closing: Promise<Error | undefined> | undefined;
  try {
    // Lock only this fixture's database row from a different database. This
    // models a temporarily blocked DROP without holding a cluster-wide lock.
    await locker.query('BEGIN');
    await locker.query('SELECT oid FROM pg_database WHERE datname = $1 FOR UPDATE', [fixture.databaseName]);
    closing = fixture.close().then(() => undefined, error => error as Error);
    let waiting = false;
    for (let attempt = 0; attempt < 40 && !waiting; attempt++) {
      const activity = await owner.query(
        'SELECT 1 FROM pg_stat_activity WHERE query = $1 AND wait_event_type = $2',
        [`DROP DATABASE ${fixture.databaseName} WITH (FORCE)`, 'Lock'],
      );
      waiting = activity.rowCount === 1;
      if (!waiting) await delay(50);
    }
    assert.ok(waiting, 'cleanup should wait on the locked fixture database');
    await delay(3500);
    await locker.query('ROLLBACK');
    const failure = await closing;
    if (failure) throw failure;
    closed = true;
    const db = await owner.query('SELECT 1 FROM pg_database WHERE datname = $1', [fixture.databaseName]);
    const roles = await owner.query('SELECT 1 FROM pg_roles WHERE rolname = ANY($1::text[])', [Object.values(fixture.roles)]);
    assert.equal(db.rowCount, 0);
    assert.equal(roles.rowCount, 0);
  } finally {
    await locker.query('ROLLBACK').catch(() => {});
    locker.release();
    await closing;
    if (!closed) {
      await owner.query(`DROP DATABASE IF EXISTS ${fixture.databaseName} WITH (FORCE)`);
      for (const role of Object.values(fixture.roles)) await owner.query(`DROP ROLE IF EXISTS ${role}`);
    }
    await owner.end();
  }
});
