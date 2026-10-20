import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:https';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import express from 'express';
import { chromium } from '@playwright/test';
import { createDatabase } from '../../dist/server/database.js';
import { migrate } from '../../dist/server/schema.js';
import { createApp } from '../../dist/server/app.js';
import { smoke } from './smoke.mjs';
import { hostingSmoke } from './hosting-smoke.mjs';

test('stage smoke exercises real HTTPS/browser/PostgreSQL and refuses expired QA sessions', {timeout:60000}, async () => {
 const dir = await mkdtemp(join(tmpdir(),'lantern-smoke-'));
 const admin = createDatabase(process.env.DATABASE_URL);
 const schema = `smoke_${randomUUID().replaceAll('-','')}`;
 await admin.query(`CREATE SCHEMA ${schema}`);
 const url = new URL(process.env.DATABASE_URL); url.searchParams.set('options',`-c search_path=${schema}`);
 const db = createDatabase(url.href);
 let server;
 try {
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost'],{stdio:'pipe'});
  server = createServer({key:await readFile(join(dir,'key.pem')),cert:await readFile(join(dir,'cert.pem'))});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin = `https://127.0.0.1:${server.address().port}`;
  await migrate(db);
  await db.query("INSERT INTO approved_emails VALUES('qa@example.test')");
  const dept = randomUUID(); await db.query("INSERT INTO departments(id,name) VALUES($1,'Synthetic QA')",[dept]);
  const tokens = [randomUUID(),randomUUID()];
  for (const token of tokens) {
   const id = randomUUID();
   await db.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,'qa@example.test','Synthetic QA')",[id,id]);
   await db.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)",[id,dept]);
   await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),id]);
  }
  const sha = 'a'.repeat(40);
  const app = createApp(db,{origin,provider:{authorizationUrl:()=>'',exchange:async()=>{throw new Error('Not used');}}},{revision:sha,deployment:'isolated-test-deployment'});
  app.use(express.static('dist/client')); server.on('request',app);
  // TLS trust is injected only in this isolated fixture; the deployed CLI always uses normal verification.
  const transport = {
   fetch: (url) => new Promise((resolve,reject) => { const req=request(url,{rejectUnauthorized:false},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end(); }),
   chromium: {launch:async()=>{const b=await chromium.launch();return {newPage:()=>b.newPage({ignoreHTTPSErrors:true}),newContext:()=>b.newContext({ignoreHTTPSErrors:true}),close:()=>b.close()};}}
  };
  const env={EXPECTED_DEPLOYMENT_ID:'isolated-test-deployment',APP_ORIGIN:origin,RELEASE_SHA:sha,RELEASE_TARGET:'stage',GITHUB_RUN_ID:'123',QA_MEMBER_A_SESSION:tokens[0],QA_MEMBER_B_SESSION:tokens[1]};
  const basic = await smoke({...env,RELEASE_SMOKE_MODE:'readiness',EXPECTED_SCHEMA_VERSION:'6',QA_MEMBER_A_SESSION:undefined,QA_MEMBER_B_SESSION:undefined},transport);
  assert.equal(basic.readiness,'passed');
  const production = await smoke({...env,RELEASE_TARGET:'production',RELEASE_SMOKE_MODE:'readiness',EXPECTED_SCHEMA_VERSION:'6',QA_MEMBER_A_SESSION:undefined,QA_MEMBER_B_SESSION:undefined},transport);
  assert.equal(production.readiness,'passed');
  assert.equal(production.target,'production');
  assert.equal(production.stage,undefined);
  assert.deepEqual(await smoke(env,transport),{sha,stage:'passed',target:'stage',deployment:'isolated-test-deployment',schemaVersion:6,runId:'123'});
  await db.query('DELETE FROM sessions');
  await assert.rejects(smoke(env,transport));
  const readiness = await smoke({...env,RELEASE_SMOKE_MODE:'readiness',EXPECTED_SCHEMA_VERSION:'6'},transport);
  assert.equal(readiness.readiness,'passed');
  assert.equal(readiness.stage,undefined,'readiness must not create full acceptance evidence');
  await assert.rejects(smoke({...env,RELEASE_SMOKE_MODE:'readiness',EXPECTED_SCHEMA_VERSION:'3'},transport));
  await assert.rejects(hostingSmoke({...env,RELEASE_TARGET:'stage'},transport), /Sign-in must be disabled/);
  const locked = createApp(db,{origin,hostingOnly:true},{revision:sha,deployment:'isolated-test-deployment'});
  locked.use(express.static('dist/client'));
  server.removeAllListeners('request'); server.on('request',locked);
  const hostingEvidence = await hostingSmoke({...env,QA_MEMBER_A_SESSION:undefined,QA_MEMBER_B_SESSION:undefined},transport);
  assert.equal(hostingEvidence.hosting,'passed');
  assert.equal(hostingEvidence.stage,undefined,'hosting checks must not create promotion evidence');
  assert.equal(hostingEvidence.sha,sha);
  assert.equal(hostingEvidence.deployment,'isolated-test-deployment');
  assert.equal(hostingEvidence.authenticatedSmoke,'pending');
  await assert.rejects(hostingSmoke({...env,RELEASE_TARGET:'production'},transport));
 } finally {
  if(server) await new Promise(r=>server.close(r));
  await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); await rm(dir,{recursive:true,force:true});
 }
});
