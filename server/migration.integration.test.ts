import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import { createApp } from './app.js';
import { accessRoutes } from './access.js';
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
    await db.query("INSERT INTO users(id,google_sub,email,name,hosted_domain) VALUES($1,'legacy-sub','legacy@example.test','Legacy person','example.test')", [userId]);
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

test('identity enrollment migration preserves legacy duplicates and membership history while refusing new ambiguous assignments', async () => {
  const admin = createDatabase(process.env.DATABASE_URL!);
  const schema = `identity_migration_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('options', `-c search_path=${schema}`);
  const db = createDatabase(url.href);
  try {
    await migrate(db);
    await db.query('DROP FUNCTION guard_membership_identity() CASCADE; DROP TABLE auth_identity_candidates; DELETE FROM schema_migrations WHERE version=11');
    const lead = randomUUID(), duplicate = randomUUID(), department = randomUUID();
    await db.query("INSERT INTO users VALUES($1,'legacy','lead@example.test','Original'),($2,'jesusfilm:new','lead@example.test','Duplicate')", [lead, duplicate]);
    await db.query("INSERT INTO departments(id,name) VALUES($1,'Preserved')", [department]);
    await db.query("INSERT INTO memberships VALUES($1,$2,'career-lead',NULL)", [lead, department]);
    const before = (await db.query('SELECT * FROM memberships')).rows;
    await assert.rejects(assertSchemaReady(db));
    await migrate(db); await migrate(db); await assertSchemaReady(db);
    assert.deepEqual((await db.query('SELECT * FROM memberships')).rows, before);
    assert.equal((await db.query('SELECT id FROM users')).rowCount, 2);
    await assert.rejects(db.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [duplicate, department]), { code: 'P0409' });
    await db.query('ALTER TABLE memberships DISABLE TRIGGER guard_membership_identity');
    await assert.rejects(assertSchemaReady(db), /identity guard/);
  } finally { await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});

test('review migration rejects old-writer confirmation without a current request and preserves existing baselines', async () => {
  const {privilegeFixture}=await import('./privilege-test-support.js');
  const f=await privilegeFixture();
  const server=createServer();
  try {
    await migrate(f.migration,f.roles);
    // Reconstruct the deployed schema-11 guard before upgrading real saved data.
    await f.migration.query(`DELETE FROM schema_migrations WHERE version=12;
      CREATE OR REPLACE FUNCTION guard_focus_review() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $guard$
      DECLARE requested integer;
      BEGIN
        IF NEW.status='confirmed' AND OLD.status='draft' THEN
          SELECT version INTO requested FROM focus_review_requests WHERE focus_id=OLD.id ORDER BY version DESC LIMIT 1;
          IF requested IS NOT NULL AND requested<>OLD.version THEN
            RAISE EXCEPTION 'Latest saved draft must be sent for review before confirmation.' USING ERRCODE='P0409';
          END IF;
          DELETE FROM coach_checkpoints WHERE focus_id=OLD.id;
        END IF;
        RETURN NEW;
      END $guard$;`);
    const lead=randomUUID(),department=randomUUID(),legacy=randomUUID(),pending=randomUUID();
    await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1::uuid,$1::text,'lead@example.test','Lead')",[lead]);
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Team')",[department]);
    await f.admin.query("INSERT INTO memberships VALUES($1,$2,'career-lead',NULL)",[lead,department]);
    for(const id of [legacy,pending]) await f.runtime.query(`INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end,sections)
      VALUES($1,$2,$3,'Existing focus','2026-01-01','2026-12-31','[{"kind":"normal","objective":"Support onboarding","goals":["Publish by June"]}]')`,[id,lead,department]);
    const oldConfirm=(id:string)=>f.runtime.query("UPDATE position_focuses SET status='confirmed',confirmed_at=now(),confirmed_by=$2,version=version+1 WHERE id=$1 RETURNING *",[id,lead]);
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();
    assert.ok(address && typeof address!=='string');
    const origin=`http://127.0.0.1:${address.port}`;
    const app=express();
    // Preserve only schema 11's no-request SQL write. Reuse accessRoutes' actual
    // terminal error middleware, unchanged from 2cd0baf, so a real PostgreSQL
    // rejection crosses the same HTTP serializer. The stack lookup is confined
    // to this compatibility fixture; it does not rehearse legacy authorization.
    const legacyErrorHandler=accessRoutes(f.runtime,{origin}).stack.at(-1)?.handle;
    assert.equal(legacyErrorHandler?.length,4,'accessRoutes must end with its error middleware.');
    app.post('/schema-11/focuses/:id/confirm',async(req,res)=>{
      res.json((await oldConfirm(String(req.params.id))).rows[0]);
    });
    app.use(legacyErrorHandler);
    app.use(createApp(f.runtime,{origin,localUserId:lead}));
    server.on('request',app);
    const confirmOverHttp=(path:string)=>fetch(origin+path,{
      method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({version:1}),
    });
    const oldPath=`/schema-11/focuses/${pending}/confirm`;
    const legacyResponse=await confirmOverHttp(`/schema-11/focuses/${legacy}/confirm`);
    assert.equal(legacyResponse.status,200);
    assert.equal((await legacyResponse.json() as {status:string}).status,'confirmed');
    const baseline=(await f.runtime.query('SELECT * FROM position_focuses WHERE id=$1',[legacy])).rows[0];
    await f.runtime.query("INSERT INTO coach_checkpoints VALUES($1,$2)",[pending,JSON.stringify({work:"Private writing"})]);
    const readPending=async()=>{
      const response=await fetch(`${origin}/api/coach/focuses/${pending}`);
      assert.equal(response.status,200);
      return response.json();
    };
    const pendingBefore=await readPending();
    await Promise.all([migrate(f.migration,f.roles),migrate(f.migration,f.roles)]);
    await migrate(f.migration,f.roles);
    const oldResponse=await confirmOverHttp(oldPath);
    assert.equal(oldResponse.status,503,'The schema-11 HTTP handler does not translate the guard error into a conflict.');
    assert.deepEqual(await oldResponse.json(),{error:'The service is temporarily unavailable. Please try again.'});
    assert.deepEqual(await readPending(),pendingBefore);
    const currentResponse=await confirmOverHttp(`/api/department/members/${lead}/focuses/${pending}/confirm`);
    assert.equal(currentResponse.status,409);
    assert.deepEqual(await currentResponse.json(),{error:'Send the latest saved version for review before confirming.'});
    assert.deepEqual(await readPending(),pendingBefore);
    await assert.rejects(oldConfirm(pending),{code:'P0409'});
    assert.deepEqual((await f.runtime.query('SELECT * FROM position_focuses WHERE id=$1',[legacy])).rows[0],baseline);
    assert.equal((await f.runtime.query('SELECT document FROM coach_checkpoints WHERE focus_id=$1',[pending])).rowCount,1);
    assert.equal((await f.runtime.query('SELECT status,version FROM position_focuses WHERE id=$1',[pending])).rows[0].status,'draft');
    await f.runtime.query("INSERT INTO focus_review_requests(id,focus_id,version,document) VALUES($1,$2,1,'{}')",[randomUUID(),pending]);
    await f.runtime.query('UPDATE position_focuses SET version=2 WHERE id=$1',[pending]);
    await assert.rejects(oldConfirm(pending),{code:'P0409'});
    await f.runtime.query("INSERT INTO focus_review_requests(id,focus_id,version,document) VALUES($1,$2,2,'{}')",[randomUUID(),pending]);
    const requestedResponse=await confirmOverHttp(oldPath);
    assert.equal(requestedResponse.status,200);
    const confirmed=await requestedResponse.json() as {status:string;version:number};
    assert.equal(confirmed.status,'confirmed');
    assert.equal(confirmed.version,3);
    assert.equal((await f.runtime.query('SELECT document FROM coach_checkpoints WHERE focus_id=$1',[pending])).rowCount,0);
    // A confirmed row without request history remains valid on subsequent updates.
    await f.runtime.query('UPDATE position_focuses SET updated_at=updated_at WHERE id=$1',[legacy]);
    assert.deepEqual((await f.runtime.query('SELECT * FROM position_focuses WHERE id=$1',[legacy])).rows[0],baseline);
  } finally {
    server.closeAllConnections();
    if(server.listening) await new Promise<void>(resolve=>server.close(()=>resolve()));
    await f.close();
  }
});
