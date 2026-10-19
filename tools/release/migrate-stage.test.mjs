import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRunner,validateTarget,migrationComplete,run} from './migrate-stage.mjs';
const env={RELEASE_TARGET:'stage',RAILWAY_PROJECT:'9a445065-bde0-4184-bdb8-4161b033cc8f',RAILWAY_ENVIRONMENT:'8e19675b-08a2-4bfb-9762-fd6d8561fcfd',RAILWAY_MIGRATION_SERVICE:'11111111-1111-4111-8111-111111111111',RAILWAY_SERVICE:'22222222-2222-4222-8222-222222222222',RAILWAY_TOKEN:'synthetic',RELEASE_SHA:'a'.repeat(40)};
const config={data:{environment:{id:env.RAILWAY_ENVIRONMENT,name:'staging',projectId:env.RAILWAY_PROJECT,deploymentTriggers:{edges:[],pageInfo:{hasNextPage:false}}},serviceInstance:{serviceId:env.RAILWAY_MIGRATION_SERVICE,environmentId:env.RAILWAY_ENVIRONMENT,railwayConfigFile:null,startCommand:'node dist/server/stage-migration.js',preDeployCommand:null,healthcheckPath:null,restartPolicyType:'NEVER',cronSchedule:null,source:null}}};
const vars={LANTERN_ENV:'stage',LANTERN_DB_MIGRATION_ROLE:'lantern_stage_migration',LANTERN_DB_RUNTIME_ROLE:'lantern_stage_runtime',LANTERN_DB_ADMIN_ROLE:'lantern_stage_admin',MIGRATION_DATABASE_URL:'postgresql://lantern_stage_migration:synthetic@postgres.railway.internal:5432/railway',LANTERN_DB_EXPECTED_ENDPOINT:'postgres.railway.internal:5432',LANTERN_DB_NAME:'railway',LANTERN_DB_SCHEMA:'lantern'};
test('private migration runner rejects wrong targets, privileges and command drift',()=>{
 assert.doesNotThrow(()=>validateRunner(config,vars,env));
 for(const triggers of [{edges:[{node:{serviceId:env.RAILWAY_MIGRATION_SERVICE}}],pageInfo:{hasNextPage:false}},{edges:[],pageInfo:{hasNextPage:true}}]) assert.throws(()=>validateRunner({...config,data:{...config.data,environment:{...config.data.environment,deploymentTriggers:triggers}}},vars,env));
 for(const patch of [{RELEASE_TARGET:'production'},{RAILWAY_ENVIRONMENT:'other'},{RAILWAY_PROJECT:'other'},{RAILWAY_MIGRATION_SERVICE:env.RAILWAY_SERVICE},{RAILWAY_API_TOKEN:'account'}]) assert.throws(()=>validateTarget({...env,...patch}));
 for(const patch of [{ADMIN_DATABASE_URL:'forbidden'},{DATABASE_URL:'forbidden'},{LANTERN_ENV:'production'},{MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic@postgres.railway.internal:5432/railway'},{LANTERN_DB_EXPECTED_ENDPOINT:'other:5432'}]) assert.throws(()=>validateRunner(config,{...vars,...patch},env));
 for(const patch of [{railwayConfigFile:'/railway.migration.json'},{railwayConfigFile:'/railway.json'},{startCommand:'node dist/server/index.js'},{restartPolicyType:'ON_FAILURE'},{source:{repo:'unexpected'}}]) assert.throws(()=>validateRunner({...config,data:{...config.data,serviceInstance:{...config.data.serviceInstance,...patch}}},vars,env));
});
test('migration requires a completion marker for the exact source revision',()=>{
 assert.ok(migrationComplete(JSON.stringify({message:`LANTERN_STAGE_MIGRATION_COMPLETE:${env.RELEASE_SHA}`}),env.RELEASE_SHA));
 assert.equal(migrationComplete(JSON.stringify({message:`LANTERN_STAGE_MIGRATION_COMPLETE:${'b'.repeat(40)}`}),env.RELEASE_SHA),false);
 assert.equal(migrationComplete('{"message":"Service started"}',env.RELEASE_SHA),false);
});

test('migration upload and completion checks stay pinned to the runner and receipt',async()=>{
 const id='33333333-3333-4333-8333-333333333333';
 const calls=[];
 const call=args=>{
  calls.push(args);
  if(args[0]==='api') return JSON.stringify(config);
  if(args[0]==='variables') return JSON.stringify(vars);
  if(args[0]==='up') return JSON.stringify({status:'success',serviceId:env.RAILWAY_MIGRATION_SERVICE,environmentId:env.RAILWAY_ENVIRONMENT,deploymentId:id});
  assert.equal(args[0],'logs');assert.equal(args[1],id);
  return JSON.stringify({message:`LANTERN_STAGE_MIGRATION_COMPLETE:${env.RELEASE_SHA}`});
 };
 await run(env,{call,prepare:()=>({path:"/tmp/synthetic-runner",cleanup:()=>{}}),attempts:1,wait:async()=>{}});
 const upload=calls.find(args=>args[0]==='up');assert.equal(upload[upload.indexOf('--service')+1],env.RAILWAY_MIGRATION_SERVICE);
 assert.equal(upload[upload.indexOf('--message')+1],env.RELEASE_SHA);
 await assert.rejects(run(env,{prepare:()=>({path:'/tmp/synthetic-runner',cleanup:()=>{}}),call:args=>args[0]==='logs' ? '{"message":"started"}' : call(args),attempts:1,wait:async()=>{}}),/No completion marker/);
 await assert.rejects(run({...env,RELEASE_TARGET:'production'},{call:()=>assert.fail('must reject before provider access')}));
});

test('migration upload uses committed source and excludes app provider configuration',async()=>{
 const {prepareUpload}=await import('./migrate-stage.mjs');
 const {execFileSync}=await import('node:child_process');
 const {existsSync,readFileSync}=await import('node:fs');
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const upload=prepareUpload(sha);
 try {
  assert.equal(existsSync(upload.path+'/railway.json'),false);
  assert.equal(existsSync(upload.path+'/.env'),false);
  assert.equal(existsSync(upload.path+'/server/stage-migration.ts'),true);
  assert.deepEqual(JSON.parse(readFileSync(upload.path+'/release.json','utf8')),{sha});
 } finally {upload.cleanup();}
 assert.equal(existsSync(upload.path),false);
 assert.throws(()=>prepareUpload('0'.repeat(40)));
});
