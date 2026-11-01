import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { appJwt, installationToken } from './app-auth.mjs';
import { callModel } from './gateway.mjs';
import { decide, parseVerdict } from './verdict.mjs';
import { APP_LOGIN, COMMENT_MARKER, MAX_INLINE, diffRightLines, escapeText } from './feedback.mjs';
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

function world({ headSha = SHA, state = 'open', diff = DIFF, diffStatus = 200, model = verdict(), modelStatus = 200, stopReason = 'end_turn', failOn, seed = [], moveHeadAfterModel } = {}) {
  const calls = [];
  const checks = [];
  const comments = [...seed];
  const reviewComments = [];
  const reviews = [];
  let head = headSha;
  let nextId = 1000;
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, host: u.host, path: u.pathname, headers: init.headers, body });
    if (failOn === `${method} ${u.pathname}`) return json({ message: `boom ${TOKEN}` }, 500);
    if (u.host === 'gateway.example') {
      if (moveHeadAfterModel) head = moveHeadAfterModel;
      return modelStatus === 200 ? json({ stop_reason: stopReason, content: [{ type: 'text', text: model }] }) : json({ error: KEY }, modelStatus);
    }
    if (method === 'GET' && u.pathname === '/repos/o/r/installation') return json({ id: 77 });
    if (method === 'POST' && u.pathname === '/app/installations/77/access_tokens') return json({ token: TOKEN, permissions: body.permissions });
    if (method === 'GET' && u.pathname === '/repos/o/r/pulls/5') {
      if (String(init.headers?.Accept).includes('diff')) return diffStatus === 200 ? new Response(diff, { status: 200 }) : json({ message: 'too large' }, diffStatus);
      return json({ state, number: 5, title: 'T', body: 'B', head: { sha: head }, base: { ref: 'main' } });
    }
    if (method === 'POST' && u.pathname === '/repos/o/r/check-runs') { checks.push({ ...body }); return json({ id: 900 }, 201); }
    if (method === 'PATCH' && u.pathname === '/repos/o/r/check-runs/900') { checks.push({ ...body, patch: true }); return json({ id: 900 }); }
    const page = items => json(items.slice((Number(u.searchParams.get('page') ?? 1) - 1) * 100, Number(u.searchParams.get('page') ?? 1) * 100));
    if (method === 'GET' && u.pathname === '/repos/o/r/issues/5/comments') return page(comments);
    if (method === 'POST' && u.pathname === '/repos/o/r/issues/5/comments') { const c = { id: nextId++, user: { login: APP_LOGIN }, body: body.body }; comments.push(c); return json(c, 201); }
    const edit = /^\/repos\/o\/r\/issues\/comments\/(\d+)$/.exec(u.pathname);
    if (method === 'PATCH' && edit) { const c = comments.find(x => x.id === Number(edit[1])); if (!c || c.user.login !== APP_LOGIN) return json({ message: 'not yours' }, 403); c.body = body.body; return json(c); }
    if (method === 'GET' && u.pathname === '/repos/o/r/pulls/5/comments') return page(reviewComments);
    if (method === 'POST' && u.pathname === '/repos/o/r/pulls/5/reviews') { reviews.push(body); for (const c of body.comments ?? []) reviewComments.push({ id: nextId++, user: { login: APP_LOGIN }, ...c }); return json({ id: nextId++ }, 200); }
    return json({ message: `unexpected ${method} ${u.pathname}` }, 404);
  };
  return { fetch, calls, checks, comments, reviewComments, reviews };
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
  assert.deepEqual(post.body, { repositories: ['r'], permissions: { checks: 'write', pull_requests: 'write', contents: 'read' } });
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

const HUNK_DIFF = 'diff --git a/client/Guide.tsx b/client/Guide.tsx\n--- a/client/Guide.tsx\n+++ b/client/Guide.tsx\n@@ -1,3 +1,4 @@\n a\n-b\n+B\n+c\n d\n';
const manyLinesDiff = n => `diff --git a/new.ts b/new.ts\n--- /dev/null\n+++ b/new.ts\n@@ -0,0 +1,${n} @@\n${Array.from({ length: n }, (_, i) => `+line ${i + 1}`).join('\n')}\n`;
const finding = (patch = {}) => ({ severity: 'major', file: 'client/Guide.tsx', line: 2, message: 'Bug here.', ...patch });
const failing = findings => verdict({ decision: 'request_changes', summary: 'Needs work.', findings });
const writes = w => w.calls.filter(c => c.host === 'api.github.com' && c.method !== 'GET' && !/check-runs|access_tokens/.test(c.path));
const ours = w => w.comments.filter(c => c.user.login === APP_LOGIN && c.body.startsWith(COMMENT_MARKER));

test('model-derived text is escaped: no mentions, HTML, images, links, autolinks, issue refs or marker forgery', async () => {
  const hostile = '@octocat @org/team <img src=x onerror=alert(1)> ![p](https://evil.example/p.png) [click](https://evil.example) https://evil.example www.evil.example #12 <!-- lantern-independent-review --> `code` *bold*\nnew line';
  const out = escapeText(hostile);
  for (const bad of [/@\w/, /</, />/, /\]\(/, /!\[/, /:\/\//, /www\./i, /(^|[^&])#\d/, /\n/]) assert.doesNotMatch(out, bad);
  assert.ok(!out.includes(COMMENT_MARKER));
  assert.ok(escapeText('x'.repeat(5000), 100).length <= 100);

  const w = world({ diff: HUNK_DIFF, model: failing([finding({ message: hostile }), finding({ line: 3, file: 'client/Guide.tsx', message: '@octocat see https://evil.example' })]).replace('Needs work.', '<script>@octocat</script>') });
  await run(w);
  const surfaces = [...w.comments.map(c => c.body), ...w.reviews.map(r => r.body), ...w.reviewComments.map(c => c.body), finalCheck(w).output.summary, finalCheck(w).output.text];
  for (const surface of surfaces) {
    assert.doesNotMatch(surface, /@\w/);
    assert.doesNotMatch(surface, /<script|<img/);
    assert.doesNotMatch(surface.replace(/\]\(https:\/\/github\.com\/o\/r\/pull\/5\/checks\?check_run_id=900\)/g, ''), /\]\(/);
    assert.doesNotMatch(surface, /!\[|\]\(https:\/\/evil/);
  }
});

test('diffRightLines lists only commentable right-side lines', () => {
  const lines = diffRightLines(HUNK_DIFF + manyLinesDiff(3));
  assert.deepEqual([...lines.get('client/Guide.tsx')], [1, 2, 3, 4]);
  assert.deepEqual([...lines.get('new.ts')], [1, 2, 3]);
  assert.equal(diffRightLines('').size, 0);
});

test('a passing review leaves one SHA-bound summary comment that links the check and is not an approval', async () => {
  const w = world({ diff: HUNK_DIFF });
  await run(w);
  assert.equal(ours(w).length, 1);
  const body = ours(w)[0].body;
  assert.ok(body.includes(`<!-- head:${SHA} -->`));
  assert.match(body, /\*\*Passed\*\* for `aaaaaaa`/);
  assert.match(body, /check_run_id=900/);
  assert.match(body, /not a formal pull request approval/);
  assert.equal(w.reviews.length, 0);
  assert.match(finalCheck(w).output.summary, /Pull request feedback: summary comment (created|updated)/);
});

test('repeated runs edit the same comment in place and never duplicate inline comments for the same commit', async () => {
  const model = failing([finding(), finding({ line: 3, message: 'Second.' })]);
  const w = world({ diff: HUNK_DIFF, model });
  await run(w);
  await run(w);
  await run(w);
  assert.equal(ours(w).length, 1);
  assert.equal(writes(w).filter(c => c.method === 'POST' && c.path.endsWith('/issues/5/comments')).length, 1);
  assert.equal(w.reviews.length, 1);
  assert.equal(w.reviewComments.length, 2);
  assert.match(finalCheck(w).output.summary, /inline findings already posted/);
});

test('a new commit supersedes the old verdict: the comment is rebound to the new SHA and fresh findings are posted', async () => {
  const NEW = 'c'.repeat(40);
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]) });
  await run(w);
  const before = ours(w)[0].body;
  assert.ok(before.includes(`head:${SHA}`));
  const w2 = world({ diff: HUNK_DIFF, model: failing([finding()]), headSha: NEW, seed: w.comments });
  await runReview({ ...config, expectedSha: NEW, fetch: w2.fetch });
  assert.equal(ours(w2).length, 1);
  assert.ok(ours(w2)[0].body.includes(`head:${NEW}`));
  assert.ok(!ours(w2)[0].body.includes(`head:${SHA}`));
  const editedRunning = w2.calls.find(c => c.method === 'PATCH' && c.path.startsWith('/repos/o/r/issues/comments/'));
  assert.match(editedRunning.body.body, /superseded/);
  assert.match(editedRunning.body.body, /`aaaaaaa`/);
  assert.equal(w2.reviews[0].commit_id, NEW);
});

test('a run for a superseded head publishes nothing to the pull request', async () => {
  const stale = world({ headSha: 'b'.repeat(40), diff: HUNK_DIFF });
  await run(stale);
  assert.equal(writes(stale).length, 0);

  const NEW = 'b'.repeat(40);
  const w = world({ diff: HUNK_DIFF, model: failing([finding()]), moveHeadAfterModel: NEW });
  const result = await run(w);
  assert.equal(result.conclusion, 'failure');
  assert.equal(finalCheck(w).conclusion, 'failure');
  assert.equal(w.checks[0].head_sha, SHA);
  assert.equal(w.reviews.length, 0);
  assert.equal(ours(w).every(c => /Reviewing/.test(c.body)), true);
  assert.match(finalCheck(w).output.summary, /not published: the pull request moved/);
});

test('inline review is COMMENT-only, capped at 10, limited to blocker/major findings on commentable lines', async () => {
  const findings = [
    ...Array.from({ length: 15 }, (_, i) => finding({ file: 'new.ts', line: i + 1, message: `Defect ${i + 1}.` })),
    finding({ file: 'new.ts', line: 99, message: 'Not in diff.' }),
    finding({ file: 'elsewhere.ts', line: 1, message: 'Other file.' }),
    finding({ severity: 'minor', file: 'new.ts', line: 2, message: 'Nit.' }),
    finding({ severity: 'blocker', file: undefined, line: undefined, message: 'General.' }),
  ];
  const w = world({ diff: manyLinesDiff(15), model: failing(findings) });
  await run(w);
  assert.equal(w.reviews.length, 1);
  const [review] = w.reviews;
  assert.equal(review.event, 'COMMENT');
  assert.equal(review.commit_id, SHA);
  assert.equal(MAX_INLINE, 10);
  assert.equal(review.comments.length, 10);
  assert.ok(review.comments.every(c => c.side === 'RIGHT' && c.path === 'new.ts' && c.line >= 1 && c.line <= 15 && /\*\*major\*\*/.test(c.body)));
  assert.match(ours(w)[0].body, /Not in diff/);
  assert.match(ours(w)[0].body, /General/);
  assert.equal(finalCheck(w).conclusion, 'failure');
});

test('inline comments skip minor findings, lines outside the diff and files outside the diff', async () => {
  const w = world({ diff: HUNK_DIFF, model: failing([
    finding({ line: 2, message: 'Keep A.' }), finding({ severity: 'blocker', line: 3, message: 'Keep B.' }),
    finding({ line: 99, message: 'Out of diff line.' }), finding({ file: 'elsewhere.ts', line: 1, message: 'Out of diff file.' }),
    finding({ severity: 'minor', line: 2, message: 'Just a nit.' }), finding({ line: 3, file: undefined, message: 'No location.' }),
  ]) });
  await run(w);
  assert.deepEqual(w.reviews[0].comments.map(c => [c.path, c.line]), [['client/Guide.tsx', 2], ['client/Guide.tsx', 3]]);
  assert.ok(w.reviews[0].comments.every(c => /Keep/.test(c.body)));
});

test('the harness can only comment: every review is COMMENT, even for request_changes, and no merge or approval call exists', async () => {
  for (const model of [verdict(), failing([finding()]), failing([])]) {
    const w = world({ diff: HUNK_DIFF, model });
    await run(w);
    assert.ok(w.reviews.every(r => r.event === 'COMMENT'));
    const allowed = [
      /^GET \/repos\/o\/r\/(installation|pulls\/5|issues\/5\/comments|pulls\/5\/comments)$/,
      /^POST \/app\/installations\/77\/access_tokens$/,
      /^POST \/repos\/o\/r\/(check-runs|issues\/5\/comments|pulls\/5\/reviews)$/,
      /^PATCH \/repos\/o\/r\/(check-runs\/900|issues\/comments\/\d+)$/,
    ];
    for (const c of w.calls.filter(c => c.host === 'api.github.com')) assert.ok(allowed.some(p => p.test(`${c.method} ${c.path}`)), `${c.method} ${c.path}`);
  }
  for (const file of ['review.mjs', 'feedback.mjs', 'github.mjs', 'main.mjs']) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /APPROVE|REQUEST_CHANGES|\/merge|\/dismissals|\/submissions/, file);
  }
});

test('a comment on someone else\'s forged marker is never edited; ours is created separately', async () => {
  const forged = { id: 7, user: { login: 'mallory' }, body: `${COMMENT_MARKER}\n<!-- head:${SHA} -->\nPassed` };
  const w = world({ diff: HUNK_DIFF, seed: [forged] });
  await run(w);
  assert.equal(forged.body.includes('Passed'), true);
  assert.equal(w.comments.length, 2);
  assert.equal(ours(w).length, 1);
});

test('publication failures are visible in the check and never change the verdict or leak secrets', async () => {
  const cases = {
    'comment create fails': { failOn: 'POST /repos/o/r/issues/5/comments', expect: /could not be published \(summary comment: status 500\)/ },
    'comment list fails': { failOn: 'GET /repos/o/r/issues/5/comments', expect: /could not be published/ },
    'review post fails': { failOn: 'POST /repos/o/r/pulls/5/reviews', expect: /inline comments could not be published \(status 500\)/, model: failing([finding()]) },
    'inline list fails': { failOn: 'GET /repos/o/r/pulls/5/comments', expect: /inline comments could not be published/, model: failing([finding()]) },
  };
  for (const [name, { expect, model = verdict(), failOn }] of Object.entries(cases)) {
    const w = world({ diff: HUNK_DIFF, model, failOn });
    const result = await run(w);
    assert.equal(result.conclusion, decide(parseVerdict(model)).conclusion, name);
    assert.equal(finalCheck(w).conclusion, result.conclusion, name);
    assert.match(finalCheck(w).output.summary, expect, name);
    assert.ok(!JSON.stringify(finalCheck(w)).includes(TOKEN), name);
  }
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
