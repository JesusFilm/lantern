import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { appJwt, installationToken } from './app-auth.mjs';
import { callModel } from './gateway.mjs';
import { decide, parseVerdict } from './verdict.mjs';
import { CHECK_NAME, protectedPathsIn, runReview } from './review.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SHA = 'a'.repeat(40);
const KEY = 'sk-test-SECRET-gateway-key';
const TOKEN = 'ghs_SECRETinstallationtoken';
const b64 = value => Buffer.from(value, 'base64url').toString();

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const DIFF = 'diff --git a/client/Guide.tsx b/client/Guide.tsx\n--- a/client/Guide.tsx\n+++ b/client/Guide.tsx\n@@ -1 +1 @@\n-a\n+b\n';
const WORKFLOW_DIFF = 'diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml\n--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@ -1 +1 @@\n-a\n+b\n';
const verdict = (patch = {}) => JSON.stringify({ decision: 'approve', summary: 'Looks correct.', findings: [], ...patch });

function world({ headSha = SHA, state = 'open', diff = DIFF, diffStatus = 200, model = verdict(), modelStatus = 200, stopReason = 'end_turn', failOn } = {}) {
  const calls = [];
  const checks = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, host: u.host, path: u.pathname, headers: init.headers, body });
    if (failOn === `${method} ${u.pathname}`) return json({ message: `boom ${TOKEN}` }, 500);
    if (u.host === 'gateway.example') {
      return modelStatus === 200 ? json({ stop_reason: stopReason, content: [{ type: 'text', text: model }] }) : json({ error: KEY }, modelStatus);
    }
    if (method === 'GET' && u.pathname === '/repos/o/r/installation') return json({ id: 77 });
    if (method === 'POST' && u.pathname === '/app/installations/77/access_tokens') return json({ token: TOKEN });
    if (method === 'GET' && u.pathname === '/repos/o/r/pulls/5') {
      if (String(init.headers?.Accept).includes('diff')) return diffStatus === 200 ? new Response(diff, { status: 200 }) : json({ message: 'too large' }, diffStatus);
      return json({ state, number: 5, title: 'T', body: 'B', head: { sha: headSha }, base: { ref: 'main' } });
    }
    if (method === 'POST' && u.pathname === '/repos/o/r/check-runs') { checks.push({ ...body }); return json({ id: 900 }, 201); }
    if (method === 'PATCH' && u.pathname === '/repos/o/r/check-runs/900') { checks.push({ ...body, patch: true }); return json({ id: 900 }); }
    return json({ message: `unexpected ${method} ${u.pathname}` }, 404);
  };
  return { fetch, calls, checks };
}

const config = { repository: 'o/r', prNumber: 5, expectedSha: SHA, appId: '5571876', privateKey: pem, gatewayBaseUrl: 'https://gateway.example', gatewayApiKey: KEY, model: 'qwen-test' };
const run = (w, patch = {}) => runReview({ ...config, ...patch, fetch: w.fetch });
const finalCheck = w => w.checks.at(-1);

test('app JWT is RS256, short-lived and verifiable with the app public key', () => {
  const jwt = appJwt({ appId: '5571876', privateKey: pem, now: 1_000_000 });
  const [h, p, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(b64(h)), { alg: 'RS256', typ: 'JWT' });
  const claims = JSON.parse(b64(p));
  assert.equal(claims.iss, '5571876');
  assert.ok(claims.iat <= 1_000_000 && claims.exp - claims.iat <= 600);
  const verify = createVerify('RSA-SHA256').update(`${h}.${p}`);
  assert.ok(verify.verify(publicKey, Buffer.from(s, 'base64url')));
});

test('installation token is requested with the least permissions on this repository only', async () => {
  const w = world();
  const token = await installationToken({ fetch: w.fetch, appId: '5571876', privateKey: pem, repository: 'o/r' });
  assert.equal(token, TOKEN);
  const post = w.calls.find(c => c.method === 'POST');
  assert.deepEqual(post.body, { repositories: ['r'], permissions: { checks: 'write', pull_requests: 'read', contents: 'read' } });
  assert.match(w.calls[0].headers.Authorization, /^Bearer ey/);
});

test('installation token failures do not echo upstream bodies', async () => {
  const w = world({ failOn: 'GET /repos/o/r/installation' });
  await assert.rejects(installationToken({ fetch: w.fetch, appId: '1', privateKey: pem, repository: 'o/r' }), error => !error.message.includes(TOKEN) && /installation/.test(error.message));
});

test('verdict parsing is strict and tolerant only of fences and think blocks', () => {
  assert.equal(parseVerdict(verdict()).decision, 'approve');
  assert.equal(parseVerdict('<think>hm</think>\n```json\n' + verdict() + '\n```').decision, 'approve');
  for (const bad of ['', 'LGTM', '[]', '{}', verdict({ decision: 'maybe' }), verdict({ summary: '' }), verdict({ findings: 'none' }),
    verdict({ findings: [{ severity: 'major' }] }), verdict({ findings: [{ severity: 'nit', message: 'x' }] }), verdict({ findings: [{ severity: 'minor', message: 'x', line: -3 }] }),
    verdict() + ' trailing words', 'x'.repeat(200_000)]) assert.throws(() => parseVerdict(bad), /verdict/i, bad.slice(0, 40));
});

test('only an approve with no blocker or major findings can pass, and the result is never neutral', () => {
  const v = (decision, severities = []) => parseVerdict(JSON.stringify({ decision, summary: 's', findings: severities.map(severity => ({ severity, message: 'm' })) }));
  assert.equal(decide(v('approve')).conclusion, 'success');
  assert.equal(decide(v('approve', ['minor'])).conclusion, 'success');
  for (const [d, s] of [['approve', ['major']], ['approve', ['blocker']], ['request_changes', []], ['request_changes', ['minor']]]) assert.equal(decide(v(d, s)).conclusion, 'failure');
});

test('gateway call uses the messages protocol and rejects truncation and bad responses', async () => {
  const w = world();
  const text = await callModel({ fetch: w.fetch, baseUrl: 'https://gateway.example/', apiKey: KEY, model: 'm', system: 'S', user: 'U' });
  assert.equal(text, verdict());
  const call = w.calls[0];
  assert.equal(call.path, '/v1/messages');
  assert.equal(call.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(call.headers['anthropic-version'], '2023-06-01');
  assert.deepEqual(Object.keys(call.body).sort(), ['max_tokens', 'messages', 'model', 'system']);
  for (const opts of [{ stopReason: 'max_tokens' }, { modelStatus: 500 }, { model: '' }]) {
    const bad = world(opts);
    await assert.rejects(callModel({ fetch: bad.fetch, baseUrl: 'https://gateway.example', apiKey: KEY, model: 'm', system: 'S', user: 'U' }), error => !error.message.includes(KEY));
  }
  await assert.rejects(callModel({ fetch: w.fetch, baseUrl: 'http://gateway.example', apiKey: KEY, model: 'm', system: 'S', user: 'U' }), /https/);
});

test('a passing review opens an in-progress check then completes success on the exact head SHA', async () => {
  const w = world();
  const result = await run(w);
  assert.equal(result.conclusion, 'success');
  const [open, done] = w.checks;
  assert.equal(open.name, CHECK_NAME);
  assert.equal(open.name, 'Independent review');
  assert.equal(open.head_sha, SHA);
  assert.equal(open.status, 'in_progress');
  assert.equal(done.patch, true);
  assert.equal(done.status, 'completed');
  assert.equal(done.conclusion, 'success');
  const model = w.calls.find(c => c.host === 'gateway.example');
  assert.match(model.body.system, /untrusted/i);
  assert.ok(!model.body.system.includes('client/Guide.tsx'));
  assert.match(model.body.messages[0].content, /client\/Guide\.tsx/);
});

test('every failure path completes the check as failure, never neutral, and leaks no secrets', async () => {
  const cases = {
    'diff too large': world({ diff: DIFF + 'x'.repeat(300_000) }),
    'diff unavailable': world({ diffStatus: 406 }),
    'empty diff': world({ diff: '' }),
    'gateway error': world({ modelStatus: 502 }),
    'truncated model': world({ stopReason: 'max_tokens' }),
    'garbage verdict': world({ model: 'Sure, LGTM!' }),
    'model rejects': world({ model: verdict({ decision: 'request_changes', summary: 'Bug.' }) }),
  };
  for (const [name, w] of Object.entries(cases)) {
    const result = await run(w);
    const done = finalCheck(w);
    assert.equal(done.conclusion, 'failure', name);
    assert.equal(result.conclusion, 'failure', name);
    assert.ok(['success', 'failure'].includes(done.conclusion));
    const everything = JSON.stringify(w.checks);
    for (const secret of [KEY, TOKEN, 'BEGIN PRIVATE KEY']) assert.ok(!everything.includes(secret), `${name} leaked ${secret}`);
  }
  assert.equal(cases['diff too large'].calls.some(c => c.host === 'gateway.example'), false);
});

test('a moved head or closed PR posts nothing so a stale verdict can never attach', async () => {
  for (const w of [world({ headSha: 'b'.repeat(40) }), world({ state: 'closed' })]) {
    const result = await run(w);
    assert.equal(result.skipped, true);
    assert.equal(w.checks.length, 0);
    assert.equal(w.calls.some(c => c.host === 'gateway.example'), false);
  }
});

test('if the check cannot be opened or completed the run errors so the required check stays unsatisfied', async () => {
  const noOpen = world({ failOn: 'POST /repos/o/r/check-runs' });
  await assert.rejects(run(noOpen));
  assert.equal(noOpen.calls.some(c => c.host === 'gateway.example'), false);
  await assert.rejects(run(world({ failOn: 'PATCH /repos/o/r/check-runs/900' })));
});

test('protected-path changes are reported in the check output', async () => {
  assert.deepEqual(protectedPathsIn(WORKFLOW_DIFF), ['.github/workflows/ci.yml']);
  assert.deepEqual(protectedPathsIn(DIFF), []);
  const w = world({ diff: WORKFLOW_DIFF });
  await run(w);
  assert.match(finalCheck(w).output.summary, /protected/i);
});

test('findings become annotations only for files in the diff', async () => {
  const w = world({ model: verdict({ findings: [{ severity: 'minor', file: 'client/Guide.tsx', line: 1, message: 'Nit here.' }, { severity: 'minor', file: 'other.ts', line: 4, message: 'Elsewhere.' }] }) });
  await run(w);
  const out = finalCheck(w).output;
  assert.deepEqual(out.annotations.map(a => [a.path, a.start_line, a.annotation_level]), [['client/Guide.tsx', 1, 'notice']]);
  assert.match(out.text, /Elsewhere/);
});

const workflow = readFileSync(new URL('../../.github/workflows/independent-review.yml', import.meta.url), 'utf8');

test('review workflow runs trusted main code only and never executes or checks out PR code', () => {
  assert.match(workflow, /^on:\s*\n\s+pull_request_target:/m);
  assert.doesNotMatch(workflow, /^\s+(push|pull_request|workflow_dispatch|workflow_run|issue_comment):/m);
  assert.doesNotMatch(workflow, /github\.event\.pull_request\.head\.(sha|ref|repo)/);
  assert.doesNotMatch(workflow, /github\.head_ref/);
  assert.doesNotMatch(workflow, /\$\{\{\s*github\.event\.pull_request\.(title|body)/);
  assert.doesNotMatch(workflow, /secrets:\s*inherit/);
  assert.doesNotMatch(workflow, /npm (ci|install)|npx /);
  assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /environment: ai-review/);
  assert.match(workflow, /pull_request\.base\.ref == 'main'/);
  assert.match(workflow, /^permissions:\s*\n\s+contents: read\s*$/m);
});

test('review workflow passes exactly the documented secrets and variables to the harness step only', () => {
  const names = [...workflow.matchAll(/\$\{\{\s*(secrets|vars)\.([A-Z0-9_]+)\s*\}\}/g)].map(m => `${m[1]}.${m[2]}`).sort();
  assert.deepEqual(names, ['secrets.AI_REVIEW_APP_PRIVATE_KEY', 'secrets.AI_REVIEW_GATEWAY_API_KEY', 'vars.AI_REVIEW_APP_ID', 'vars.AI_REVIEW_GATEWAY_BASE_URL', 'vars.AI_REVIEW_MODEL']);
  const holders = workflow.split(/\n      - /).filter(step => /secrets\.|vars\./.test(step));
  assert.equal(holders.length, 1);
  assert.match(holders[0], /run: node tools\/review\/main\.mjs\s*$/);
});
