import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { privilegeFixture } from './privilege-test-support.js';
test('production-only package migrates, starts without dotenv, serves assets and fails closed on missing schema', { timeout: 90000 }, async () => {
 const dir = await mkdtemp(join(tmpdir(), 'lantern-runtime-'));
 const fixture = await privilegeFixture();
 const { runtime, admin, migration, roles } = fixture;
 const url = new URL(runtime.options.connectionString!);
 const socket = createServer(); await new Promise<void>(r => socket.listen(0, '127.0.0.1', r));
 const address = socket.address(); assert.ok(address && typeof address !== 'string');
 await new Promise<void>(r => socket.close(() => r()));
 const env = { ...process.env, DATABASE_URL: url.href, NODE_ENV: 'production', LANTERN_ENV: 'stage', LOCAL_ACCESS: '0', HOST: '127.0.0.1', PORT: String(address.port), APP_ORIGIN: 'https://stage.example.test', GOOGLE_CLIENT_ID: 'synthetic', GOOGLE_CLIENT_SECRET: 'synthetic' };
 const commandEnv = { ...env, MIGRATION_DATABASE_URL:migration.options.connectionString!, ADMIN_DATABASE_URL:admin.options.connectionString!,
   LANTERN_DB_EXPECTED_ENDPOINT:url.host, LANTERN_DB_NAME:fixture.databaseName, LANTERN_DB_SCHEMA:'lantern', LANTERN_DB_RUNTIME_ROLE:roles.runtime, LANTERN_DB_MIGRATION_ROLE:roles.migration, LANTERN_DB_ADMIN_ROLE:roles.admin };
 let child: ReturnType<typeof spawn> | undefined;
 async function stop() { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } child = undefined; }
 try {
   for (const file of ['dist', 'package.json', 'package-lock.json']) await cp(file, join(dir,file), { recursive: true });
   execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: dir, stdio: 'pipe' });
   await writeFile(join(dir,'release.json'), JSON.stringify({sha:'a'.repeat(40)}));
   assert.throws(() => execFileSync(process.execPath, ['dist/server/index.js'], { cwd: dir, env, stdio: 'pipe' }));
   for (const patch of [{LOCAL_ACCESS:'1'}, {GOOGLE_CLIENT_SECRET:''}, {LANTERN_ENV:'typo'}, {APP_ORIGIN:'http://localhost:4391'}]) assert.throws(() => execFileSync(process.execPath, ['dist/server/index.js'], {cwd:dir,env:{...env,...patch},stdio:'pipe'}));
   assert.throws(() => execFileSync(process.execPath, ['dist/server/index.js'], {
     cwd:dir, env:{...env,NODE_ENV:'development',LANTERN_ENV:'local',APP_ORIGIN:'http://127.0.0.1:4391',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:''}, stdio:'pipe'
   }));
   assert.equal((await migration.query("SELECT to_regclass('schema_migrations') AS relation")).rows[0].relation, null);
   const personalId = randomUUID(), personalToken = randomUUID();
   for (let n = 0; n < 2; n++) {
     execFileSync(process.execPath, ['dist/server/migrate.js'], { cwd: dir, env: commandEnv, stdio: 'pipe' });
     for (const [file, patch] of [
       ['migrate', {MIGRATION_DATABASE_URL:url.href}],
       ['operations', {ADMIN_DATABASE_URL:url.href}],
       ['operations', {LANTERN_DB_NAME:'wrong_target'}],
     ] as const) assert.throws(() => execFileSync(process.execPath, [`dist/server/${file}.js`, 'approve-email', 'forbidden@example.test'], {cwd:dir,env:{...commandEnv,...patch},stdio:'pipe'}));
     execFileSync(process.execPath, ['dist/server/operations.js', 'approve-email', 'personal@gmail.com'], { cwd: dir, env: commandEnv, stdio: 'pipe' });
     assert.match(execFileSync(process.execPath, ['dist/server/operations.js', 'list-approved-emails'], { cwd: dir, env: commandEnv, encoding: 'utf8' }), /personal@gmail.com/);
     if (n === 0) {
       const scoped = admin;
       try {
         await scoped.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,'personal-sub','personal@gmail.com','Personal')", [personalId]);
         await scoped.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')", [createHash('sha256').update(personalToken).digest('hex'), personalId]);
       } finally { /* Fixture owns this pool. */ }
     }
     child = spawn(process.execPath, ['dist/server/index.js'], { cwd: dir, env: { ...env, LANTERN_ENV: n === 0 ? 'stage' : 'production' }, stdio: ['ignore','pipe','pipe'] });
     await new Promise<void>((resolve,reject) => { child!.once('exit', () => reject(new Error('Startup failed'))); child!.stdout!.on('data', b => { if (String(b).includes('Lantern:')) resolve(); }); });
     const origin: string = `http://127.0.0.1:${address.port}`;
     const health = await fetch(origin+'/health');
     assert.equal(health.status, 200);
     assert.equal(health.headers.get('x-lantern-schema'), '6');
     const session = await (await fetch(origin+'/api/session', { headers: { Cookie: `__Host-lantern-session=${personalToken}` } })).json() as { user: { id: string } | null };
     assert.equal(session.user?.id ?? null, personalId);
     if (n === 0) {
       await stop();
       child = spawn(process.execPath, ['dist/server/index.js'], { cwd: dir, env: { ...env, LANTERN_HOSTING_ONLY:'1', GOOGLE_CLIENT_ID:'', GOOGLE_CLIENT_SECRET:'' }, stdio: ['ignore','pipe','pipe'] });
       await new Promise<void>((resolve,reject) => { child!.once('exit', () => reject(new Error('Hosting-only startup failed'))); child!.stdout!.on('data', b => { if (String(b).includes('Lantern:')) resolve(); }); });
       const headers = { Cookie: `__Host-lantern-session=${personalToken}`, Origin: env.APP_ORIGIN };
       const locked = await (await fetch(origin+'/api/session', {headers})).json() as {user:unknown;signInAvailable:boolean;localAccess:boolean};
       assert.equal(locked.user, null, 'hosting-only must reject previously valid sessions');
       assert.equal(locked.signInAvailable, false);
       assert.equal(locked.localAccess, false);
       for (const path of ['/api/focuses', '/api/department', '/api/guide']) assert.equal((await fetch(origin+path,{headers})).status,401);
       assert.equal((await fetch(origin+'/api/focuses',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({title:'Forbidden',start:'2026-01-01',end:'2026-12-31',sections:[]})})).status,401);
       assert.equal((await fetch(origin+'/auth/google',{redirect:'manual'})).status,503);
       assert.equal((await fetch(origin+'/health')).status,200);
       await stop();
       child = spawn(process.execPath, ['dist/server/index.js'], { cwd:dir, env, stdio:['ignore','pipe','pipe'] });
       await new Promise<void>((resolve,reject) => { child!.once('exit', () => reject(new Error('Startup failed'))); child!.stdout!.on('data', b => { if (String(b).includes('Lantern:')) resolve(); }); });
       assert.equal(((await (await fetch(origin+'/api/session', {headers})).json()) as {user:{id:string}}).user.id, personalId);
       execFileSync(process.execPath, ['dist/server/operations.js', 'remove-approved-email', 'personal@gmail.com'], { cwd: dir, env: commandEnv, stdio: 'pipe' });
       const revoked = await (await fetch(origin+'/api/session', { headers: { Cookie: `__Host-lantern-session=${personalToken}` } })).json() as { user: unknown };
       assert.equal(revoked.user, null);
     }
     assert.equal(health.headers.get('x-lantern-revision'), 'a'.repeat(40));
     assert.match(await (await fetch(origin)).text(), /assets\//);
     assert.equal((await fetch(origin+'/api/focuses')).status, 401);
     if (n === 1) {
       const scoped = migration;
       try { await scoped.query('ALTER TABLE users RENAME TO unavailable_users'); }
       finally { /* Fixture owns this pool. */ }
       assert.equal((await fetch(origin+'/health')).status,503);
     }
     await stop();
   }
 } finally { await stop(); await fixture.close(); await rm(dir,{ recursive:true,force:true }); }
});
