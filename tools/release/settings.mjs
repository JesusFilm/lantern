import assert from 'node:assert/strict';
import {X509Certificate} from 'node:crypto';
import {lstatSync,readFileSync,mkdtempSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const resumeKeys=['LANTERN_ENV','LANTERN_DB_EXPECTED_ENDPOINT','LANTERN_DB_NAME','LANTERN_DB_SCHEMA','LANTERN_DB_RUNTIME_ROLE','LANTERN_DB_MIGRATION_ROLE','LANTERN_DB_ADMIN_ROLE','MIGRATION_DATABASE_URL'];
const retainedKeys=new Set([...resumeKeys,'ADMIN_DATABASE_URL','PGSSLROOTCERT','PGSSLMODE']);
const privateError='Private production settings failed validation; no retained settings changed.';

// Shared hosted target facts only. Callers retain credential and execution policy.
export function validateHostedMigrationTarget(settings,target,ca) {
 try {
  assert(['stage','production'].includes(target));
  for(const kind of ['runtime','migration','admin'])assert.equal(settings[`LANTERN_DB_${kind.toUpperCase()}_ROLE`],`lantern_${target}_${kind}`);
  assert.equal(settings.LANTERN_DB_SCHEMA,'lantern');
  assert.match(settings.LANTERN_DB_NAME??'',/^[a-z][a-z0-9_]{0,62}$/);
  const url=new URL(settings.MIGRATION_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(url.protocol));
  assert.equal(url.host,settings.LANTERN_DB_EXPECTED_ENDPOINT);
  assert(url.hostname && !url.hostname.endsWith('.railway.internal'));
  assert.equal(decodeURIComponent(url.username),settings.LANTERN_DB_MIGRATION_ROLE);
  assert.equal(decodeURIComponent(url.pathname.slice(1)),settings.LANTERN_DB_NAME);
  assert.equal(url.search,'');
  const certificate=new X509Certificate(ca);
  assert(certificate.ca && Date.parse(certificate.validFrom)<=Date.now() && Date.parse(certificate.validTo)>Date.now());
  return {url,certificate};
 } catch {throw new Error('Hosted migration target failed validation.');}
}

function productionValues(settings,ca) {
 const values=Object.fromEntries(resumeKeys.map(key=>[key,settings[key]]));
 for(const value of Object.values(values))assert(typeof value==='string' && value && !/[\x00-\x1f\x7f]/.test(value));
 assert.equal(values.LANTERN_ENV,'production');
 assert.match(values.LANTERN_DB_EXPECTED_ENDPOINT,/^[a-zA-Z0-9.-]+:[0-9]+$/);
 assert.notEqual(values.LANTERN_DB_EXPECTED_ENDPOINT,'ballast.proxy.rlwy.net:56588');
 const {url}=validateHostedMigrationTarget(values,'production',ca);
 assert(url.password);decodeURIComponent(url.password);assert.equal(url.hash,'');
 return values;
}

function checkPrivate(path,directory=false) {
 const st=lstatSync(path);
 assert(!st.isSymbolicLink() && (directory?st.isDirectory():st.isFile()));
 assert.equal(st.uid,process.getuid());
 assert.equal(st.mode&0o777,directory?0o700:0o600);
}

// Reads legacy packages too; admin credentials are retained but never resumed.
export function loadProductionSettings(directory) {
 try {
  checkPrivate(directory,true);
  for(const file of ['operator.env','root.crt'])checkPrivate(join(directory,file));
  const values={};
  for(const line of readFileSync(join(directory,'operator.env'),'utf8').split('\n')) {
   if(!line)continue;
   const split=line.indexOf('=');assert(split>0);
   const key=line.slice(0,split),value=line.slice(split+1);
   assert(retainedKeys.has(key) && !Object.hasOwn(values,key) && !/[\x00-\x1f\x7f]/.test(value));
   values[key]=value;
  }
  return productionValues(values,readFileSync(join(directory,'root.crt')));
 } catch {throw new Error(privateError);}
}

// Always creates a new package. No update/overwrite operation is exposed.
export function writeProductionSettings({settings,ca,parentDirectory=tmpdir()}) {
 let directory;
 try {
  const values=productionValues(settings,ca);
  const admin=new URL(settings.ADMIN_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(admin.protocol));
  assert.equal(admin.host,values.LANTERN_DB_EXPECTED_ENDPOINT);
  assert.equal(decodeURIComponent(admin.username),values.LANTERN_DB_ADMIN_ROLE);
  assert.equal(decodeURIComponent(admin.pathname.slice(1)),values.LANTERN_DB_NAME);
  assert(admin.password);decodeURIComponent(admin.password);
  assert.equal(admin.search,'');assert.equal(admin.hash,'');
  const parent=resolve(parentDirectory);
  assert(!/[\x00-\x1f\x7f]/.test(parent));
  directory=mkdtempSync(join(parent,'lantern-production-settings.'));
  chmodSync(directory,0o700);
  const certificatePath=join(directory,'root.crt');
  admin.searchParams.set('sslmode','verify-ca');
  admin.searchParams.set('uselibpqcompat','true');
  admin.searchParams.set('sslrootcert',certificatePath);
  const retained={...values,ADMIN_DATABASE_URL:admin.href,PGSSLROOTCERT:certificatePath,PGSSLMODE:'verify-ca'};
  writeFileSync(certificatePath,ca,{mode:0o600,flag:'wx'});
  writeFileSync(join(directory,'operator.env'),Object.entries(retained).map(([key,value])=>`${key}=${value}\n`).join(''),{mode:0o600,flag:'wx'});
  for(const file of ['root.crt','operator.env'])chmodSync(join(directory,file),0o600);
  return directory;
 } catch {
  if(directory)rmSync(directory,{recursive:true,force:true});
  throw new Error(privateError);
 }
}
