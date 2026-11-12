import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Exercise the same command adapter as the wizard, never the interactive setup.
const command=new URL('./settings-command.mjs',import.meta.url);
const settings={LANTERN_ENV:'production',LANTERN_DB_EXPECTED_ENDPOINT:'proxy.example.test:5432',LANTERN_DB_NAME:'railway',LANTERN_DB_SCHEMA:'lantern',LANTERN_DB_RUNTIME_ROLE:'lantern_production_runtime',LANTERN_DB_MIGRATION_ROLE:'lantern_production_migration',LANTERN_DB_ADMIN_ROLE:'lantern_production_admin',MIGRATION_DATABASE_URL:'postgresql://lantern_production_migration:synthetic%2540password@proxy.example.test:5432/railway',ADMIN_DATABASE_URL:'ignored-private-admin-value',PGSSLROOTCERT:'/old/path/root.crt',PGSSLMODE:'verify-ca'};
function fixture(check) {
 const dir=mkdtempSync(join(tmpdir(),'lantern-resume-test-'));chmodSync(dir,0o700);
 try {
  execFileSync('openssl',['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'root.crt'),'-days','1','-subj','/CN=synthetic-resume-test-ca','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'pipe'});
  chmodSync(join(dir,'root.crt'),0o600);
  const run=(patch={},suffix='')=>{
   writeFileSync(join(dir,'operator.env'),Object.entries({...settings,...patch}).map(([key,value])=>`${key}=${value}\n`).join('')+suffix,{mode:0o600});
   return spawnSync(process.execPath,[fileURLToPath(command),'load'],{env:{RESUME_DIR:dir},encoding:'utf8'});
  };
  check(run,dir);
 } finally {rmSync(dir,{recursive:true,force:true});}
}
test('resume imports migration settings as data and leaves retained files unchanged',()=>fixture((run,dir)=>{
 const ca=readFileSync(join(dir,'root.crt'));
 const result=run();assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/MIGRATION_DATABASE_URL=postgresql:/);
 assert.doesNotMatch(result.stdout,/ADMIN_DATABASE_URL|ignored-private-admin-value|PGSSLROOTCERT/);
 assert.equal(readFileSync(join(dir,'operator.env'),'utf8'),Object.entries(settings).map(([k,v])=>`${k}=${v}\n`).join(''));
 assert.deepEqual(readFileSync(join(dir,'root.crt')),ca);
}));
test('resume rejects wrong targets, malformed files and unsafe permissions without exposing settings',()=>fixture((run,dir)=>{
 for(const patch of [
  {LANTERN_ENV:'stage'}, {LANTERN_DB_SCHEMA:'public'}, {LANTERN_DB_RUNTIME_ROLE:'postgres'},
  {LANTERN_DB_EXPECTED_ENDPOINT:'other.example.test:5432'}, {LANTERN_DB_NAME:'other'},
  {MIGRATION_DATABASE_URL:settings.MIGRATION_DATABASE_URL+'?sslmode=disable'},
  {MIGRATION_DATABASE_URL:settings.MIGRATION_DATABASE_URL.replace('lantern_production_migration','postgres')},
  {MIGRATION_DATABASE_URL:''}, {PATH:'$(touch should-never-run)'},
 ]) {
  const result=run(patch);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.doesNotMatch(result.stderr,/synthetic|postgresql:|ignored-private/);
 }
 assert.equal(run({},'LANTERN_ENV=production\n').status,1);
 chmodSync(join(dir,'operator.env'),0o644);assert.equal(run().status,1);
 chmodSync(join(dir,'operator.env'),0o600);
 writeFileSync(join(dir,'root.crt'),'invalid certificate');assert.equal(run().status,1);
}));

test('empty resume path fails before entering interactive setup',()=>{
 const result=spawnSync('bash',['tools/release/setup-production.sh','--resume-config',''],{encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/Usage:/);assert.doesNotMatch(result.stdout,/Stage/);
});

// Run only the local preflight, never the human-only wizard or its integrations.
test('setup preflight rejects vulnerable Node 24 before any external interface',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lantern-node-preflight-'));
 try {
  const source=readFileSync(new URL('./setup-production.sh',import.meta.url),'utf8');
  const preflight=source.slice(source.indexOf('for command in git node npm gh railway psql openssl;'),source.indexOf('gh auth status',source.indexOf('for command in git node npm gh railway psql openssl;')));
  assert.ok(preflight.length>0);
  writeFileSync(join(dir,'version.cjs'),`Object.defineProperty(process.versions,'node',{value:process.env.TEST_NODE_VERSION});`);
  writeFileSync(join(dir,'node'),`#!/bin/sh
exec '${process.execPath}' --require '${join(dir,'version.cjs')}' "$@"
`,{mode:0o700});
  for(const name of ['gh','railway','psql']) writeFileSync(join(dir,name),'#!/bin/sh\nexit 99\n',{mode:0o700});
  writeFileSync(join(dir,'git'),'#!/bin/sh\nprintf dirty\n',{mode:0o700});
  for(const [version,accepted] of [['24.21.0',false],['24.22.2',false],['24.22.3',true],['24.22.4',true],['24.23.0',true],['24.100.0',true],['22.23.5',false],['26.13.1',false]]) {
   const result=spawnSync('bash',['-c',`fail() { echo "$1"; exit 1; }; ROOT=.; ${preflight}`],{encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,TEST_NODE_VERSION:version}});
   assert.equal(result.status,1,version);
   assert.match(result.stdout,accepted?/Use a clean repository checkout/:/Use Node 24\.22\.3 or later patched Node 24/,version);
  }
 } finally {rmSync(dir,{recursive:true,force:true});}
});
