import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { createDatabase } from './database.js';
test('production-only package migrates, starts without dotenv, serves assets and fails closed on missing schema', { timeout: 90000 }, async () => {
 const dir = await mkdtemp(join(tmpdir(), 'lantern-runtime-'));
 const admin = createDatabase(process.env.DATABASE_URL!);
 const schema = `hosted_${randomUUID().replaceAll('-', '')}`;
 await admin.query(`CREATE SCHEMA ${schema}`);
 const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('options', `-c search_path=${schema}`);
 const socket = createServer(); await new Promise<void>(r => socket.listen(0, '127.0.0.1', r));
 const address = socket.address(); assert.ok(address && typeof address !== 'string');
 await new Promise<void>(r => socket.close(() => r()));
 const env = { ...process.env, DATABASE_URL: url.href, NODE_ENV: 'production', LANTERN_ENV: 'stage', LOCAL_ACCESS: '0', HOST: '127.0.0.1', PORT: String(address.port), APP_ORIGIN: 'https://stage.example.test', GOOGLE_CLIENT_ID: 'synthetic', GOOGLE_CLIENT_SECRET: 'synthetic' };
 let child: ReturnType<typeof spawn> | undefined;
 async function stop() { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } child = undefined; }
 try {
   for (const file of ['dist', 'package.json', 'package-lock.json']) await cp(file, join(dir,file), { recursive: true });
   execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: dir, stdio: 'pipe' });
   await writeFile(join(dir,'release.json'), JSON.stringify({sha:'a'.repeat(40)}));
   assert.throws(() => execFileSync(process.execPath, ['dist/server/index.js'], { cwd: dir, env, stdio: 'pipe' }));
   for (const patch of [{LOCAL_ACCESS:'1'}, {GOOGLE_CLIENT_SECRET:''}, {LANTERN_ENV:'typo'}, {APP_ORIGIN:'http://localhost:4391'}]) assert.throws(() => execFileSync(process.execPath, ['dist/server/index.js'], {cwd:dir,env:{...env,...patch},stdio:'pipe'}));
   for (let n = 0; n < 2; n++) {
     execFileSync(process.execPath, ['dist/server/migrate.js'], { cwd: dir, env, stdio: 'pipe' });
     execFileSync(process.execPath, ['dist/server/operations.js', 'domains', 'example.test'], { cwd: dir, env, stdio: 'pipe' });
     child = spawn(process.execPath, ['dist/server/index.js'], { cwd: dir, env, stdio: ['ignore','pipe','pipe'] });
     await new Promise<void>((resolve,reject) => { child!.once('exit', () => reject(new Error('Startup failed'))); child!.stdout!.on('data', b => { if (String(b).includes('Lantern:')) resolve(); }); });
     const origin: string = `http://127.0.0.1:${address.port}`;
     const health = await fetch(origin+'/health');
     assert.equal(health.status, 200);
     assert.equal(health.headers.get('x-lantern-revision'), 'a'.repeat(40));
     assert.match(await (await fetch(origin)).text(), /assets\//);
     assert.equal((await fetch(origin+'/api/focuses')).status, 401);
     if (n === 1) {
       const scoped = createDatabase(url.href);
       try { await scoped.query('ALTER TABLE users RENAME TO unavailable_users'); }
       finally { await scoped.end(); }
       assert.equal((await fetch(origin+'/health')).status,503);
     }
     await stop();
   }
 } finally { await stop(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); await rm(dir,{ recursive:true,force:true }); }
});
