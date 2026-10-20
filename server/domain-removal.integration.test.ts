import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { privilegeFixture } from './privilege-test-support.js';
import { migrate, assertSchemaReady } from './schema.js';
import { migrateEnrollment } from './enrollment-migration.js';
import { verifyDatabase } from './database-verification.js';

async function legacyFixture() {
  const f = await privilegeFixture();
  await migrate(f.migration, f.roles);
  // Reconstruct schema 5 around real records; keep this independent of migration 6.
  await f.migration.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hosted_domain text;
    CREATE TABLE IF NOT EXISTS allowed_domains(domain text PRIMARY KEY);
    DROP FUNCTION IF EXISTS enroll_member(uuid,text,boolean);
    DELETE FROM schema_migrations WHERE version=6`);
  const client = await f.migration.connect();
  try { await migrateEnrollment(client); } finally { client.release(); }
  return f;
}

test('domain removal erases legacy storage while preserving approved emails, accounts, sessions, memberships and focuses', async () => {
  const f = await legacyFixture();
  try {
    const user = randomUUID(), team = randomUUID(), focus = randomUUID();
    await f.migration.query("INSERT INTO allowed_domains VALUES('historical.test')");
    await f.admin.query("INSERT INTO approved_emails VALUES('person@another.test')");
    await f.migration.query("INSERT INTO users VALUES($1,'legacy-sub','person@another.test','Preserved name','historical.test')", [user]);
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Preserved team')", [team]);
    await f.admin.query("INSERT INTO memberships VALUES($1,$2,'career-lead',NULL)", [user,team]);
    await f.admin.query("INSERT INTO sessions VALUES('preserved-session',$1,now()+interval '1 hour')", [user]);
    await f.admin.query(`INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end)
      VALUES($1,$2,$3,'Preserved focus','2026-01-01','2026-12-31')`, [focus,user,team]);
    await Promise.all([migrate(f.migration,f.roles), migrate(f.migration,f.roles)]);
    await assertSchemaReady(f.runtime);
    assert.equal((await f.migration.query("SELECT to_regclass('allowed_domains') AS relation")).rows[0].relation, null);
    assert.equal((await f.migration.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='users' AND column_name='hosted_domain'")).rowCount, 0);
    assert.equal((await f.migration.query("SELECT to_regprocedure('enroll_member(uuid,text,boolean)') AS routine")).rows[0].routine, null);
    assert.deepEqual((await f.runtime.query('SELECT id,google_sub,email,name FROM users')).rows,
      [{id:user,google_sub:'legacy-sub',email:'person@another.test',name:'Preserved name'}]);
    assert.deepEqual((await f.runtime.query('SELECT email FROM approved_emails')).rows,[{email:'person@another.test'}]);
    assert.equal((await f.runtime.query('SELECT token_hash FROM sessions')).rows[0].token_hash,'preserved-session');
    assert.equal((await f.runtime.query('SELECT user_id,department_id FROM memberships')).rows[0].department_id,team);
    assert.equal((await f.runtime.query('SELECT title FROM position_focuses WHERE id=$1',[focus])).rows[0].title,'Preserved focus');
    for (const scope of ['runtime','migration','admin'] as const) {
      await verifyDatabase(f[scope], {...f.roles,expectedDatabase:f.databaseName,schema:'lantern'},scope);
    }
  } finally { await f.close(); }
});

test('unexpected dependencies abort domain removal atomically without cascading data loss', async () => {
  const f = await legacyFixture();
  try {
    await f.migration.query("INSERT INTO allowed_domains VALUES('retained-until-success.test')");
    await f.migration.query('CREATE VIEW legacy_consumer AS SELECT hosted_domain FROM users');
    await assert.rejects(migrate(f.migration,f.roles), {code:'2BP01'});
    assert.deepEqual((await f.migration.query('SELECT domain FROM allowed_domains')).rows,[{domain:'retained-until-success.test'}]);
    assert.ok((await f.migration.query("SELECT to_regprocedure('enroll_member(uuid,text,boolean)') AS routine")).rows[0].routine);
    assert.equal((await f.migration.query('SELECT version FROM schema_migrations WHERE version=6')).rowCount,0);
    await f.migration.query('DROP VIEW legacy_consumer');
    await migrate(f.migration,f.roles);
    await assertSchemaReady(f.runtime);
  } finally { await f.close(); }
});
