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
  const eventPath=join(dir,'event.json'),dataPath=join(dir,'github.json'),output=join(dir,'github-env');
  const save=(patch={})=>{
   writeFileSync(eventPath,JSON.stringify({workflow_run:run}));
   writeFileSync(dataPath,JSON.stringify({run,evidence,...patch}));
   writeFileSync(output,'');
  };
  save();
  writeFileSync(join(bin,'gh'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const data=JSON.parse(fs.readFileSync(process.env.FIXTURE_GITHUB));
const args=process.argv.slice(2);
if(args[0]==='api'){
 if(args[1].includes('/workflows/ci.yml/runs?')) console.log(JSON.stringify({workflow_runs:[data.run]}));
 else if(args[1]==='repos/JesusFilm/lantern/actions/runs/123') console.log(JSON.stringify(data.run));
 else process.exit(2);
}else if(args[0]==='run' && args[1]==='download'){
 const name=args[args.indexOf('--name')+1],dir=args[args.indexOf('--dir')+1];
 const acceptance=name==='stage-acceptance-'+data.evidence.sha+'-123-2';
 if(!acceptance && name!=='stage-readiness-'+data.evidence.sha) process.exit(2);
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
  await t.test('new main commits block queued automatic releases while explicit historical manual releases retain readiness admission',async()=>{
   git(['commit','--allow-empty','-m','Newer main revision']);
   git(['push','origin','main']);
   const stale=await invoke({},['--freshness']);assert.equal(stale.status,1);
   save({evidence:{...evidence,acceptance:undefined,cleanup:undefined,runAttempt:undefined}});
   const manual=await invoke({RELEASE_MODE:'manual',GITHUB_EVENT_NAME:'workflow_dispatch',APP_ORIGIN:undefined,STAGE_APP_ORIGIN:undefined});
   assert.equal(manual.status,0,manual.stderr);
   assert.match(readFileSync(output,'utf8'),/EXPECTED_SCHEMA_VERSION=8\n/);
  });
 } finally {
  await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));
  rmSync(dir,{recursive:true,force:true});
 }
});
