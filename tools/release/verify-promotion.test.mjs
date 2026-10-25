import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createServer} from 'node:https';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const script=resolve('tools/release/verify-promotion.mjs');
function command(file,args,options={}) {
 return new Promise(resolve=>{
  const child=spawn(file,args,{...options,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
  child.on('close',status=>resolve({status,stdout,stderr}));
 });
}

test('promotion command binds acceptance to its triggering attempt, current main and both live environments', {timeout:30000}, async t=>{
 const dir=mkdtempSync(join(tmpdir(),'lantern-promotion-'));
 const work=join(dir,'work'),bin=join(dir,'bin');
 mkdirSync(work);mkdirSync(bin);
 const git=(args,cwd=work)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const servers=[];
 try {
  git(['init','--bare',join(dir,'origin')]);
  git(['init','--initial-branch=main']);
  git(['config','user.name','Synthetic Release Test']);
  git(['config','user.email','release@example.test']);
  git(['remote','add','origin',join(dir,'origin')]);
  git(['commit','--allow-empty','-m','Synthetic candidate']);
  git(['push','--set-upstream','origin','main']);
  const sha=git(['rev-parse','HEAD']);
  const run={id:123,run_attempt:2,head_sha:sha,event:'push',head_branch:'main',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',repository:{full_name:'JesusFilm/lantern'}};
  const evidence={sha,readiness:'passed',target:'stage',deployment:'stage-deployment',runId:'123',runAttempt:2,schemaVersion:8,acceptance:'passed',cleanup:'passed',acceptanceSuiteVersion:1};
  const baseJob={run_id:123,run_attempt:2,head_sha:sha,status:'completed',conclusion:'success',started_at:'2026-10-20T10:00:00Z',completed_at:'2026-10-20T10:10:00Z'};
  const steps=['Enforce exact revision and successful checks','Run npm run build','Verify staging configuration before migrations','Apply exact-revision schema migrations','Upload the checked source revision','Verify deployed revision, schema, login and anonymous denial'].map((name,i)=>({name,number:i+1,status:'completed',conclusion:'success',completed_at:'2026-10-20T10:05:00Z'}));
  const jobs=['typecheck','PostgreSQL HTTP and browser tests','production build'].map(name=>({...baseJob,name}));
  jobs.push({...baseJob,name:'stage delivery and smoke',steps});
  const artifact={name:`stage-readiness-${sha}-123-2`,expired:false,created_at:'2026-10-20T10:06:00Z',workflow_run:{id:123,head_sha:sha}};
  const eventPath=join(dir,'event.json'),dataPath=join(dir,'github.json'),output=join(dir,'github-env');
  const save=(patch={})=>{
   writeFileSync(eventPath,JSON.stringify({workflow_run:run}));
   writeFileSync(dataPath,JSON.stringify({run,evidence,jobs,artifacts:[artifact],...patch}));
   writeFileSync(output,'');
  };
  save();
  writeFileSync(join(bin,'gh'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const data=JSON.parse(fs.readFileSync(process.env.FIXTURE_GITHUB));
const args=process.argv.slice(2);
if(args[0]==='api'){
 let response;
 if(args[1].includes('/workflows/ci.yml/runs?')) response={workflow_runs:args[1].includes('status=success') && data.run.conclusion!=='success'?[]:[data.run]};
 else if(args[1].includes('/runs/123/jobs?')) response={jobs:data.jobs};
 else if(args[1].includes('/runs/123/artifacts?')) response={artifacts:data.artifacts};
 else if(args[1]==='repos/JesusFilm/lantern/actions/runs/123') response=data.currentRun??data.run;
 else process.exit(2);
 console.log(JSON.stringify(args.includes('--slurp')?[response]:response));
}else if(args[0]==='run' && args[1]==='download'){
 const name=args[args.indexOf('--name')+1],dir=args[args.indexOf('--dir')+1];
 const acceptance=name==='stage-acceptance-'+data.evidence.sha+'-123-2';
 if(data.downloadFails || (!acceptance && !data.artifacts.some(artifact=>artifact.name===name))) process.exit(2);
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,acceptance?'stage-acceptance.json':'release-evidence.json'),JSON.stringify(data.evidence));
}else process.exit(2);
`,{mode:0o755});
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'pipe'});
  const tls={key:readFileSync(join(dir,'key.pem')),cert:readFileSync(join(dir,'cert.pem'))};
  const stage={status:200,revision:sha,deployment:'stage-deployment',schema:'8'};
  const production={status:200,revision:'b'.repeat(40),deployment:'production-deployment',schema:'8'};
  const serve=async state=>{
   const server=createServer(tls,(_request,response)=>{
    response.writeHead(state.status,{'x-lantern-revision':state.revision,'x-lantern-deployment':state.deployment,'x-lantern-schema':state.schema});response.end('{}');
   });
   servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   return `https://127.0.0.1:${server.address().port}`;
  };
  const stageOrigin=await serve(stage),productionOrigin=await serve(production);
  const invoke=(env={},args=[])=>command(process.execPath,[script,...args],{
   cwd:work,env:{PATH:bin+':'+process.env.PATH,NODE_EXTRA_CA_CERTS:join(dir,'cert.pem'),FIXTURE_GITHUB:dataPath,
    RELEASE_MODE:'automatic',RELEASE_SHA:sha,GITHUB_REPOSITORY:'JesusFilm/lantern',GITHUB_EVENT_NAME:'workflow_run',
    GITHUB_EVENT_PATH:eventPath,GITHUB_ENV:output,STAGE_RUN_ID:'123',STAGE_RUN_ATTEMPT:'2',STAGE_APP_ORIGIN:stageOrigin,APP_ORIGIN:productionOrigin,...env}
  });

  await t.test('only complete authenticated acceptance admits the exact successful attempt',async()=>{
   save({evidence:{...evidence,acceptance:'failed'}});
   const denied=await invoke();assert.equal(denied.status,1);assert.equal(readFileSync(output,'utf8'),'');
   save();
   const accepted=await invoke();assert.equal(accepted.status,0,accepted.stderr);
   assert.match(readFileSync(output,'utf8'),/STAGE_RUN_ID=123\n/);
   assert.match(readFileSync(output,'utf8'),/EXPECTED_SCHEMA_VERSION=8\n/);
  });
  await t.test('final pre-migration check rejects replaced stage deployments, unhealthy production and schema changes',async()=>{
   const passed=await invoke({},['--freshness']);assert.equal(passed.status,0,passed.stderr);
   for(const [state,key,value] of [[stage,'deployment','new-deployment'],[stage,'revision','c'.repeat(40)],[stage,'schema','9'],[stage,'status',503],[production,'status',503],[production,'schema','7'],[production,'schema','9']]){
    const original=state[key];state[key]=value;
    const denied=await invoke({},['--freshness']);assert.equal(denied.status,1,`${key}=${value} should block promotion`);
    state[key]=original;
   }
  });
  await t.test('privileged workflow admission validates acceptance without any production environment settings',async()=>{
   save();
   const admitted=await invoke({APP_ORIGIN:undefined,STAGE_APP_ORIGIN:undefined},['--admission']);
   assert.equal(admitted.status,0,admitted.stderr);
   save({run:{...run,run_attempt:3}});
   const replay=await invoke({},['--admission']);assert.equal(replay.status,1);assert.equal(readFileSync(output,'utf8'),'');
   save();
   writeFileSync(eventPath,JSON.stringify({workflow_run:{...run,event:'pull_request'}}));
   const pullRequest=await invoke({},['--admission']);assert.equal(pullRequest.status,1);
   save();
  });
  await t.test('manual verifier overrides acceptance and cleanup failures using independent prerequisites and readiness',async()=>{
   for(const failure of ['acceptance','cleanup']){
    const failedRun={...run,conclusion:'failure'};
    const failedJobs=jobs.map(job=>job.name==='stage delivery and smoke'?{...job,conclusion:'failure',steps:[...steps,{name:'Exercise authenticated staging journeys and clean synthetic fixtures',number:7,status:'completed',conclusion:'failure'}]}:job);
    save({run:failedRun,jobs:failedJobs,evidence:{...evidence,[failure]:'failed'}});
    const denied=await invoke({},['--admission']);assert.equal(denied.status,1);
    const allowed=await invoke({RELEASE_MODE:'manual',GITHUB_EVENT_NAME:'workflow_dispatch'},['--admission']);
    assert.equal(allowed.status,0,`${failure}: ${allowed.stderr}`);
    assert.match(readFileSync(output,'utf8'),/STAGE_RUN_ATTEMPT=2\n/);
   }
   save();
  });
  await t.test('manual admission rejects untrusted runs, failed prerequisites, stale or missing evidence and concurrent reruns',async()=>{
   const patches=[
    ...['typecheck','PostgreSQL HTTP and browser tests','production build'].map(name=>({jobs:jobs.map(job=>job.name===name?{...job,conclusion:'failure'}:job)})),
    ...['Apply exact-revision schema migrations','Verify deployed revision, schema, login and anonymous denial'].map(name=>({jobs:jobs.map(job=>job.steps?{...job,steps:steps.map(step=>step.name===name?{...step,conclusion:'failure'}:step)}:job)})),
    ...[{sha:'b'.repeat(40)},{runId:'124'},{runAttempt:1},{readiness:'failed'},{deployment:''}].map(patch=>({evidence:{...evidence,...patch}})),
    {artifacts:[]}, {artifacts:[{...artifact,expired:true}]},
    {artifacts:[{...artifact,created_at:'2026-10-20T09:00:00Z'}]},
    {artifacts:[{...artifact,name:`stage-readiness-${sha}-123-1`}]},
    {downloadFails:true},
    ...[{event:'pull_request'},{head_branch:'feature'},{repository:{full_name:'fork/lantern'}},{status:'in_progress'}].map(patch=>({run:{...run,...patch}})),
    {currentRun:{...run,run_attempt:3}}, {currentRun:{...run,status:'in_progress'}},
   ];
   for(const [i,patch] of patches.entries()){
    save(patch);
    const denied=await invoke({RELEASE_MODE:'manual',GITHUB_EVENT_NAME:'workflow_dispatch'},['--admission']);
    assert.equal(denied.status,1,`unsafe manual case ${i}`);
    assert.equal(readFileSync(output,'utf8'),'');
   }
   save();
  });
  await t.test('rerunning only staging can reuse successful prerequisite jobs but cannot reuse old readiness',async()=>{
   const inherited=jobs.map(job=>job.steps?job:{...job,run_attempt:1});
   save({jobs:inherited});
   const allowed=await invoke({RELEASE_MODE:'manual',GITHUB_EVENT_NAME:'workflow_dispatch'},['--admission']);
   assert.equal(allowed.status,0,allowed.stderr);
   save({jobs:inherited.map(job=>job.steps?{...job,run_attempt:1}:job)});
   const denied=await invoke({RELEASE_MODE:'manual',GITHUB_EVENT_NAME:'workflow_dispatch'},['--admission']);
   assert.equal(denied.status,1);
   save();
  });
  await t.test('new main commits block queued automatic releases while explicit historical manual releases retain readiness admission',async()=>{
   git(['commit','--allow-empty','-m','Newer main revision']);
   git(['push','origin','main']);
   const stale=await invoke({},['--freshness']);assert.equal(stale.status,1);
   // Historical readiness workflows: private staging migration (8c9c70c,
   // schema 4) and runner-side exact-revision migration (current main, schema 8).
   for(const [migration,schemaVersion] of [['Apply migrations in the private staging network',4],['Apply exact-revision schema migrations',8]]){
    const historicalJobs=jobs.map(job=>job.steps?{...job,steps:steps.map(step=>step.name==='Apply exact-revision schema migrations'?{...step,name:migration}:step)}:job);
    save({jobs:historicalJobs,artifacts:[{...artifact,name:`stage-readiness-${sha}`}],evidence:{...evidence,schemaVersion,acceptance:undefined,cleanup:undefined,runAttempt:undefined}});
    const manual=await invoke({RELEASE_MODE:'manual',GITHUB_EVENT_NAME:'workflow_dispatch',APP_ORIGIN:undefined,STAGE_APP_ORIGIN:undefined});
    assert.equal(manual.status,0,`${migration}: ${manual.stderr}`);
    assert.ok(readFileSync(output,'utf8').includes(`EXPECTED_SCHEMA_VERSION=${schemaVersion}\n`));
   }
  });
 } finally {
  await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));
  rmSync(dir,{recursive:true,force:true});
 }
});
