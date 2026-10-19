import {test} from 'node:test';
import {createRequire} from 'node:module';
const parserPath=createRequire(import.meta.url).resolve('pg-connection-string');
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,mkdirSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

function run(patch={},failure=false) {
 const cwd=mkdtempSync(join(tmpdir(),'lantern-migrate-test-'));
 try {
  execFileSync('git',['init','--quiet'],{cwd});
  execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','fixture'],{cwd});
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim();
  mkdirSync(join(cwd,'dist/server'),{recursive:true});
  writeFileSync(join(cwd,'dist/server/migrate.js'),`const assert=require('node:assert/strict');const fs=require('node:fs');const url=new URL(process.env.MIGRATION_DATABASE_URL);const ssl=require(${JSON.stringify(parserPath)})(url.href).ssl;assert.notEqual(ssl.rejectUnauthorized,false);assert.equal(ssl.ca,process.env.MIGRATION_DATABASE_CA);assert.equal(typeof ssl.checkServerIdentity,'function');assert.equal(fs.statSync(url.searchParams.get('sslrootcert')).mode&0o777,0o600);fs.writeFileSync('certificate-path',url.searchParams.get('sslrootcert'));fs.writeFileSync('ran',process.env.RELEASE_SHA);console.error('synthetic-private-value');process.exit(${failure?1:0});`);
  execFileSync('openssl',['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout',join(cwd,'key.pem'),'-out',join(cwd,'ca.pem'),'-days','1','-subj','/CN=synthetic-test-ca','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'pipe'});
  const env={MIGRATION_DATABASE_CA:readFileSync(join(cwd,'ca.pem'),'utf8'),PATH:process.env.PATH,RELEASE_SHA:sha,RELEASE_TARGET:'stage',MIGRATION_DATABASE_URL:'postgresql://lantern_stage_migration:synthetic-private-value@proxy.example.test:5432/railway',LANTERN_DB_EXPECTED_ENDPOINT:'proxy.example.test:5432',LANTERN_DB_NAME:'railway',LANTERN_DB_SCHEMA:'lantern',LANTERN_DB_RUNTIME_ROLE:'lantern_stage_runtime',LANTERN_DB_MIGRATION_ROLE:'lantern_stage_migration',LANTERN_DB_ADMIN_ROLE:'lantern_stage_admin',...patch};
  const result=spawnSync(process.execPath,[resolve('tools/release/migrate.mjs')],{cwd,env,encoding:'utf8'});
  return {...result,sha,certificateExists:existsSync(join(cwd,'certificate-path'))&&existsSync(readFileSync(join(cwd,'certificate-path'),'utf8')),ran:existsSync(join(cwd,'ran'))?readFileSync(join(cwd,'ran'),'utf8'):null};
 } finally {rmSync(cwd,{recursive:true,force:true});}
}
test('release migrates the exact checkout using dedicated credentials without exposing child output',()=>{
 const result=run();assert.equal(result.status,0,result.stderr);assert.equal(result.ran,result.sha);assert.equal(result.certificateExists,false);assert.doesNotMatch(result.stdout+result.stderr,/synthetic-private-value/);
});
test('release refuses wrong revisions, mixed credentials, wrong database targets and unverified TLS before connecting',()=>{
 for(const patch of [
  {MIGRATION_DATABASE_CA:'not a certificate'}, {MIGRATION_DATABASE_CA:''},
  {RELEASE_SHA:'b'.repeat(40)}, {RELEASE_TARGET:'other'}, {LANTERN_DB_EXPECTED_ENDPOINT:'other.example.test:5432'},
  {LANTERN_DB_NAME:'wrong'}, {LANTERN_DB_SCHEMA:'public'}, {LANTERN_DB_MIGRATION_ROLE:'postgres'},
  {LANTERN_DB_ADMIN_ROLE:'lantern_stage_runtime'}, {DATABASE_URL:'synthetic-private-value'}, {ADMIN_DATABASE_URL:'synthetic-private-value'},
  {BOOTSTRAP_DATABASE_URL:'synthetic-private-value'},
  ...['disable','prefer','require','verify-ca'].map(mode=>({MIGRATION_DATABASE_URL:`postgresql://lantern_stage_migration:synthetic-private-value@proxy.example.test:5432/railway?sslmode=${mode}`})),
  {MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-private-value@proxy.example.test:5432/railway'},
  {MIGRATION_DATABASE_URL:'postgresql://lantern_stage_migration:synthetic-private-value@proxy.example.test:5432/railway?options=-c%20search_path=public'},
 ]) {
  const result=run(patch);assert.equal(result.status,1,JSON.stringify(Object.keys(patch)));assert.equal(result.ran,null);assert.doesNotMatch(result.stdout+result.stderr,/synthetic-private-value/);
 }
});
test('a failed migration blocks delivery and suppresses database diagnostics',()=>{
 const result=run({},true);assert.equal(result.status,1);assert.equal(result.ran,result.sha);assert.equal(result.certificateExists,false);assert.doesNotMatch(result.stdout+result.stderr,/synthetic-private-value/);
});
test('production migrations require production roles',()=>{
 const result=run({RELEASE_TARGET:'production',LANTERN_DB_RUNTIME_ROLE:'lantern_production_runtime',LANTERN_DB_MIGRATION_ROLE:'lantern_production_migration',LANTERN_DB_ADMIN_ROLE:'lantern_production_admin',MIGRATION_DATABASE_URL:'postgresql://lantern_production_migration:synthetic-private-value@proxy.example.test:5432/railway'});
 assert.equal(result.status,0,result.stderr);assert.equal(result.ran,result.sha);
});
