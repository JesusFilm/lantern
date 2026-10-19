export function stageGate({ event, ref, sha, checkedSha, checks }) {
 if (event !== 'push' || ref !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(sha) || checkedSha !== sha || checks?.length !== 3 || checks.some(x => x !== 'success')) throw new Error('Stage requires successful checks for this main SHA.');
}
export function promotionGate(sha, evidence) {
 if (!/^[a-f0-9]{40}$/.test(sha) || evidence.sha !== sha || evidence.readiness !== 'passed' || evidence.target !== 'stage' || !evidence.deployment || !evidence.runId || !Number.isInteger(evidence.schemaVersion)) throw new Error('Passing stage readiness for the exact SHA is required.');
}

export function verifyStageRun(run, sha, repository) {
 if (run.head_sha !== sha || run.event !== 'push' || run.head_branch !== 'main' || run.path !== '.github/workflows/ci.yml' || run.status !== 'completed' || run.conclusion !== 'success' || run.repository?.full_name !== repository) throw new Error('Stage run is not a successful main CI run for this SHA.');
}
export function deploymentReceipt(output, service, environment) {
 const receipt = JSON.parse(output.trim().split('\n').at(-1));
 if (receipt.status !== 'success' || receipt.serviceId !== service || receipt.environmentId !== environment || !/^[a-f0-9-]{36}$/.test(receipt.deploymentId ?? '')) throw new Error('Deployment did not succeed for the configured target.');
 return receipt.deploymentId;
}
