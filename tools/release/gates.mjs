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

export function verifyStageRun(run, sha, repository) {
 if (run.head_sha !== sha || run.event !== 'push' || run.head_branch !== 'main' || run.path !== '.github/workflows/ci.yml' || run.status !== 'completed' || run.conclusion !== 'success' || run.repository?.full_name !== repository) throw new Error('Stage run is not a successful main CI run for this SHA.');
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
