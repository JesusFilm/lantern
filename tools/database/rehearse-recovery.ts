// Local synthetic-only dump/restore rehearsal. Never accepts an existing source/target DB.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { privilegeFixture } from '../../server/privilege-test-support.js';
import { migrate } from '../../server/schema.js';
import { prepareLocalAccount } from '../../server/local-access.js';
import { membership } from '../../server/membership.js';
import { focusStore } from '../../server/focus.js';
import { createApp } from '../../server/app.js';
import { inspectLegacyDatabase, transferLegacyDatabase } from '../../server/database-transition.js';
import { verifyDatabase } from '../../server/database-verification.js';

const container = process.env.LANTERN_TEST_POSTGRES_CONTAINER;
if (!container || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(container)) throw new Error('Set LANTERN_TEST_POSTGRES_CONTAINER to the local synthetic PostgreSQL container.');
const source = await privilegeFixture();
let restored: Awaited<ReturnType<typeof privilegeFixture>> | undefined;
const server = createServer();
try {
  restored = await privilegeFixture();
  await migrate(source.bootstrap);
  await source.bootstrap.query('CREATE TABLE public.allowed_domains(domain text PRIMARY KEY); ALTER TABLE public.users ADD COLUMN hosted_domain text');
  await source.bootstrap.query('DROP FUNCTION public.enroll_member(uuid,text)');
  await source.bootstrap.query('DELETE FROM public.schema_migrations WHERE version IN (3,4,5,6,7)');
  const user = await prepareLocalAccount(source.bootstrap);
  const department = (await membership(source.bootstrap,user))!;
  await focusStore(source.bootstrap).create(user,department.id,{title:'Synthetic recovery focus',start:'2026-01-01',end:'2026-12-31',sections:[]});
  await source.bootstrap.query('ALTER TABLE public.position_focuses DROP COLUMN status, DROP COLUMN confirmed_at, DROP COLUMN confirmed_by');
  await source.bootstrap.query('DROP TABLE public.department_direction');
  const owner = (await source.bootstrap.query('SELECT current_user AS name')).rows[0].name;
  const dump = spawnSync('docker',['exec',container,'pg_dump','-U',owner,'-d',source.databaseName,'--format=custom','--schema=public','--no-owner','--no-acl'],{maxBuffer:16*1024*1024});
  assert.equal(dump.status,0,'Synthetic pg_dump failed');
  // Only this freshly allocated, empty fixture's public scaffold is removed.
  await restored.bootstrap.query('DROP SCHEMA public');
  const restore = spawnSync('docker',['exec','-i',container,'pg_restore','-U',owner,'-d',restored.databaseName,'--exit-on-error','--single-transaction','--no-owner','--no-acl'],{input:dump.stdout,maxBuffer:16*1024*1024});
  assert.equal(restore.status,0,'Synthetic pg_restore failed');
  const target = {...restored.roles,expectedDatabase:restored.databaseName,sourceSchema:'public',schema:'lantern',sourceOwner:owner};
  const counts = await inspectLegacyDatabase(restored.bootstrap,target);
  assert.equal(counts.position_focuses,1);
  await transferLegacyDatabase(restored.bootstrap,target,counts);
  await migrate(restored.migration,restored.roles);
  await verifyDatabase(restored.runtime,target,'runtime');
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  server.on('request',createApp(restored.runtime,{origin,localUserId:user}));
  const response = await fetch(origin+'/api/focuses');
  assert.equal(response.status,200);
  const focuses = await response.json() as {title:string}[];
  assert.deepEqual(focuses.map(focus=>focus.title),['Synthetic recovery focus']);
  console.log('Synthetic pg_dump/pg_restore, ownership transfer, migration and restricted-runtime HTTP read passed.');
} finally {
  server.closeAllConnections();
  if (server.listening) await new Promise<void>(resolve=>server.close(()=>resolve()));
  await restored?.close(); await source.close();
}
