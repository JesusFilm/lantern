import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { promotionGate, verifyStageRun, verifyAutomaticPromotion, verifyAutomaticTargets } from './gates.mjs';
async function health(origin) {
 const url=new URL(origin);
 assert.ok(url.protocol==='https:' && url.origin===origin);
 const response=await fetch(origin+'/health',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);
 const schema=response.headers.get('x-lantern-schema');
 assert.match(schema??'',/^[1-9][0-9]*$/);
 return {revision:response.headers.get('x-lantern-revision'),deployment:response.headers.get('x-lantern-deployment'),schemaVersion:Number(schema)};
}
try {
const { RELEASE_SHA: sha, GITHUB_REPOSITORY: repository, GITHUB_ENV: output } = process.env;
assert.match(sha ?? '', /^[a-f0-9]{40}$/);
assert.ok(output);
const mode=process.env.RELEASE_MODE ?? 'manual';
assert.ok(['manual','automatic'].includes(mode));
const automatic=mode==='automatic';
const freshnessOnly=process.argv[2]==='--freshness';
const admissionOnly=process.argv[2]==='--admission';
assert.ok(process.argv.length===2 || (process.argv.length===3 && (freshnessOnly || admissionOnly)));
assert.ok(!freshnessOnly || automatic);
const command=(file,args)=>execFileSync(file,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
// The checked-out workflow comes from main; the candidate must also belong to main.
command('git',['fetch','--no-tags','origin','+refs/heads/main:refs/remotes/origin/main']);
command('git',['merge-base','--is-ancestor',sha,'origin/main']);
let run,runId,runAttempt;
if(automatic){
 assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_run');
 ({STAGE_RUN_ID:runId,STAGE_RUN_ATTEMPT:runAttempt}=process.env);
 assert.match(runId??'',/^[1-9][0-9]*$/);
 assert.match(runAttempt??'',/^[1-9][0-9]*$/);
 const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
 const currentMainSha=command('git',['rev-parse','origin/main']).trim();
 const input={sha,currentMainSha,repository,runId,runAttempt};
 verifyAutomaticPromotion({...input,run:event.workflow_run});
 run=JSON.parse(command('gh',['api',`repos/${repository}/actions/runs/${runId}`]));
 verifyAutomaticPromotion({...input,run});
}else{
 const runs=JSON.parse(command('gh',['api',`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&status=success&per_page=100`]));
 run=runs.workflow_runs?.find(run=>{
  try{verifyStageRun(run,sha,repository);return true;}catch{return false;}
 });
}
assert.ok(run,'No successful main CI run exists for this SHA.');
const artifact=automatic?`stage-acceptance-${sha}-${runId}-${runAttempt}`:`stage-readiness-${sha}`;
if(!freshnessOnly) command('gh',['run','download',String(run.id),'--repo',repository,'--name',artifact,'--dir','stage-evidence']);
const evidence = JSON.parse(await readFile(`stage-evidence/${automatic?'stage-acceptance':'release-evidence'}.json`,'utf8'));
promotionGate(sha,evidence,{requireAcceptance:automatic,runId,runAttempt});
assert.equal(String(evidence.runId),String(run.id),'Evidence run mismatch.');
if(automatic && !admissionOnly){
 assert.notEqual(process.env.STAGE_APP_ORIGIN,process.env.APP_ORIGIN);
 const [stage,production]=await Promise.all([health(process.env.STAGE_APP_ORIGIN),health(process.env.APP_ORIGIN)]);
 verifyAutomaticTargets(evidence,stage,production);
}
if(!freshnessOnly) await appendFile(output,`STAGE_RUN_ID=${run.id}\nEXPECTED_SCHEMA_VERSION=${evidence.schemaVersion}\n${automatic?`STAGE_RUN_ATTEMPT=${runAttempt}\n`:''}`);
console.log(freshnessOnly?'Automatic promotion freshness checks passed.':automatic?'Exact current main revision has authenticated staging acceptance.':'Exact main revision has successful staging readiness.');
} catch {
 console.error('Production promotion gate failed. Check the selected revision, triggering run and staging evidence; no production mutation is authorized.');
 process.exitCode=1;
}
