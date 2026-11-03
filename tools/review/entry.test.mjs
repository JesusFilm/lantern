import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewTarget } from './entry.mjs';

const sha = 'a'.repeat(40);
const automatic = { eventName: 'pull_request_target', ref: 'refs/heads/main', event: { pull_request: { number: 67, head: { sha } } } };
const manual = pr_number => ({ eventName: 'workflow_dispatch', ref: 'refs/heads/main', event: { inputs: { pr_number } } });

test('entry resolves manual PR input without supplying an event SHA', () => {
  assert.deepEqual(reviewTarget(manual('67')), { prNumber: 67, expectedSha: undefined });
});

test('entry rejects ambiguous, nonpositive and unsafe manual PR inputs', () => {
  for (const value of ['', '0', '-1', '+67', '067', ' 67', '67 ', '6.7', '6e1', '0x43', '67junk', '67\n', '9007199254740992', null, undefined, 67, {}, []]) {
    assert.throws(() => reviewTarget(manual(value)), /PR number/, String(value));
  }
  assert.deepEqual(reviewTarget(manual('9007199254740991')), { prNumber: Number.MAX_SAFE_INTEGER, expectedSha: undefined });
  assert.throws(() => reviewTarget({ ...manual('67'), ref: 'refs/heads/feature' }));
  assert.throws(() => reviewTarget({ ...manual('67'), eventName: 'push' }));
});

test('automated events require a positive safe integer PR number and full hexadecimal head SHA', () => {
  assert.deepEqual(reviewTarget(automatic), { prNumber: 67, expectedSha: sha });
  for (const value of [undefined, '', 'a'.repeat(39), 'g'.repeat(40), `${sha}\n`]) {
    assert.throws(() => reviewTarget({ ...automatic, event: { pull_request: { number: 67, head: { sha: value } } } }), /SHA/);
  }
  for (const number of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '67', undefined]) {
    assert.throws(() => reviewTarget({ ...automatic, event: { pull_request: { number, head: { sha } } } }), /PR number/);
  }
});

test('CLI reports a published failure with exit code 1, while success and skips succeed', async () => {
  const { main } = await import('./main.mjs');
  const env = {
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_PATH: 'event.json',
    GITHUB_REPOSITORY: 'owner/lantern', AI_REVIEW_APP_ID: 'app', AI_REVIEW_APP_PRIVATE_KEY: 'key',
    AI_REVIEW_GATEWAY_BASE_URL: 'https://gateway.example', AI_REVIEW_GATEWAY_API_KEY: 'secret', AI_REVIEW_MODEL: 'model',
  };
  for (const result of [{ conclusion: 'failure', feedback: { note: 'published' } }, { conclusion: 'success', feedback: { note: 'published' } }, { skipped: true }]) {
    const processState = { exitCode: 0 };
    const logs = [];
    await main({ env, readEvent: () => JSON.stringify(manual('67').event), processState, log: value => logs.push(value), review: async config => {
      assert.equal(processState.exitCode, 0, 'do not fail before publishing completes');
      assert.equal(config.prNumber, 67);
      assert.equal(config.expectedSha, undefined);
      assert.equal(config.repository, 'owner/lantern');
      return result;
    } });
    assert.equal(processState.exitCode, result.conclusion === 'failure' ? 1 : 0);
    assert.match(logs[0], result.skipped ? /Skipped/ : new RegExp(result.conclusion));
  }
});
