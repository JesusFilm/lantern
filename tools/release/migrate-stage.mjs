import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {queueDeployment} from './upload.mjs';

const stage='8e19675b-08a2-4bfb-9762-fd6d8561fcfd';
const project='9a445065-bde0-4184-bdb8-4161b033cc8f';
const query=`query($environment:String!,$service:String!){environment(id:$environment){id name projectId deploymentTriggers(first:100){edges{node{serviceId}} pageInfo{hasNextPage}}} serviceInstance(environmentId:$environment,serviceId:$service){serviceId environmentId railwayConfigFile startCommand preDeployCommand healthcheckPath restartPolicyType cronSchedule source{repo image}}}`;
export function validateTarget(env) {
 assert.equal(env.RELEASE_TARGET,'stage');
 assert.equal(env.RAILWAY_ENVIRONMENT,stage);
 assert.equal(env.RAILWAY_PROJECT,project);
 assert.match(env.RAILWAY_MIGRATION_SERVICE??'',/^[a-f0-9-]{36}$/);
 assert.notEqual(env.RAILWAY_MIGRATION_SERVICE,env.RAILWAY_SERVICE);
 assert.match(env.RELEASE_SHA??'',/^[a-f0-9]{40}$/);
 assert.ok(env.RAILWAY_TOKEN && !env.RAILWAY_API_TOKEN);
}
export function validateRunner(config,vars,env) {
 validateTarget(env);
 assert.ok(!config.errors?.length);
 const e=config.data?.environment,s=config.data?.serviceInstance;
 assert.equal(e?.id,stage);assert.equal(e?.name,'staging');assert.equal(e?.projectId,project);
 assert.equal(e.deploymentTriggers?.pageInfo?.hasNextPage,false);
 assert.ok(Array.isArray(e.deploymentTriggers?.edges));
 assert.ok(e.deploymentTriggers.edges.every(edge=>typeof edge.node?.serviceId==='string' && edge.node.serviceId!==env.RAILWAY_MIGRATION_SERVICE));
 assert.equal(s?.serviceId,env.RAILWAY_MIGRATION_SERVICE);assert.equal(s?.environmentId,stage);
 assert.equal(s?.railwayConfigFile,null);
 assert.equal(s?.startCommand,'node dist/server/stage-migration.js');
 assert.ok(s.preDeployCommand==null || (Array.isArray(s.preDeployCommand)&&s.preDeployCommand.length===0));
 assert.equal(s.healthcheckPath,null);assert.equal(s.restartPolicyType,'NEVER');assert.equal(s.cronSchedule,null);
 assert.ok(!s.source || (!s.source.repo && !s.source.image));
 assert.equal(vars.LANTERN_ENV,'stage');
 assert.equal(vars.LANTERN_DB_MIGRATION_ROLE,'lantern_stage_migration');
 assert.equal(vars.LANTERN_DB_RUNTIME_ROLE,'lantern_stage_runtime');
 assert.equal(vars.LANTERN_DB_ADMIN_ROLE,'lantern_stage_admin');
 for(const name of ['DATABASE_URL','ADMIN_DATABASE_URL','BOOTSTRAP_DATABASE_URL']) assert.ok(!(name in vars));
 const url=new URL(vars.MIGRATION_DATABASE_URL);
 assert.equal(decodeURIComponent(url.username),'lantern_stage_migration');
 assert.ok(url.hostname.endsWith('.railway.internal'));
 assert.equal(url.host,vars.LANTERN_DB_EXPECTED_ENDPOINT);
 assert.equal(url.pathname.slice(1),vars.LANTERN_DB_NAME);
 assert.equal(vars.LANTERN_DB_SCHEMA,'lantern');
}
export function migrationComplete(logs,sha) {
 return logs.trim().split('\n').some(line=>{
  try {return JSON.parse(line).message===`LANTERN_STAGE_MIGRATION_COMPLETE:${sha}`;} catch {return false;}
 });
}
// Build an upload from the exact commit, without the web app's provider config.
export function prepareUpload(sha, cwd=process.cwd()) {
 assert.match(sha,/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8'}).trim(),sha);
 const path=mkdtempSync(join(tmpdir(),'lantern-migration-'));
 const cleanup=()=>rmSync(path,{recursive:true,force:true});
 try {
  const archive=execFileSync('git',['archive','--format=tar',sha],{cwd,maxBuffer:50*1024*1024});
  execFileSync('tar',['-xf','-','-C',path],{input:archive});
  for(const config of ['railway.json','railway.toml','.railway']) rmSync(join(path,config),{recursive:true,force:true});
  writeFileSync(join(path,'release.json'),JSON.stringify({sha})+'\n');
  return {path,cleanup};
 } catch(error) {cleanup();throw error;}
}
export async function run(env, {call = args=>execFileSync('railway',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:12*60*1000,maxBuffer:50*1024*1024}), wait = ()=>new Promise(resolve=>setTimeout(resolve,2000)), attempts=360, prepare=prepareUpload} = {}) {
 validateTarget(env);
 const {RAILWAY_ENVIRONMENT:environment,RAILWAY_MIGRATION_SERVICE:service}=env;
 const config=JSON.parse(call(['api','--compact','--variables',JSON.stringify({environment,service}),query]));
 const vars=JSON.parse(call(['variables','--json','--project',project,'--environment',environment,'--service',service]));
 validateRunner(config,vars,env);
 const upload=prepare(env.RELEASE_SHA);
 try {
 const deployment=queueDeployment(call,[upload.path,'--path-as-root','--project',project,'--environment',environment,'--service',service,'--message',env.RELEASE_SHA],service,environment);
 // Deploy readiness alone does not prove the one-shot migration committed.
 for(let i=0;i<attempts;i++) {
  const logs=call(['logs',deployment,'--json','--lines','100','--project',project,'--environment',environment,'--service',service]);
  if(migrationComplete(logs,env.RELEASE_SHA)) {console.log('Exact-revision staging migration completed.');return;}
  await wait();
 }
 throw new Error('No completion marker');
 } finally {upload.cleanup();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {await run(process.env);} catch {console.error('Staging migration runner failed or completion was not verified; application upload blocked.');process.exitCode=1;}
}
