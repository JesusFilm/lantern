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
 const evidence = {sha,readiness:'passed',target:'stage',deployment:'stage-id',runId:'123',runAttempt:2,schemaVersion:8,acceptance:'passed',cleanup:'passed',acceptanceSuiteVersion:2};
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

function manualCandidate() {
 const run={id:123,run_attempt:2,head_sha:sha,event:'push',head_branch:'main',path:'.github/workflows/ci.yml',status:'completed',conclusion:'failure',repository:{full_name:'JesusFilm/lantern'}};
 const job={run_id:123,run_attempt:2,head_sha:sha,status:'completed',conclusion:'success',started_at:'2026-10-20T10:00:00Z',completed_at:'2026-10-20T10:10:00Z'};
 const names=['Enforce exact revision and successful checks','Run npm run build','Verify staging configuration before migrations','Apply exact-revision schema migrations','Upload the checked source revision','Verify deployed revision, schema, login and anonymous denial'];
 const steps=names.map((name,i)=>({name,number:i+1,status:'completed',conclusion:'success',completed_at:'2026-10-20T10:05:00Z'}));
 const jobs=['typecheck','PostgreSQL HTTP and browser tests','production build'].map(name=>({...job,name}));
 jobs.push({...job,name:'stage delivery and smoke',conclusion:'failure',steps:[...steps,{name:'Exercise authenticated staging journeys and clean synthetic fixtures',number:7,status:'completed',conclusion:'failure'}]});
 const artifact={name:`stage-readiness-${sha}-123-2`,expired:false,created_at:'2026-10-20T10:06:00Z',workflow_run:{id:123,head_sha:sha}};
 const evidence={sha,readiness:'passed',target:'stage',deployment:'stage-deployment',runId:'123',schemaVersion:8};
 return {sha,run,repository:'JesusFilm/lantern',jobs,artifact,evidence};
}

test('manual acceptance override admits preserved readiness after a failed acceptance run while automatic admission stays strict',()=>{
 const input=manualCandidate();
 assert.doesNotThrow(()=>gates.verifyManualPromotion(input));
 assert.throws(()=>gates.verifyAutomaticPromotion({...input,currentMainSha:sha,runId:'123',runAttempt:2}));
});

test('manual override cannot bypass failed, skipped, missing or ambiguous prerequisites and staging steps',()=>{
 for(const name of ['typecheck','PostgreSQL HTTP and browser tests','production build']){
  for(const conclusion of ['failure','cancelled','skipped',undefined]){
   const input=manualCandidate();input.jobs.find(job=>job.name===name).conclusion=conclusion;
   assert.throws(()=>gates.verifyManualPromotion(input),`${name}: ${conclusion}`);
  }
  const input=manualCandidate();input.jobs=input.jobs.filter(job=>job.name!==name);
  assert.throws(()=>gates.verifyManualPromotion(input),`missing ${name}`);
 }
 for(let i=0;i<6;i++){
  const input=manualCandidate();input.jobs.at(-1).steps[i].conclusion='failure';
  assert.throws(()=>gates.verifyManualPromotion(input),`stage prerequisite ${i}`);
 }
 for(const patch of [{head_sha:'b'.repeat(40)},{run_id:124},{run_attempt:1},{status:'in_progress'}]){
  const input=manualCandidate();Object.assign(input.jobs.at(-1),patch);
  assert.throws(()=>gates.verifyManualPromotion(input));
 }
 const duplicate=manualCandidate();duplicate.jobs.push({...duplicate.jobs[0]});
 assert.throws(()=>gates.verifyManualPromotion(duplicate));
});

test('manual readiness is bound to its SHA, run, attempt and successful readiness interval, including legacy artifacts',()=>{
 const input=manualCandidate();
 for(const patch of [{sha:'b'.repeat(40)},{runId:'124'},{runAttempt:1},{readiness:'failed'},{deployment:''}]){
  assert.throws(()=>gates.verifyManualPromotion({...input,evidence:{...input.evidence,...patch}}));
 }
 for(const patch of [{name:`stage-readiness-${sha}-123-1`},{expired:true},{workflow_run:{id:124,head_sha:sha}},{workflow_run:{id:123,head_sha:'b'.repeat(40)}},{created_at:'2026-10-20T09:06:00Z'},{created_at:'2026-10-20T10:11:00Z'},{created_at:undefined}]){
  assert.throws(()=>gates.verifyManualPromotion({...input,artifact:{...input.artifact,...patch}}));
 }
 assert.throws(()=>gates.verifyManualPromotion({...input,artifact:undefined}));
 const legacy={...input,run:{...input.run,conclusion:'success'},artifact:{...input.artifact,name:`stage-readiness-${sha}`}};
 assert.doesNotThrow(()=>gates.verifyManualPromotion(legacy));
 assert.throws(()=>gates.verifyManualPromotion({...legacy,artifact:{...legacy.artifact,created_at:'2026-10-20T09:06:00Z'}}));
});

// Step names/order from 8c9c70c:.github/workflows/ci.yml (private staging migrations).
// Keep this fixture literal so the regression also works in a shallow CI checkout.
function privateMigrationCandidate() {
 const input=manualCandidate();
 input.run.conclusion='success';
 input.evidence.schemaVersion=4;
 input.artifact.name=`stage-readiness-${sha}`;
 const stage=input.jobs.at(-1);
 stage.conclusion='success';
 stage.steps=[
  'Run actions/checkout@v4',
  'Run actions/setup-node@v4',
  'Enforce exact revision and successful checks',
  'Run npm ci',
  'Run npx playwright install --with-deps chromium',
  'Run npm install --global @railway/cli@5.70.0',
  'Run npm run build',
  'Run node tools/release/stamp.mjs',
  'Verify staging configuration before migrations',
  'Apply migrations in the private staging network',
  'Upload the checked source revision',
  'Verify deployed revision, schema, login and anonymous denial',
  'Run actions/upload-artifact@v4',
 ].map((name,i)=>({name,number:i+1,status:'completed',conclusion:'success',completed_at:'2026-10-20T10:05:00Z'}));
 return input;
}

test('historical 8c9c70c private migration workflow retains manual readiness admission',()=>{
 assert.doesNotThrow(()=>gates.verifyManualPromotion(privateMigrationCandidate()));
});

test('historical migration compatibility retains every prerequisite, ordering and evidence safeguard',()=>{
 const legacy=privateMigrationCandidate();
 for(let i=0;i<12;i++){
  for(const conclusion of ['failure','skipped','cancelled']){
   const input=privateMigrationCandidate();input.jobs.at(-1).steps[i].conclusion=conclusion;
   assert.throws(()=>gates.verifyManualPromotion(input),`legacy step ${i}: ${conclusion}`);
  }
 }
 for(const change of [
  stage=>{stage.steps=stage.steps.filter(step=>step.name!=='Apply migrations in the private staging network');},
  stage=>{stage.steps[9].name='Unrecognized migration step';},
  stage=>{stage.steps[9].number=12;},
  stage=>{stage.steps.push({...stage.steps[9],name:'Apply exact-revision schema migrations'});},
 ]){
  const input=privateMigrationCandidate();change(input.jobs.at(-1));
  assert.throws(()=>gates.verifyManualPromotion(input));
 }
 for(const name of ['typecheck','PostgreSQL HTTP and browser tests','production build']){
  const input=privateMigrationCandidate();input.jobs.find(job=>job.name===name).conclusion='failure';
  assert.throws(()=>gates.verifyManualPromotion(input));
 }
 for(const patch of [{sha:'b'.repeat(40)},{runId:'124'},{runAttempt:1},{readiness:'failed'},{deployment:''}]){
  assert.throws(()=>gates.verifyManualPromotion({...legacy,evidence:{...legacy.evidence,...patch}}));
 }
 assert.throws(()=>gates.verifyManualPromotion({...legacy,artifact:{...legacy.artifact,created_at:'2026-10-20T09:00:00Z'}}));
 assert.throws(()=>gates.verifyManualPromotion({...legacy,artifact:undefined}));
});
