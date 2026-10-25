import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptanceSummary } from './acceptance-diagnostics.mjs';

const sha = 'a'.repeat(40);
const env = { RELEASE_SHA: sha, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' };
const failed = {
  type: 'acceptance-diagnostics', sha, runId: '123', runAttempt: 2,
  journey: 'failed', journeyCheckpoint: 'mission-image', cleanup: 'failed',
  checkpoint: 'fixture-lifecycle', passingEvidenceProduced: false,
};

test('the run summary displays both failures and exact candidate identity without exposing extra fields', () => {
  const summary = acceptanceSummary(env, { ...failed, error: 'private-token', data: 'personnel-content' });
  assert.ok(summary.includes('Candidate SHA: `' + sha + '`'));
  assert.match(summary, /CI run \/ attempt: `123` \/ `2`/);
  assert.match(summary, /Journey: \*\*failed\*\* \(safe checkpoint: `mission-image`\)/);
  assert.match(summary, /Fixture cleanup: \*\*failed\*\*/);
  assert.match(summary, /Passing promotion evidence produced: \*\*no\*\*/);
  assert.match(summary, /never promotion evidence/);
  assert.doesNotMatch(summary, /private-token|personnel-content/);
});

test('missing or stale diagnostics stay unknown after execution, and skipped execution is not reached', () => {
  for (const diagnostic of [undefined, null, { ...failed, sha: 'b'.repeat(40) },
    { ...failed, runId: '999' }, { ...failed, runAttempt: 1 }, { ...failed, type: 'acceptance-evidence' }]) {
    const summary = acceptanceSummary(env, diagnostic, { stepOutcome: 'failure' });
    assert.match(summary, /Journey: \*\*unknown\*\* \(safe checkpoint: `unknown`\)/);
    assert.match(summary, /Fixture cleanup: \*\*unknown\*\*/);
    assert.match(summary, /Passing promotion evidence produced: \*\*no\*\*/);
  }
  const skipped = acceptanceSummary(env, failed, { stepOutcome: 'skipped' });
  assert.match(skipped, /Journey: \*\*not-reached\*\*/);
  assert.match(skipped, /Fixture cleanup: \*\*not-reached\*\*/);
});

test('only completed successful diagnostics report produced evidence and all dynamic text is allowlisted', () => {
  const passed = { ...failed, journey: 'passed', journeyCheckpoint: 'complete', cleanup: 'passed',
    checkpoint: 'complete', passingEvidenceProduced: true };
  assert.match(acceptanceSummary(env, passed), /Passing promotion evidence produced: \*\*yes\*\*/);
  for (const patch of [
    { journey: 'private-journey-token', journeyCheckpoint: 'personnel-data', cleanup: 'private-cleanup-token', checkpoint: 'raw-error' },
    { cleanup: 'unknown' }, { checkpoint: 'evidence-write' }, { passingEvidenceProduced: 'true' },
  ]) {
    const summary = acceptanceSummary(env, { ...passed, ...patch });
    assert.match(summary, /Passing promotion evidence produced: \*\*no\*\*/);
    assert.doesNotMatch(summary, /private-journey-token|personnel-data|private-cleanup-token|raw-error/);
  }
  const summary = acceptanceSummary({ RELEASE_SHA: 'private-sha', GITHUB_RUN_ID: 'private-run', GITHUB_RUN_ATTEMPT: 'private-attempt' }, passed);
  assert.doesNotMatch(summary, /private-sha|private-run|private-attempt/);
});

test('the summary executable appends safe output even when diagnostics are absent or damaged', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'lantern-summary-test-'));
  const summaryPath = join(directory, 'summary.md');
  try {
    for (const diagnostic of [undefined, '{ private-token', JSON.stringify(failed),
      JSON.stringify({ ...failed, journey: 'passed', journeyCheckpoint: 'complete', cleanup: 'unknown' })]) {
      if (diagnostic !== undefined) await writeFile(join(directory, 'stage-acceptance-diagnostics.json'), diagnostic);
      await writeFile(summaryPath, 'Existing summary\n');
      const result = spawnSync(process.execPath, [new URL('./acceptance-diagnostics.mjs', import.meta.url).pathname], {
        cwd: directory, encoding: 'utf8',
        env: { PATH: process.env.PATH, ...env, GITHUB_STEP_SUMMARY: summaryPath, ACCEPTANCE_STEP_OUTCOME: 'failure' },
      });
      assert.equal(result.status, 0);
      assert.equal(result.stdout + result.stderr, '');
      const summary = await readFile(summaryPath, 'utf8');
      assert.ok(summary.startsWith('Existing summary\n'));
      assert.match(summary, /Staging acceptance diagnostics/);
      assert.match(summary, /Passing promotion evidence produced: \*\*no\*\*/);
      assert.doesNotMatch(summary, /private-token/);
      await assert.rejects(readFile(join(directory, 'stage-acceptance.json')), { code: 'ENOENT' });
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
