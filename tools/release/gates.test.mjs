import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gates from './gates.mjs';
const {stageGate, promotionGate, verifyStageRun} = gates;
const sha = 'a'.repeat(40);
test('stage requires all successful checks on the exact merged main revision', () => {
 const input = { event: 'push', ref: 'refs/heads/main', sha, checkedSha: sha, checks: ['success','success','success'] };
 assert.doesNotThrow(() => stageGate(input));
 for (const result of ['failure','cancelled','skipped',undefined]) assert.throws(() => stageGate({...input, checks:['success',result,'success']}));
 assert.throws(() => stageGate({...input, checkedSha: 'b'.repeat(40)}));
 assert.throws(() => stageGate({...input, event:'pull_request'}));
});
test('promotion cannot substitute newer main or accept failed/missing stage evidence', () => {
 const evidence = { sha, readiness: 'passed', target: 'stage', deployment: 'stage-id', runId: '123', schemaVersion: 1 };
 assert.doesNotThrow(() => promotionGate(sha, evidence));
 for (const e of [{...evidence,sha:'b'.repeat(40)}, {...evidence,readiness:'failed'}, {...evidence,target:'production'}, {...evidence,deployment:''}, {}]) assert.throws(() => promotionGate(sha,e));
});

test('automatic promotion requires authenticated acceptance and cleanup from the exact run attempt', () => {
 const evidence = {sha,readiness:'passed',target:'stage',deployment:'stage-id',runId:'123',runAttempt:2,schemaVersion:8,acceptance:'passed',cleanup:'passed',acceptanceSuiteVersion:1};
 const required = {requireAcceptance:true,runId:'123',runAttempt:2};
 assert.doesNotThrow(() => promotionGate(sha,evidence,required));
 for (const patch of [{acceptance:undefined},{acceptance:'failed'},{cleanup:undefined},{cleanup:'failed'},{acceptanceSuiteVersion:0},{runId:'124'},{runAttempt:1},{runAttempt:undefined}]) {
  assert.throws(() => promotionGate(sha,{...evidence,...patch},required));
 }
 assert.throws(() => promotionGate(sha,{...evidence,readiness:undefined},required));
});

test('GitHub evidence must come from the completed successful main push workflow in this repository', () => {
 const run = {head_sha:sha,event:'push',head_branch:'main',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',repository:{full_name:'JesusFilm/lantern'}};
 assert.doesNotThrow(() => verifyStageRun(run,sha,'JesusFilm/lantern'));
 for (const patch of [{conclusion:'failure'},{conclusion:'cancelled'},{conclusion:null},{status:'in_progress'},{event:'pull_request'},{head_sha:'b'.repeat(40)},{path:'other.yml'},{repository:{full_name:'fork/lantern'}}]) assert.throws(() => verifyStageRun({...run,...patch},sha,'JesusFilm/lantern'));
});

test('automatic promotion rejects old main revisions and substituted or replayed workflow attempts', () => {
 const run = {id:123,run_attempt:2,head_sha:sha,event:'push',head_branch:'main',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',repository:{full_name:'JesusFilm/lantern'}};
 const input = {sha,currentMainSha:sha,run,repository:'JesusFilm/lantern',runId:'123',runAttempt:'2'};
 assert.doesNotThrow(() => gates.verifyAutomaticPromotion(input));
 for (const patch of [{currentMainSha:'b'.repeat(40)},{runId:'124'},{runAttempt:'1'},{runAttempt:undefined}]) {
  assert.throws(() => gates.verifyAutomaticPromotion({...input,...patch}));
 }
 for (const patch of [{event:'pull_request'},{head_branch:'feature'},{conclusion:'failure'},{status:'in_progress'},{repository:{full_name:'fork/lantern'}}]) {
  assert.throws(() => gates.verifyAutomaticPromotion({...input,run:{...run,...patch}}));
 }
});

test('automatic promotion requires the accepted deployment still on stage and no production schema change', () => {
 const evidence = {sha,deployment:'stage-deployment',schemaVersion:8};
 const stage = {revision:sha,deployment:'stage-deployment',schemaVersion:8};
 const production = {revision:'b'.repeat(40),deployment:'production-deployment',schemaVersion:8};
 assert.doesNotThrow(() => gates.verifyAutomaticTargets(evidence,stage,production));
 for (const patch of [{revision:'b'.repeat(40)},{deployment:'replacement-stage-deployment'},{schemaVersion:9}]) {
  assert.throws(() => gates.verifyAutomaticTargets(evidence,{...stage,...patch},production));
 }
 for (const patch of [{schemaVersion:7},{schemaVersion:9},{schemaVersion:undefined},{revision:undefined},{deployment:undefined}]) {
  assert.throws(() => gates.verifyAutomaticTargets(evidence,stage,{...production,...patch}));
 }
});

test('deployment receipt must be successful and match both target IDs', async () => {
 const { deploymentReceipt } = await import('./gates.mjs');
 const receipt = {status:'success',deploymentId:'12345678-1234-1234-1234-123456789abc',serviceId:'service',environmentId:'stage'};
 assert.equal(deploymentReceipt(JSON.stringify(receipt),'service','stage'),receipt.deploymentId);
 for (const patch of [{status:'queued'},{status:'failed'},{serviceId:'production'},{environmentId:'production'},{deploymentId:'bad\nvalue'}]) assert.throws(()=>deploymentReceipt(JSON.stringify({...receipt,...patch}),'service','stage'));
});
