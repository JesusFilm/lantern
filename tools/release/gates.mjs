export function stageGate({ event, ref, sha, checkedSha, checks }) {
 if (event !== 'push' || ref !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(sha) || checkedSha !== sha || checks?.length !== 3 || checks.some(x => x !== 'success')) throw new Error('Stage requires successful checks for this main SHA.');
}
export function promotionGate(sha, evidence, {requireAcceptance = false, runId, runAttempt} = {}) {
 if (!/^[a-f0-9]{40}$/.test(sha) || evidence.sha !== sha || evidence.readiness !== 'passed' || evidence.target !== 'stage' || !evidence.deployment || !evidence.runId || !Number.isInteger(evidence.schemaVersion)) throw new Error('Passing stage readiness for the exact SHA is required.');
 if (requireAcceptance && (
  evidence.acceptance !== 'passed' || evidence.cleanup !== 'passed' || evidence.acceptanceSuiteVersion !== 1
  || String(evidence.runId) !== String(runId) || evidence.runAttempt !== Number(runAttempt)
  || !Number.isSafeInteger(evidence.runAttempt) || evidence.runAttempt < 1
 )) throw new Error('Passing authenticated stage acceptance and cleanup from the exact run attempt are required.');
}

export function verifyStageRun(run, sha, repository, {requireSuccess = true} = {}) {
 if (run.head_sha !== sha || run.event !== 'push' || run.head_branch !== 'main' || run.path !== '.github/workflows/ci.yml' || run.status !== 'completed' || (requireSuccess && run.conclusion !== 'success') || run.repository?.full_name !== repository) throw new Error('Stage run is not a trusted completed main CI run for this SHA.');
}
export function verifyManualPromotion({sha,run,repository,jobs,artifact,evidence}) {
 verifyStageRun(run,sha,repository,{requireSuccess:false});
 promotionGate(sha,evidence);
 const reject=()=>{throw new Error('Manual promotion requires successful prerequisites and readiness from the exact completed staging attempt.');};
 if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 || !/^[1-9][0-9]*$/.test(String(run.id))) reject();
 const successful=item=>item?.status === 'completed' && item.conclusion === 'success';
 const latestJob=name=>{
  const matches=jobs.filter(job=>job.name === name);
  if (!matches.length || matches.some(job=>job.head_sha !== sha || String(job.run_id) !== String(run.id)
   || !Number.isSafeInteger(job.run_attempt) || job.run_attempt < 1 || job.run_attempt > run.run_attempt)) reject();
  const attempt=Math.max(...matches.map(job=>job.run_attempt));
  const latest=matches.filter(job=>job.run_attempt === attempt);
  if (latest.length !== 1) reject();
  return latest[0];
 };
 for (const name of ['typecheck','PostgreSQL HTTP and browser tests','production build']) {
  if (!successful(latestJob(name))) reject();
 }
 const stage=latestJob('stage delivery and smoke');
 if (stage.run_attempt !== run.run_attempt || stage.status !== 'completed') reject();
 // Both migration labels are from trusted historical CI workflows. Require
 // exactly one successful migration step; an alias never bypasses migration.
 const required=['Enforce exact revision and successful checks','Verify staging configuration before migrations',['Apply exact-revision schema migrations','Apply migrations in the private staging network'],'Upload the checked source revision','Verify deployed revision, schema, login and anonymous denial'];
 let previous=0;
 for (const name of required) {
  const names=Array.isArray(name)?name:[name];
  const steps=stage.steps.filter(step=>names.includes(step.name));
  if (steps.length !== 1 || !successful(steps[0]) || !Number.isInteger(steps[0].number) || steps[0].number <= previous) reject();
  previous=steps[0].number;
 }
 if (stage.steps.some(step=>step.number <= previous && !successful(step))) reject();
 // Older readiness JSON has no attempt. Trusted artifact metadata must place
 // its upload after this attempt's readiness, and before its stage job ended.
 const ready=stage.steps.find(step=>step.number === previous);
 const created=Date.parse(artifact?.created_at);
 if (String(evidence.runId) !== String(run.id)
  || (evidence.runAttempt !== undefined && evidence.runAttempt !== run.run_attempt)
  || ![`stage-readiness-${sha}-${run.id}-${run.run_attempt}`,`stage-readiness-${sha}`].includes(artifact?.name)
  || artifact.expired !== false || String(artifact.workflow_run?.id) !== String(run.id) || artifact.workflow_run?.head_sha !== sha
  || !(created >= Date.parse(ready.completed_at) && created >= Date.parse(stage.started_at) && created <= Date.parse(stage.completed_at))) reject();
}
export function verifyAutomaticPromotion({sha,currentMainSha,run,repository,runId,runAttempt}) {
 verifyStageRun(run,sha,repository);
 if (!/^[a-f0-9]{40}$/.test(sha) || sha !== currentMainSha
  || !/^[1-9][0-9]*$/.test(String(runId)) || String(run.id) !== String(runId)
  || !/^[1-9][0-9]*$/.test(String(runAttempt)) || run.run_attempt !== Number(runAttempt)
 ) throw new Error('Automatic promotion requires the latest main revision and the exact successful triggering run attempt.');
}
export function verifyAutomaticTargets(evidence,stage,production) {
 if (stage.revision !== evidence.sha || stage.deployment !== evidence.deployment || stage.schemaVersion !== evidence.schemaVersion) {
  throw new Error('Stage must still serve the accepted revision, deployment and schema.');
 }
 if (!/^[a-f0-9]{40}$/.test(production.revision ?? '') || !production.deployment
  || production.schemaVersion !== evidence.schemaVersion || !Number.isInteger(production.schemaVersion) || production.schemaVersion < 1
 ) throw new Error('Automatic promotion requires healthy production with the same schema; schema changes require manual promotion.');
}
export function deploymentReceipt(output, service, environment) {
 const receipt = JSON.parse(output.trim().split('\n').at(-1));
 if (receipt.status !== 'success' || receipt.serviceId !== service || receipt.environmentId !== environment || !/^[a-f0-9-]{36}$/.test(receipt.deploymentId ?? '')) throw new Error('Deployment did not succeed for the configured target.');
 return receipt.deploymentId;
}
