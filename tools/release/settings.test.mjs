import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync,statSync,writeFileSync,chmodSync,renameSync,symlinkSync,chownSync,readdirSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeProductionSettings,loadProductionSettings} from './settings.mjs';

const settings={LANTERN_ENV:'production',LANTERN_DB_EXPECTED_ENDPOINT:'proxy.example.test:5432',LANTERN_DB_NAME:'railway',LANTERN_DB_SCHEMA:'lantern',LANTERN_DB_RUNTIME_ROLE:'lantern_production_runtime',LANTERN_DB_MIGRATION_ROLE:'lantern_production_migration',LANTERN_DB_ADMIN_ROLE:'lantern_production_admin',MIGRATION_DATABASE_URL:'postgresql://lantern_production_migration:synthetic%2540%3Dpassword@proxy.example.test:5432/railway',ADMIN_DATABASE_URL:'postgresql://lantern_production_admin:synthetic%2540password@proxy.example.test:5432/railway'};
function fixture(check) {
 const parent=mkdtempSync(join(tmpdir(),'lantern-settings-test-'));
 try {
  execFileSync('openssl',['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout',join(parent,'key.pem'),'-out',join(parent,'ca.pem'),'-days','1','-subj','/CN=synthetic-settings-ca','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'pipe'});
  check(parent,readFileSync(join(parent,'ca.pem'),'utf8'));
 } finally {rmSync(parent,{recursive:true,force:true});}
}
test('fresh production package resumes without changing retained bytes or URL encoding',()=>fixture((parent,ca)=>{
 const directory=writeProductionSettings({settings,ca,parentDirectory:parent});
 const before=readFileSync(join(directory,'operator.env'));
 const resumed=loadProductionSettings(directory);
 assert.equal(resumed.MIGRATION_DATABASE_URL,settings.MIGRATION_DATABASE_URL);
 assert.equal(resumed.LANTERN_ENV,'production');
 assert.equal(resumed.ADMIN_DATABASE_URL,undefined);
 assert.equal(resumed.PGSSLROOTCERT,undefined);
 assert.deepEqual(readFileSync(join(directory,'operator.env')),before);
 assert.equal(readFileSync(join(directory,'root.crt'),'utf8'),ca);
 assert.equal(statSync(directory).mode&0o777,0o700);
 for(const file of ['operator.env','root.crt'])assert.equal(statSync(join(directory,file)).mode&0o777,0o600);
 const retained=Object.fromEntries(before.toString().trimEnd().split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
 const admin=new URL(retained.ADMIN_DATABASE_URL);
 assert.equal(decodeURIComponent(admin.password),'synthetic%40password');
 assert.equal(admin.searchParams.get('sslmode'),'verify-ca');
 assert.equal(admin.searchParams.get('sslrootcert'),join(directory,'root.crt'));
 assert.equal(retained.PGSSLROOTCERT,join(directory,'root.crt'));
}));

function expectPrivateFailure(action) {
 assert.throws(action,error=>error.message==='Private production settings failed validation; no retained settings changed.' && !error.cause);
}
test('resume rejects symlinks and unsafe permissions without altering the package',()=>fixture((parent,ca)=>{
 const directory=writeProductionSettings({settings,ca,parentDirectory:parent});
 for(const path of [directory,join(directory,'operator.env'),join(directory,'root.crt')]) {
  const mode=statSync(path).mode&0o777;
  chmodSync(path,mode|0o044);
  expectPrivateFailure(()=>loadProductionSettings(directory));
  chmodSync(path,mode);
  renameSync(path,path+'.saved');symlinkSync(path+'.saved',path);
  expectPrivateFailure(()=>loadProductionSettings(directory));
  rmSync(path);renameSync(path+'.saved',path);
 }
 assert.equal(loadProductionSettings(directory).MIGRATION_DATABASE_URL,settings.MIGRATION_DATABASE_URL);
}));
test('resume rejects a package or file owned by another account',{skip:process.getuid()!==0?'requires root for synthetic chown fixture':false},()=>fixture((parent,ca)=>{
 const directory=writeProductionSettings({settings,ca,parentDirectory:parent});
 for(const path of [directory,join(directory,'operator.env'),join(directory,'root.crt')]) {
  chownSync(path,65534,65534);
  expectPrivateFailure(()=>loadProductionSettings(directory));
  chownSync(path,process.getuid(),process.getgid());
 }
}));
test('malformed resume data is rejected without secret diagnostics or retained-file writes',()=>fixture((parent,ca)=>{
 const directory=writeProductionSettings({settings,ca,parentDirectory:parent});
 const path=join(directory,'operator.env');const original=readFileSync(path,'utf8');
 for(const content of [
  original+'LANTERN_ENV=production\n',original+'UNEXPECTED=synthetic-secret\n',
  original+'missing-equals\n',original.replace('LANTERN_ENV=production','LANTERN_ENV='),
  original.replace('railway\n','railway\r\n'),original+'PGSSLMODE=bad\x00value\n',
 ]) {
  writeFileSync(path,content);
  expectPrivateFailure(()=>loadProductionSettings(directory));
  assert.equal(readFileSync(path,'utf8'),content);
 }
}));
test('invalid fresh inputs leave no package and do not expose values',()=>fixture((parent,ca)=>{
 const before=readdirSync(parent);
 for(const patch of [
  {LANTERN_ENV:'stage'}, {LANTERN_DB_EXPECTED_ENDPOINT:'ballast.proxy.rlwy.net:56588'},
  {LANTERN_DB_RUNTIME_ROLE:'postgres'}, {LANTERN_DB_ADMIN_ROLE:'postgres'},
  {MIGRATION_DATABASE_URL:settings.MIGRATION_DATABASE_URL+'#synthetic-secret'},
  {MIGRATION_DATABASE_URL:settings.MIGRATION_DATABASE_URL.replace('synthetic%2540%3Dpassword','')},
  {MIGRATION_DATABASE_URL:settings.MIGRATION_DATABASE_URL.replace('synthetic%2540%3Dpassword','%ZZ')},
  {ADMIN_DATABASE_URL:'synthetic-secret'},
 ])expectPrivateFailure(()=>writeProductionSettings({settings:{...settings,...patch},ca,parentDirectory:parent}));
 expectPrivateFailure(()=>writeProductionSettings({settings,ca:'synthetic-secret',parentDirectory:parent}));
 assert.deepEqual(readdirSync(parent),before);
}));
test('write and resume command adapters round trip a package without emitting admin credentials',()=>fixture((parent,ca)=>{
 const command=new URL('./settings-command.mjs',import.meta.url).pathname;
 const result=spawnSync(process.execPath,[command,'write'],{env:{...settings,SETUP_CA:join(parent,'ca.pem'),TMPDIR:parent},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const directory=result.stdout.trim();assert.equal(directory.startsWith(parent+'/lantern-production-settings.'),true);
 const resumed=spawnSync(process.execPath,[command,'load'],{env:{RESUME_DIR:directory},encoding:'utf8'});
 assert.equal(resumed.status,0,resumed.stderr);
 assert.match(resumed.stdout,/MIGRATION_DATABASE_URL=postgresql:/);
 assert.doesNotMatch(resumed.stdout,/ADMIN_DATABASE_URL|PGSSLROOTCERT|lantern_production_admin:/);
 const rejected=spawnSync(process.execPath,[command,'write'],{env:{...settings,SETUP_CA:join(parent,'missing')},encoding:'utf8'});
 assert.equal(rejected.status,1);assert.equal(rejected.stdout,'');assert.doesNotMatch(rejected.stderr,/synthetic|postgresql:/);
}));
test('resume rejects certificates outside their validity window',t=>fixture((parent,ca)=>{
 const directory=writeProductionSettings({settings,ca,parentDirectory:parent});
 t.mock.timers.enable({apis:['Date'],now:0});
 expectPrivateFailure(()=>loadProductionSettings(directory));
 t.mock.timers.setTime(8640000000000000);
 expectPrivateFailure(()=>loadProductionSettings(directory));
 t.mock.timers.reset();
}));
test('resume rejects certificates that are not CAs',()=>fixture((parent,ca)=>{
 const directory=writeProductionSettings({settings,ca,parentDirectory:parent});
 execFileSync('openssl',['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:prime256v1','-nodes','-keyout',join(parent,'key.pem'),'-out',join(directory,'root.crt'),'-days','1','-subj','/CN=synthetic-invalid-ca','-addext','basicConstraints=critical,CA:FALSE'],{stdio:'pipe'});
 expectPrivateFailure(()=>loadProductionSettings(directory));
}));
test('fresh packages remain resumable under a restrictive owner umask',()=>fixture((parent,ca)=>{
 const previous=process.umask(0o777);
 let directory;
 try {directory=writeProductionSettings({settings,ca,parentDirectory:parent});}
 finally {process.umask(previous);}
 assert.equal(loadProductionSettings(directory).MIGRATION_DATABASE_URL,settings.MIGRATION_DATABASE_URL);
}));
test('package paths containing control characters cannot corrupt retained records',()=>fixture((parent,ca)=>{
 const unsafe=join(parent,'unsafe\npath');
 mkdirSync(unsafe);
 expectPrivateFailure(()=>writeProductionSettings({settings,ca,parentDirectory:unsafe}));
 assert.deepEqual(readdirSync(unsafe),[]);
}));
