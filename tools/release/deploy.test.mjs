import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const project='11111111-1111-4111-8111-111111111111',environment='22222222-2222-4222-8222-222222222222',service='33333333-3333-4333-8333-333333333333';
const settings={data:{environment:{id:environment,projectId:project,name:'staging',deploymentTriggers:{edges:[],pageInfo:{hasNextPage:false}}},serviceInstance:{environmentId:environment,serviceId:service,builder:'RAILPACK',dockerfilePath:null,buildCommand:null,startCommand:'node dist/server/index.js',preDeployCommand:[],healthcheckPath:'/health',healthcheckTimeout:120,restartPolicyType:'ON_FAILURE',restartPolicyMaxRetries:3,rootDirectory:null,cronSchedule:null,railwayConfigFile:null,source:{repo:null,image:null}}}};
const variables={LANTERN_ENV:'stage',NODE_ENV:'production',LOCAL_ACCESS:'0',LANTERN_HOSTING_ONLY:'0',DATABASE_URL:'postgresql://lantern_stage_runtime:do-not-print-secret@postgres.railway.internal:5432/railway',GOOGLE_CLIENT_ID:'do-not-print-client',GOOGLE_CLIENT_SECRET:'do-not-print-secret',APP_ORIGIN:'https://stage.example.com',HOST:'0.0.0.0'};
function run(config=settings,vars=variables,extraEnv={},script='deploy.mjs'){
 const dir=mkdtempSync(join(tmpdir(),'lantern-deploy-test-'));
 try{
 writeFileSync(join(dir,'fixture.json'),JSON.stringify({config,vars}));writeFileSync(join(dir,'calls.jsonl'),'');
 writeFileSync(join(dir,'railway'),`#!/usr/bin/env node\nconst fs=require('node:fs');const path=require('node:path');const dir=__dirname;const args=process.argv.slice(2);fs.appendFileSync(path.join(dir,'calls.jsonl'),JSON.stringify(args)+'\\n');const f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json')));if(args[0]==='api')console.log(JSON.stringify(f.config));else if(args[0]==='variables')console.log(JSON.stringify(f.vars));else if(args[0]==='up')console.log(JSON.stringify({status:'success',serviceId:'${service}',environmentId:'${environment}',deploymentId:'44444444-4444-4444-8444-444444444444'}));else process.exit(2);`,{mode:0o755});
 const result=spawnSync(process.execPath,[resolve('tools/release/'+script)],{encoding:'utf8',env:{PATH:dir+':'+process.env.PATH,RAILWAY_TOKEN:'fixture-token',RAILWAY_PROJECT:project,RAILWAY_ENVIRONMENT:environment,RAILWAY_SERVICE:service,RELEASE_TARGET:'stage',LANTERN_DB_RUNTIME_ROLE:'lantern_stage_runtime',APP_ORIGIN:'https://stage.example.com',RELEASE_SHA:'a'.repeat(40),GITHUB_ENV:join(dir,'github-env'),...extraEnv}});
 const calls=readFileSync(join(dir,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 return {...result,calls};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('deployment refuses missing hosted healthcheck before uploading source',()=>{
 const config=structuredClone(settings);config.data.serviceInstance.healthcheckPath=null;
 const result=run(config);assert.equal(result.status,1);assert.ok(!result.calls.some(c=>c[0]==='up'));assert.doesNotMatch(result.stdout+result.stderr,/do-not-print/);
});
test('deployment rejects drift, ambiguous targets and privileged runtime configuration without upload or secret output',()=>{
 const cases=[
  c=>{c.data.environment.projectId=service;},
  c=>{c.data.environment.name='production';},
  c=>{c.data.serviceInstance.serviceId=environment;},
  c=>{c.data.serviceInstance.preDeployCommand=['node dist/server/migrate.js'];},
  c=>{c.data.serviceInstance.startCommand='npm run db:migrate && npm start';},
  c=>{c.data.serviceInstance.healthcheckTimeout=0;},
  c=>{c.data.serviceInstance.restartPolicyType='ALWAYS';},
  c=>{c.data.serviceInstance.restartPolicyMaxRetries=10;},
  c=>{c.data.serviceInstance.buildCommand='echo override';},
  c=>{c.data.serviceInstance.dockerfilePath='OtherDockerfile';},
  c=>{c.data.serviceInstance.builder='NIXPACKS';},
  c=>{c.data.serviceInstance.rootDirectory='/other';},
  c=>{c.data.serviceInstance.railwayConfigFile='other.json';},
  c=>{c.data.serviceInstance.cronSchedule='* * * * *';},
  c=>{c.data.serviceInstance.source.repo='owner/repo';},
  c=>{c.data.serviceInstance.source.image='image:latest';},
  c=>{c.data.environment.deploymentTriggers.edges=[{node:{serviceId:service}}];},
  c=>{c.data.environment.deploymentTriggers.pageInfo.hasNextPage=true;},
  c=>{c.errors=[{message:'do-not-print-secret'}];},
  c=>{delete c.data.serviceInstance.source;},
 ];
 for(const change of cases){const config=structuredClone(settings);change(config);const result=run(config);assert.equal(result.status,1,change.toString());assert.ok(!result.calls.some(c=>c[0]==='up'));assert.doesNotMatch(result.stdout+result.stderr,/do-not-print/);}
 for(const patch of [{LANTERN_ENV:'production'},{LOCAL_ACCESS:'1'},{LANTERN_HOSTING_ONLY:'1'},{NODE_ENV:'development'},{APP_ORIGIN:'https://wrong.example.com'},{DATABASE_URL:'postgresql://postgres:do-not-print-secret@postgres.railway.internal/railway'},{MIGRATION_DATABASE_URL:'do-not-print-secret'},{ADMIN_DATABASE_URL:'do-not-print-secret'},{BOOTSTRAP_DATABASE_URL:'do-not-print-secret'},{GOOGLE_CLIENT_SECRET:null}]){
  const result=run(settings,{...variables,...patch});assert.equal(result.status,1);assert.ok(!result.calls.some(c=>c[0]==='up'));assert.doesNotMatch(result.stdout+result.stderr,/do-not-print/);
 }
 for(const patch of [{RAILWAY_PROJECT:''},{RELEASE_TARGET:'unknown'},{RAILWAY_API_TOKEN:'do-not-print-secret'}]){const result=run(settings,variables,patch);assert.equal(result.status,1);assert.ok(!result.calls.some(c=>c[0]==='up'));}
});
test('verified settings permit an explicitly targeted upload and keep the read-only check non-deploying',()=>{
 const result=run();assert.equal(result.status,0,result.stderr);const up=result.calls.find(c=>c[0]==='up');assert.ok(up.includes('--project'));assert.ok(up.includes(project));assert.doesNotMatch(result.stdout+result.stderr,/do-not-print/);
});

test('standalone configuration check never uploads and fails closed on provider errors',()=>{
 for(const config of [settings,{errors:[{message:'do-not-print-secret'}]},{}]){
  const result=run(config,variables,{},'configuration.mjs');
  assert.equal(result.status,config===settings?0:1);
  assert.ok(!result.calls.some(c=>c[0]==='up'));
  assert.doesNotMatch(result.stdout+result.stderr,/do-not-print/);
 }
});

test('provider null source is accepted as no independent integration',()=>{const config=structuredClone(settings);config.data.serviceInstance.source=null;const result=run(config,variables,{},'configuration.mjs');assert.equal(result.status,0,result.stderr);});
