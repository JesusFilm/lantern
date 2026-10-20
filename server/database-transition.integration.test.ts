import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { privilegeFixture } from './privilege-test-support.js';
import { migrate, assertSchemaReady } from './schema.js';
import { assertRuntimePrivileges } from './database-privileges.js';
import { inspectLegacyDatabase, transferLegacyDatabase } from './database-transition.js';

async function legacyFixture() {
  const fixture = await privilegeFixture();
  try {
    await migrate(fixture.bootstrap);
    await fixture.bootstrap.query('CREATE TABLE public.allowed_domains(domain text PRIMARY KEY); ALTER TABLE public.users ADD COLUMN hosted_domain text');
    await fixture.bootstrap.query('DROP FUNCTION public.enroll_member(uuid,text)');
    await fixture.bootstrap.query('DELETE FROM public.schema_migrations WHERE version IN (3,4,5,6)');
    await fixture.bootstrap.query('ALTER TABLE public.position_focuses DROP COLUMN status, DROP COLUMN confirmed_at, DROP COLUMN confirmed_by');
    const user = randomUUID(), department = randomUUID(), focus = randomUUID();
    await fixture.bootstrap.query("INSERT INTO public.users VALUES($1,'synthetic-sub','person@example.test','Synthetic person','example.test')", [user]);
    await fixture.bootstrap.query("INSERT INTO public.departments VALUES($1,'Synthetic team',NULL)", [department]);
    await fixture.bootstrap.query("INSERT INTO public.memberships VALUES($1,$2,'member',NULL)", [user, department]);
    await fixture.bootstrap.query("INSERT INTO public.position_focuses(id,user_id,department_id,title,period_start,period_end,sections) VALUES($1,$2,$3,'Preserve this focus','2026-01-01','2026-12-31','[{\"kind\":\"normal\",\"objective\":\"Synthetic objective\",\"goals\":[]}]')", [focus,user,department]);
    const owner = (await fixture.bootstrap.query('SELECT current_user AS name')).rows[0].name as string;
    const target = { expectedDatabase:fixture.databaseName, sourceSchema:'public', schema:'lantern', sourceOwner:owner, ...fixture.roles };
    return {...fixture, target, user, department, focus};
  } catch (error) { await fixture.close(); throw error; }
}

test('legacy schema transfer preserves records, identities, constraints and ownership through migration', async () => {
  const f = await legacyFixture();
  try {
    const inventory = await inspectLegacyDatabase(f.bootstrap, f.target);
    assert.equal(inventory.position_focuses, 1);
    const oid = (await f.bootstrap.query("SELECT 'public.position_focuses'::regclass::oid AS oid")).rows[0].oid;
    await transferLegacyDatabase(f.bootstrap, f.target, inventory);
    assert.equal((await f.bootstrap.query("SELECT to_regclass('public.position_focuses') AS old")).rows[0].old, null);
    assert.equal((await f.migration.query("SELECT 'position_focuses'::regclass::oid AS oid")).rows[0].oid, oid);
    await migrate(f.migration, f.roles);
    await assertSchemaReady(f.runtime); await assertRuntimePrivileges(f.runtime);
    const focus = (await f.runtime.query('SELECT id,user_id,department_id,title,sections FROM position_focuses')).rows[0];
    assert.deepEqual(focus, {id:f.focus,user_id:f.user,department_id:f.department,title:'Preserve this focus',sections:[{kind:'normal',objective:'Synthetic objective',goals:[]}]});
    assert.equal((await f.runtime.query('SELECT role FROM memberships')).rows[0].role,'member');
    await assert.rejects(f.admin.query('DELETE FROM users WHERE id=$1',[f.user]), {code:'23503'});
    await assert.rejects(f.runtime.query('ALTER TABLE users ADD COLUMN forbidden text'), {code:'42501'});
  } finally { await f.close(); }
});

test('pre-migration recovery reverses a committed transfer and refuses to reverse an upgraded database', async () => {
  const f = await legacyFixture();
  try {
    const counts = await inspectLegacyDatabase(f.bootstrap, f.target);
    await transferLegacyDatabase(f.bootstrap, f.target, counts);
    await transferLegacyDatabase(f.bootstrap, f.target, counts, 'reverse');
    assert.deepEqual(await inspectLegacyDatabase(f.bootstrap, f.target), counts);
    assert.equal((await f.bootstrap.query('SELECT title FROM public.position_focuses')).rows[0].title,'Preserve this focus');
    await transferLegacyDatabase(f.bootstrap, f.target, counts);
    await migrate(f.migration, f.roles);
    await assert.rejects(transferLegacyDatabase(f.bootstrap, f.target, counts, 'reverse'));
    await assertSchemaReady(f.runtime);
  } finally { await f.close(); }
});

test('changed counts, wrong targets and unexpected objects abort before moving tables', async () => {
  const f = await legacyFixture();
  try {
    const counts = await inspectLegacyDatabase(f.bootstrap, f.target);
    await assert.rejects(transferLegacyDatabase(f.bootstrap, {...f.target,expectedDatabase:'wrong'}, counts));
    await assert.rejects(transferLegacyDatabase(f.bootstrap, f.target, {...counts,users:0}));
    await f.bootstrap.query('CREATE TABLE public.unexpected(id integer)');
    await assert.rejects(transferLegacyDatabase(f.bootstrap, f.target, counts));
    await f.bootstrap.query('DROP TABLE public.unexpected');
    assert.deepEqual(await inspectLegacyDatabase(f.bootstrap, f.target), counts);
    await f.bootstrap.query('INSERT INTO public.allowed_domains VALUES(\'changed.test\')');
    await assert.rejects(transferLegacyDatabase(f.bootstrap, f.target, counts));
    assert.equal((await f.bootstrap.query("SELECT to_regclass('lantern.users') AS relation")).rows[0].relation,null);
  } finally { await f.close(); }
});

test('an error after earlier tables moved rolls back the entire transfer', async () => {
  const f = await legacyFixture();
  try {
    const counts = await inspectLegacyDatabase(f.bootstrap, f.target);
    await f.bootstrap.query(`CREATE SCHEMA faults;
      CREATE FUNCTION faults.reject_last_move() RETURNS event_trigger LANGUAGE plpgsql AS $$
      BEGIN IF to_regclass('lantern.users') IS NOT NULL THEN RAISE EXCEPTION 'Synthetic DDL failure'; END IF; END $$;
      CREATE EVENT TRIGGER reject_last_move ON ddl_command_end WHEN TAG IN ('ALTER TABLE') EXECUTE FUNCTION faults.reject_last_move()`);
    await assert.rejects(transferLegacyDatabase(f.bootstrap, f.target, counts), /Synthetic DDL failure/);
    await f.bootstrap.query('DROP EVENT TRIGGER reject_last_move');
    assert.deepEqual(await inspectLegacyDatabase(f.bootstrap, f.target), counts);
    assert.equal((await f.bootstrap.query('SELECT title FROM public.position_focuses')).rows[0].title,'Preserve this focus');
  } finally { await f.close(); }
});

test('empty-database bootstrap refuses existing application data before creating roles', async () => {
  await assert.rejects(async () => {
    const f = await privilegeFixture({requireEmpty:true, beforeBootstrap: async db => {
      await db.query('CREATE TABLE public.existing_history(id integer)');
    }});
    await f.close();
  }, /empty database/);
});

test('empty-database bootstrap includes non-system schemas beginning with pg', async () => {
  await assert.rejects(async () => {
    const f = await privilegeFixture({requireEmpty:true, beforeBootstrap: async db => {
      await db.query('CREATE SCHEMA pgarchive; CREATE TABLE pgarchive.existing_history(id integer)');
      await db.query('INSERT INTO pgarchive.existing_history VALUES (1)');
    }});
    await f.close();
  }, /empty database/);
});

test('fresh setup creates the complete empty database under separate roles without copying stage records', async () => {
  const stage = await legacyFixture();
  const fresh = await privilegeFixture({requireEmpty:true});
  try {
    await migrate(fresh.migration, fresh.roles);
    await assertSchemaReady(fresh.runtime); await assertRuntimePrivileges(fresh.runtime);
    for (const table of ['users','departments','memberships','position_focuses','sessions','login_attempts','approved_emails']) {
      assert.equal((await fresh.runtime.query(`SELECT count(*) AS count FROM ${table}`)).rows[0].count,'0');
    }
    assert.deepEqual((await fresh.runtime.query('SELECT version FROM schema_migrations ORDER BY version')).rows,[{version:1},{version:2},{version:3},{version:4},{version:5},{version:6}]);
    assert.equal((await stage.bootstrap.query('SELECT count(*) AS count FROM public.position_focuses')).rows[0].count,'1');
  } finally { await fresh.close(); await stage.close(); }
});


test('operator transfer commands pin a private inventory and reject count/target changes', async () => {
  const f = await legacyFixture();
  const dir = await mkdtemp(join(tmpdir(),'lantern-transfer-'));
  const path = join(dir,'private-plan.json');
  const env = {...process.env,BOOTSTRAP_DATABASE_URL:f.bootstrap.options.connectionString!,LANTERN_ENV:'stage',
    LANTERN_DB_NAME:f.databaseName,LANTERN_DB_SCHEMA:'lantern',LANTERN_DB_SOURCE_OWNER:f.target.sourceOwner,
    LANTERN_DB_RUNTIME_ROLE:f.roles.runtime,LANTERN_DB_MIGRATION_ROLE:f.roles.migration,LANTERN_DB_ADMIN_ROLE:f.roles.admin,
    LANTERN_DB_EXPECTED_ENDPOINT:new URL(f.bootstrap.options.connectionString!).host};
  const run = (action:string, patch = {}) => promisify(execFile)(process.execPath,['--import','tsx','server/transition-database.ts',action,path],{env:{...env,...patch}});
  try {
    await run('inspect');
    const original = await readFile(path,'utf8');
    await assert.rejects(run('inspect')); // Never overwrite reviewed inventory.
    const changed = JSON.parse(original); changed.expectedRows.users = 0;
    await writeFile(path,JSON.stringify(changed));
    await assert.rejects(run('apply'));
    await writeFile(path,original);
    await assert.rejects(run('apply',{LANTERN_DB_EXPECTED_ENDPOINT:'wrong:5432'}));
    await assert.rejects(run('apply',{LANTERN_ENV:'production'}));
    await run('apply');
    await run('reverse');
    assert.equal((await f.bootstrap.query('SELECT title FROM public.position_focuses')).rows[0].title,'Preserve this focus');
  } finally { await f.close(); await rm(dir,{recursive:true,force:true}); }
});

test('read-only verification checks each credential scope and optional empty-database checkpoint', async () => {
  const f = await privilegeFixture({requireEmpty:true});
  try {
    const { verifyDatabase } = await import('./database-verification.js');
    const config = {...f.roles,expectedDatabase:f.databaseName,schema:'lantern'};
    await migrate(f.migration,f.roles);
    for (const scope of ['runtime','migration','admin'] as const) await verifyDatabase(f[scope],config,scope,true);
    await assert.rejects(verifyDatabase(f.admin,config,'runtime',true));
    await f.admin.query("INSERT INTO approved_emails VALUES('person@example.test')");
    await assert.rejects(verifyDatabase(f.runtime,config,'runtime',true));
    await verifyDatabase(f.runtime,config,'runtime',false);
  } finally { await f.close(); }
});

test('fresh operator commands create NOLOGIN roles, then migrate and verify separately scoped connections', async () => {
  const f = await privilegeFixture({deferBootstrap:true});
  const env = {...process.env,BOOTSTRAP_DATABASE_URL:f.bootstrap.options.connectionString!,LANTERN_ENV:'production',LANTERN_DB_SETUP_MODE:'empty',
    LANTERN_DB_NAME:f.databaseName,LANTERN_DB_SCHEMA:'lantern',LANTERN_DB_SOURCE_OWNER:(await f.bootstrap.query('SELECT current_user AS name')).rows[0].name,
    LANTERN_DB_RUNTIME_ROLE:f.roles.runtime,LANTERN_DB_MIGRATION_ROLE:f.roles.migration,LANTERN_DB_ADMIN_ROLE:f.roles.admin,
    LANTERN_DB_EXPECTED_ENDPOINT:new URL(f.bootstrap.options.connectionString!).host};
  const run = (file:string,args:string[] = [],patch = {}) => promisify(execFile)(process.execPath,['--import','tsx',`server/${file}.ts`,...args],{env:{...env,...patch}});
  try {
    await assert.rejects(run('bootstrap-database',[],{LANTERN_DB_SOURCE_OWNER:'wrong_owner'}));
    await run('bootstrap-database');
    const roles = await f.bootstrap.query('SELECT rolcanlogin FROM pg_roles WHERE rolname=ANY($1::text[])',[Object.values(f.roles)]);
    assert.deepEqual(roles.rows,[{rolcanlogin:false},{rolcanlogin:false},{rolcanlogin:false}]);
    // Synthetic equivalent of the operator's private password-setting checkpoint.
    for (const scope of ['runtime','migration','admin'] as const) {
      const password = new URL(f[scope].options.connectionString!).password;
      assert.match(password,/^[a-z0-9-]+$/);
      await f.bootstrap.query(`ALTER ROLE "${f.roles[scope]}" LOGIN PASSWORD '${password}'`);
    }
    await assert.rejects(run('migrate',[],{
      MIGRATION_DATABASE_URL:f.migration.options.connectionString!,
      LANTERN_DB_EXPECTED_ENDPOINT:'wrong:5432',
    }));
    assert.equal((await f.bootstrap.query("SELECT to_regclass('lantern.schema_migrations') AS ledger")).rows[0].ledger,null);
    await run('migrate',[],{MIGRATION_DATABASE_URL:f.migration.options.connectionString!});
    for (const [scope,variable] of [['runtime','DATABASE_URL'],['migration','MIGRATION_DATABASE_URL'],['admin','ADMIN_DATABASE_URL']] as const) {
      await run('verify-database',[scope,'--expect-empty'],{[variable]:f[scope].options.connectionString!});
    }
  } finally { await f.close(); }
});

test('runtime verification rejects missing session, focus and enrollment permissions', async () => {
  const f = await privilegeFixture({requireEmpty:true});
  try {
    const { verifyDatabase } = await import('./database-verification.js');
    const config = {...f.roles,expectedDatabase:f.databaseName,schema:'lantern'};
    await migrate(f.migration,f.roles);
    for (const permission of [
      'INSERT ON lantern.sessions',
      'UPDATE (title) ON lantern.position_focuses',
      'EXECUTE ON FUNCTION lantern.enroll_member(uuid,text)',
    ]) {
      await f.bootstrap.query(`REVOKE ${permission} FROM "${f.roles.runtime}"`);
      await assert.rejects(verifyDatabase(f.runtime,config,'runtime',true), /permission is missing/);
      await f.bootstrap.query(`GRANT ${permission} TO "${f.roles.runtime}"`);
      await verifyDatabase(f.runtime,config,'runtime',true);
    }
  } finally { await f.close(); }
});

test('administrative verification rejects schema creation outside the application schema', async () => {
  const f = await privilegeFixture({requireEmpty:true});
  try {
    const { verifyDatabase } = await import('./database-verification.js');
    const config = {...f.roles,expectedDatabase:f.databaseName,schema:'lantern'};
    await migrate(f.migration,f.roles);
    await f.bootstrap.query(`GRANT CREATE ON SCHEMA public TO "${f.roles.admin}"`);
    await assert.rejects(verifyDatabase(f.admin,config,'admin',true), /schema or ledger privileges/);
    await f.bootstrap.query(`REVOKE CREATE ON SCHEMA public FROM "${f.roles.admin}"`);
    await verifyDatabase(f.admin,config,'admin',true);
  } finally { await f.close(); }
});
