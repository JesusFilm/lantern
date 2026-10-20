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

test('the executable refuses production before reading credentials or attempting connections', () => {
  const result = spawnSync(process.execPath, ['tools/release/acceptance.mjs'], {
    env: { PATH: process.env.PATH, RELEASE_TARGET: 'production', MIGRATION_DATABASE_URL: 'private-password' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'Staging acceptance failed [configuration]. No passing evidence recorded.');
});
