import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { promotionGate, verifyStageRun } from './gates.mjs';
const { RELEASE_SHA: sha, GITHUB_REPOSITORY: repository, GITHUB_ENV: output } = process.env;
assert.match(sha ?? '', /^[a-f0-9]{40}$/);
assert.ok(output);
// The checked-out workflow comes from main; the candidate must also belong to main.
execFileSync('git',['merge-base','--is-ancestor',sha,'origin/main'],{stdio:'pipe'});
const runs = JSON.parse(execFileSync('gh',['api',`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&status=success&per_page=100`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const run = runs.workflow_runs?.find(run => {
 try { verifyStageRun(run,sha,repository); return true; } catch { return false; }
});
assert.ok(run,'No successful main CI run exists for this SHA.');
execFileSync('gh',['run','download',String(run.id),'--repo',repository,'--name',`stage-readiness-${sha}`,'--dir','stage-evidence'],{stdio:'pipe'});
const evidence = JSON.parse(await readFile('stage-evidence/release-evidence.json','utf8'));
promotionGate(sha,evidence);
assert.equal(String(evidence.runId),String(run.id),'Evidence run mismatch.');
await appendFile(output,`STAGE_RUN_ID=${run.id}\nEXPECTED_SCHEMA_VERSION=${evidence.schemaVersion}\n`);
console.log('Exact main revision has successful staging readiness.');
