import {test} from 'node:test';
import assert from 'node:assert/strict';
import {smoke} from './smoke.mjs';
const env={APP_ORIGIN:'https://synthetic.example',RELEASE_SHA:'a'.repeat(40),GITHUB_RUN_ID:'1',RELEASE_SMOKE_MODE:'readiness',RELEASE_TARGET:'production',EXPECTED_SCHEMA_VERSION:'4',EXPECTED_DEPLOYMENT_ID:'synthetic-deployment'};
const privateMessage='sensitive-url-cookie-content';
function fixture(failure){
 let healthCalls=0;
 const headers=new Headers({'x-lantern-revision':env.RELEASE_SHA,'x-lantern-deployment':env.EXPECTED_DEPLOYMENT_ID,'x-lantern-schema':'4'});
 const fail=stage=>{if(failure===stage)throw new Error(privateMessage);};
 const page={on(event,callback){if(failure==='browser-js-errors')callback(new Error(privateMessage));},async goto(){fail('browser-navigation');},getByRole(){return {or(){return {async waitFor(){fail('browser-login-control');}};}};}};
 return {fetch:async url=>{
  if(url.endsWith('/health')){
   healthCalls++;
   if(healthCalls===1&&failure==='health-schema')return new Response(null,{headers:{...Object.fromEntries(headers),'x-lantern-schema':'private-schema'}});
   if(healthCalls>1){fail('final-health');const finalHeaders=new Headers(headers);for(const [code,key] of [['final-revision','revision'],['final-deployment','deployment'],['final-schema','schema']])if(failure===code)finalHeaders.set('x-lantern-'+key,privateMessage);return new Response(null,{headers:finalHeaders});}
   return new Response(null,{headers});
  }
  const route=url.split('/').at(-1);return new Response(null,{status:failure==='anonymous-'+route?500:401});
 },chromium:{async launch(){fail('browser-launch');return {async newPage(){fail('browser-page');return page;},async close(){fail('browser-close');}};}}};
}
test('smoke failures identify only a safe checkpoint and never retain private diagnostics',async()=>{
 for(const code of ['health-schema','anonymous-focuses','anonymous-department','anonymous-guide','browser-launch','browser-page','browser-navigation','browser-login-control','browser-js-errors','browser-close','final-health','final-revision','final-deployment','final-schema']){
  await assert.rejects(smoke(env,fixture(code)),error=>{
   assert.equal(error.code,code);assert.equal(error.message,`Release smoke failed [${code}].`);assert.equal(error.cause,undefined);assert.doesNotMatch(error.stack,new RegExp(privateMessage));return true;
  });
 }
});
test('configuration and authenticated-stage failures also discard raw diagnostics',async()=>{
 await assert.rejects(smoke({...env,APP_ORIGIN:privateMessage},fixture()),{code:'configuration'});
 await assert.rejects(smoke({...env,RELEASE_TARGET:'stage',RELEASE_SMOKE_MODE:'authenticated'},fixture()),{code:'authenticated-stage'});
 const evidence=await smoke(env,fixture());
 assert.equal(evidence.readiness,'passed');assert.equal(evidence.sha,env.RELEASE_SHA);
});
test('CLI emits the safe code without raw configuration values',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['tools/release/smoke.mjs'],{env:{PATH:process.env.PATH,...env,APP_ORIGIN:privateMessage},encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/Release smoke failed \[configuration\]/);assert.doesNotMatch(result.stderr+result.stdout,new RegExp(privateMessage));
});
