import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { acceptanceEvidence } from './acceptance.mjs';

const sha = 'a'.repeat(40);
const env = {
  RELEASE_TARGET: 'stage', RELEASE_SHA: sha, APP_ORIGIN: 'https://stage.example.test',
  EXPECTED_DEPLOYMENT_ID: 'deployment-a', EXPECTED_SCHEMA_VERSION: '8',
  GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2',
};
const readiness = { target: 'stage', sha, deployment: 'deployment-a', schemaVersion: 8, runId: '123', readiness: 'passed' };
const checks = ['authenticated-identities', 'department-direction', 'mission-image',
  'focus-authoring-persistence', 'authorization-isolation', 'stale-and-forged-writes',
  'lead-confirmation-lock', 'account-and-guide', 'browser-errors', 'session-revocation'];
const health = (patch = {}) => new Response('{"status":"ok","database":"ok"}', {
  status: 200, headers: {
    'x-lantern-revision': sha, 'x-lantern-deployment': 'deployment-a', 'x-lantern-schema': '8', ...patch,
  },
});

test('acceptance records only bounded evidence after the deployed journey and cleanup complete', async () => {
  const order = [];
  const evidence = await acceptanceEvidence(env, { ...readiness, private: 'must-not-copy' }, async () => {
    order.push('journey-and-cleanup');
    return checks;
  }, { fetch: async () => { order.push('health'); return health(); } });
  assert.deepEqual(order, ['health', 'journey-and-cleanup', 'health']);
  assert.deepEqual(evidence, {
    sha, target: 'stage', deployment: 'deployment-a', schemaVersion: 8,
    runId: '123', runAttempt: 2, readiness: 'passed',
    acceptance: 'passed', cleanup: 'passed', acceptanceSuiteVersion: 1,
    checks,
  });
});

test('wrong target, stale readiness and mismatched deployment stop before fixture creation', async () => {
  for (const patch of [{ RELEASE_TARGET: 'production' }, { APP_ORIGIN: 'http://stage.example.test' },
    { GITHUB_RUN_ATTEMPT: '' }, { RELEASE_SHA: 'short' }]) {
    await assert.rejects(acceptanceEvidence({ ...env, ...patch }, readiness, () => assert.fail('fixture must not run')));
  }
  for (const patch of [{ sha: 'b'.repeat(40) }, { runId: '124' }, { deployment: 'old' }, { readiness: 'failed' }, { schemaVersion: 7 }]) {
    await assert.rejects(acceptanceEvidence(env, { ...readiness, ...patch }, () => assert.fail('fixture must not run')));
  }
  await assert.rejects(acceptanceEvidence(env, readiness, () => assert.fail('fixture must not run'), {
    fetch: async () => health({ 'x-lantern-deployment': 'superseded' }),
  }), /stage-health-before/);
});

test('a changed deployment, failed journey or failed cleanup never produces passing evidence or raw diagnostics', async () => {
  let reads = 0;
  await assert.rejects(acceptanceEvidence(env, readiness, async () => checks, {
    fetch: async () => health(++reads === 1 ? {} : { 'x-lantern-revision': 'b'.repeat(40) }),
  }), /stage-health-after/);
  for (const kind of ['journey', 'cleanup']) {
    await assert.rejects(acceptanceEvidence(env, readiness, async () => {
      throw new Error(`${kind} failure containing private-session-token`);
    }, { fetch: async () => health() }), error => {
      assert.equal(error.message, 'Staging acceptance failed [journey-and-cleanup].');
      return true;
    });
  }
});

test('an incomplete journey cannot claim the current acceptance suite passed', async () => {
  await assert.rejects(acceptanceEvidence(env, readiness, async () => ['session-revocation'], {
    fetch: async () => health(),
  }), /journey-and-cleanup/);
});

test('release diagnostics retain only known safe journey or fixture checkpoints', async () => {
  for (const [failure, expected] of [
    [new Error('Staging acceptance failed [mission-image].'), 'mission-image'],
    [Object.assign(new Error('private database details'), { code: 'ACCEPTANCE_FIXTURE_UNSAFE' }), 'fixture-scope'],
    [new Error('Staging acceptance failed [private-secret].'), 'journey-and-cleanup'],
  ]) {
    await assert.rejects(acceptanceEvidence(env, readiness, async () => { throw failure; }, {
      fetch: async () => health(),
    }), { message: `Staging acceptance failed [${expected}].` });
  }
});

test('failure diagnostics preserve independent journey and cleanup outcomes without becoming evidence', async () => {
  const diagnostics = [];
  await assert.rejects(acceptanceEvidence(env, readiness, async report => {
    report({ journey: 'failed', journeyCheckpoint: 'mission-image' });
    report({ cleanup: 'failed' });
    throw Object.assign(new Error('private database token'), { code: 'ACCEPTANCE_FIXTURE_FAILED' });
  }, { fetch: async () => health(), onDiagnostic: report => diagnostics.push(report) }), /fixture-lifecycle/);
  assert.deepEqual(diagnostics.at(-1), {
    type: 'acceptance-diagnostics', sha, runId: '123', runAttempt: 2,
    journey: 'failed', journeyCheckpoint: 'mission-image', cleanup: 'failed',
    checkpoint: 'fixture-lifecycle', passingEvidenceProduced: false,
  });
  assert.doesNotMatch(JSON.stringify(diagnostics), /private database token/);
  assert.equal(diagnostics.at(-1).acceptance, undefined);
});

test('the executable records safe not-reached diagnostics when configuration fails', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'lantern-diagnostics-test-'));
  try {
    const result = spawnSync(process.execPath, [new URL('./acceptance.mjs', import.meta.url).pathname], {
      cwd: directory, encoding: 'utf8',
      env: { PATH: process.env.PATH, ...env, RELEASE_TARGET: 'production', MIGRATION_DATABASE_URL: 'private-password' },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.trim(), 'Staging acceptance failed [configuration]. No passing evidence recorded.');
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'stage-acceptance-diagnostics.json'), 'utf8')), {
      type: 'acceptance-diagnostics', sha, runId: '123', runAttempt: 2,
      journey: 'not-reached', journeyCheckpoint: 'not-reached', cleanup: 'not-reached',
      checkpoint: 'configuration', passingEvidenceProduced: false,
    });
    await assert.rejects(readFile(join(directory, 'stage-acceptance.json')), { code: 'ENOENT' });
    assert.doesNotMatch(result.stdout + result.stderr, /private-password/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
