import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageGate, promotionGate, verifyStageRun } from './gates.mjs';
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

test('GitHub evidence must come from the completed successful main push workflow in this repository', () => {
 const run = {head_sha:sha,event:'push',head_branch:'main',path:'.github/workflows/ci.yml',status:'completed',conclusion:'success',repository:{full_name:'JesusFilm/lantern'}};
 assert.doesNotThrow(() => verifyStageRun(run,sha,'JesusFilm/lantern'));
 for (const patch of [{conclusion:'failure'},{conclusion:'cancelled'},{conclusion:null},{status:'in_progress'},{event:'pull_request'},{head_sha:'b'.repeat(40)},{path:'other.yml'},{repository:{full_name:'fork/lantern'}}]) assert.throws(() => verifyStageRun({...run,...patch},sha,'JesusFilm/lantern'));
});

test('deployment receipt must be successful and match both target IDs', async () => {
 const { deploymentReceipt } = await import('./gates.mjs');
 const receipt = {status:'success',deploymentId:'12345678-1234-1234-1234-123456789abc',serviceId:'service',environmentId:'stage'};
 assert.equal(deploymentReceipt(JSON.stringify(receipt),'service','stage'),receipt.deploymentId);
 for (const patch of [{status:'queued'},{status:'failed'},{serviceId:'production'},{environmentId:'production'},{deploymentId:'bad\nvalue'}]) assert.throws(()=>deploymentReceipt(JSON.stringify({...receipt,...patch}),'service','stage'));
});
