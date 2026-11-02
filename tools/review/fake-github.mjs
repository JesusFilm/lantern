import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { APP_LOGIN, COMMENT_MARKER } from './feedback.mjs';
import { runReview } from './review.mjs';

export const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
export const SHA = 'a'.repeat(40);
export const KEY = 'sk-test-SECRET-gateway-key';
export const TOKEN = 'ghs_SECRETinstallationtoken';

export const b64 = value => Buffer.from(value, 'base64url').toString();
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const DIFF = 'diff --git a/client/Guide.tsx b/client/Guide.tsx\n--- a/client/Guide.tsx\n+++ b/client/Guide.tsx\n@@ -1 +1 @@\n-a\n+b\n';
export const WORKFLOW_DIFF = 'diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml\n--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@ -1 +1 @@\n-a\n+b\n';
export const verdict = (patch = {}) => JSON.stringify({ decision: 'approve', summary: 'Looks correct.', findings: [], ...patch });
export const BASE = 'd'.repeat(40);
export const SHA_B = 'b'.repeat(40);

export function filesFromDiff(diff) {
  return diff.split(/^(?=diff --git )/m).filter(x => x.startsWith('diff --git ')).map(section => {
    const lines = section.split('\n');
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(lines[0]);
    const renameTo = /^rename to (.+)$/m.exec(section)?.[1];
    const plus = /^\+\+\+ b\/(.+)$/m.exec(section)?.[1];
    const first = lines.findIndex(l => l.startsWith('@@'));
    const patch = first < 0 ? undefined : lines.slice(first).join('\n').replace(/\n$/, '');
    const file = {
      filename: renameTo ?? plus ?? header[2],
      status: /^new file mode/m.test(section) ? 'added' : /^deleted file mode/m.test(section) ? 'removed' : /^rename from/m.test(section) ? 'renamed' : 'modified',
      additions: patch ? patch.split('\n').filter(l => /^\+/.test(l)).length : 0,
      deletions: patch ? patch.split('\n').filter(l => /^-/.test(l)).length : 0,
    };
    file.changes = file.additions + file.deletions;
    if (patch) file.patch = patch;
    if (file.status === 'renamed') file.previous_filename = /^rename from (.+)$/m.exec(section)[1];
    return file;
  });
}

export function world({ headSha = SHA, heads, state = 'open', diff = DIFF, files, compares = {}, diffStatus = 200, listStatus = 200, contents = {}, model = verdict(), modelStatus = 200, stopReason = 'end_turn', failOn, failFirst, seed = [], shared, checkIds = [], moveHeadAfterModel, traps = [] } = {}) {
  const calls = [];
  const checks = [];
  const comments = shared ?? [...seed];
  const reviewComments = [];
  const reviews = [];
  const sequence = heads ? [...heads] : null;
  const state_ = { head: headSha };
  const failed = new Set();
  let nextId = 1000;
  const nextCommentId = () => Math.max(1000, ...comments.map(c => c.id + 1));
  const ids = [...checkIds];
  const contentFor = (path, ref) => {
    const key = `${path}@${ref === BASE ? 'base' : ref === SHA ? 'head' : ref}`;
    if (key in contents) return contents[key];
    if (ref === BASE) return path === 'AGENTS.md' ? 'Trusted base guidance.' : null;
    return `Complete head content of ${path}.`;
  };
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const call = { method, host: u.host, path: u.pathname, search: u.search, headers: init.headers, body };
    calls.push(call);
    const key = `${method} ${u.pathname}`;
    for (const trap of traps) {
      if (trap.done || !key.startsWith(trap.on)) continue;
      trap.count = (trap.count ?? 0) + 1;
      const first = trap.nth ?? 1;
      if (trap.count < first) continue;
      if (trap.count >= first + (trap.times ?? 1) - 1) trap.done = true;
      trap.before?.(api_);
    }
    const result = await handle(u, method, body, init, key);
    for (const trap of traps) if (trap.done && !trap.afterRan && trap.after && key.startsWith(trap.on)) { trap.afterRan = true; trap.after(api_); }
    return result;
  };
  const api_ = { state: state_, comments, reviewComments, calls, checks };
  const handle = async (u, method, body, init, key) => {
    if (failOn === key) return json({ message: `boom ${TOKEN}` }, 500);
    if (failFirst === key && !failed.has(key)) { failed.add(key); return json({ message: 'flaky' }, 500); }
    if (u.host === 'gateway.example') {
      if (moveHeadAfterModel) state_.head = moveHeadAfterModel;
      return modelStatus === 200 ? json({ stop_reason: stopReason, content: [{ type: 'text', text: model }] }) : json({ error: KEY }, modelStatus);
    }
    if (method === 'GET' && u.pathname === '/repos/o/r/installation') return json({ id: 77 });
    if (method === 'POST' && u.pathname === '/app/installations/77/access_tokens') return json({ token: TOKEN, permissions: body.permissions });
    if (method === 'GET' && u.pathname === '/repos/o/r/pulls/5') {
      if (String(init.headers?.Accept).includes('diff')) return new Response('THE CURRENT-HEAD DIFF MUST NOT BE USED', { status: 200 });
      if (state_.pullFails) return json({ message: 'down' }, 503);
      const head = sequence ? (sequence.length > 1 ? sequence.shift() : sequence[0]) : state_.head;
      return json({ state, number: 5, title: 'T', body: 'B', head: { sha: head }, base: { ref: 'main', sha: BASE } });
    }
    const compare = /^\/repos\/o\/r\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/.exec(u.pathname);
    if (method === 'GET' && compare) {
      const entry = compares[`${compare[1]}...${compare[2]}`] ?? { diff, files: files ?? filesFromDiff(diff) };
      if (String(init.headers?.Accept).includes('diff')) return diffStatus === 200 ? new Response(entry.diff, { status: 200 }) : json({ message: 'too large' }, diffStatus);
      return listStatus === 200 ? json({ status: 'ahead', files: entry.files }) : json({ message: 'nope' }, listStatus);
    }
    const content = /^\/repos\/o\/r\/contents\/(.+)$/.exec(u.pathname);
    if (method === 'GET' && content) {
      const found = contentFor(decodeURIComponent(content[1]), u.searchParams.get('ref'));
      if (found === null) return json({ message: 'Not Found' }, 404);
      return typeof found === 'number' ? json({ message: 'err' }, found) : new Response(found, { status: 200 });
    }
    const checkRun = /^\/repos\/o\/r\/check-runs\/(\d+)$/.exec(u.pathname);
    if (method === 'GET' && checkRun) { const done = checks.findLast(c => c.patch && c.run === Number(checkRun[1])); return json(done ? { id: done.run, status: 'completed', conclusion: done.conclusion } : { id: Number(checkRun[1]), status: 'in_progress' }); }
    if (method === 'POST' && u.pathname === '/repos/o/r/check-runs') { checks.push({ ...body }); return json({ id: ids.shift() ?? 900 }, 201); }
    if (method === 'PATCH' && /^\/repos\/o\/r\/check-runs\/\d+$/.test(u.pathname) && state_.failCheckPatch) return json({ message: 'down' }, 502);
    if (method === 'PATCH' && /^\/repos\/o\/r\/check-runs\/\d+$/.test(u.pathname)) { checks.push({ ...body, patch: true, run: Number(u.pathname.split('/').at(-1)) }); return json({ id: 900 }); }
    const page = items => json(items.slice((Number(u.searchParams.get('page') ?? 1) - 1) * 100, Number(u.searchParams.get('page') ?? 1) * 100));
    if (method === 'GET' && u.pathname === '/repos/o/r/issues/5/comments') return page(comments);
    if (method === 'POST' && u.pathname === '/repos/o/r/issues/5/comments' && state_.failComments) return json({ message: 'down' }, 500);
    if (method === 'POST' && u.pathname === '/repos/o/r/issues/5/comments') { const c = { id: nextCommentId(), user: { login: APP_LOGIN }, body: body.body }; comments.push(c); return json(c, 201); }
    const edit = /^\/repos\/o\/r\/issues\/comments\/(\d+)$/.exec(u.pathname);
    if (method === 'PATCH' && edit && state_.failComments) return json({ message: 'down' }, 500);
    if (method === 'PATCH' && edit) { const c = comments.find(x => x.id === Number(edit[1])); if (!c || c.user.login !== APP_LOGIN) return json({ message: 'not yours' }, 403); c.body = body.body; return json(c); }
    if (method === 'GET' && u.pathname === '/repos/o/r/pulls/5/comments') return page(reviewComments);
    if (method === 'POST' && u.pathname === '/repos/o/r/pulls/5/reviews') { const reviewId = nextId++; reviews.push(body); for (const c of body.comments ?? []) reviewComments.push({ id: nextId++, user: { login: APP_LOGIN }, pull_request_review_id: reviewId, ...c }); return json({ id: reviewId }, 200); }
    const removal = /^\/repos\/o\/r\/pulls\/comments\/(\d+)$/.exec(u.pathname);
    if (method === 'DELETE' && removal) { const at = reviewComments.findIndex(c => c.id === Number(removal[1])); if (state_.failDelete) return json({ message: 'down' }, 500); if (at < 0) return json({ message: 'Not Found' }, 404); reviewComments.splice(at, 1); return new Response(null, { status: 204 }); }
    return json({ message: `unexpected ${method} ${u.pathname}` }, 404);
  };
  return { fetch, calls, checks, comments, reviewComments, reviews, state: state_ };
}
export const config = { repository: 'o/r', prNumber: 5, expectedSha: SHA, appId: '5571876', privateKey: pem, gatewayBaseUrl: 'https://gateway.example', gatewayApiKey: KEY, model: 'qwen-test' };
export const run = (w, patch = {}) => runReview({ ...config, ...patch, fetch: w.fetch });
export const finalCheck = w => w.checks.at(-1);
export const completionCheck = w => w.checks.find(c => c.patch);
export const HUNK_DIFF = 'diff --git a/client/Guide.tsx b/client/Guide.tsx\n--- a/client/Guide.tsx\n+++ b/client/Guide.tsx\n@@ -1,3 +1,4 @@\n a\n-b\n+B\n+c\n d\n';
export const manyLinesDiff = n => `diff --git a/new.ts b/new.ts\n--- /dev/null\n+++ b/new.ts\n@@ -0,0 +1,${n} @@\n${Array.from({ length: n }, (_, i) => `+line ${i + 1}`).join('\n')}\n`;
export const finding = (patch = {}) => ({ severity: 'major', file: 'client/Guide.tsx', line: 2, message: 'Bug here.', ...patch });
export const failing = findings => verdict({ decision: 'request_changes', summary: 'Needs work.', findings });
export const writes = w => w.calls.filter(c => c.host === 'api.github.com' && c.method !== 'GET' && !/check-runs|access_tokens/.test(c.path));
export const ours = w => w.comments.filter(c => c.user.login === APP_LOGIN && c.body.startsWith(COMMENT_MARKER));
export const OTHER_DIFF = 'diff --git a/client/Other.tsx b/client/Other.tsx\n--- a/client/Other.tsx\n+++ b/client/Other.tsx\n@@ -1 +1 @@\n-x\n+y\n';
export const BINARY = 'diff --git a/logo.png b/logo.png\nnew file mode 100644\nindex 0000000..1111111\nBinary files /dev/null and b/logo.png differ\n';
export const MODE_ONLY = 'diff --git a/run.sh b/run.sh\nold mode 100644\nnew mode 100755\n';
export const RENAME = 'diff --git a/old-name.ts b/new-name.ts\nsimilarity index 100%\nrename from old-name.ts\nrename to new-name.ts\n';
export const EMPTY_ADDED = 'diff --git a/empty.txt b/empty.txt\nnew file mode 100644\nindex 0000000..e69de29\n';
export const modelCalls = w => w.calls.filter(c => c.host === 'gateway.example');
export const userMessage = w => modelCalls(w)[0].body.messages[0].content;
export const systemPrompt = w => modelCalls(w)[0].body.system;
export const github = (w, re) => w.calls.filter(c => c.host === 'api.github.com' && re.test(`${c.method} ${c.path}`));
export const olderComment = (sha, text = 'Passed', runId = 1) => ({ id: 7, user: { login: APP_LOGIN }, body: `${COMMENT_MARKER}\n<!-- head:${sha} -->\n<!-- run:${runId} -->\n## Independent review\n\n**${text}**` });
export const section = (name, ...hunks) => `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n${hunks.join('')}`;

export const HUNK_1 = '@@ -1,3 +1,3 @@\n a\n-b\n+B\n d\n';

export const HUNK_2 = '@@ -10,3 +10,3 @@\n x\n-y\n+Y\n z\n';
export const TWO_HUNKS = section('client/Guide.tsx', HUNK_1, HUNK_2);
export const ONE_HUNK = section('client/Guide.tsx', HUNK_1);
export const AUTH_DIFF = section('server/auth.ts', '@@ -1 +1 @@\n-a\n+b\n');
export const authContents = text => ({ 'server/auth.ts@head': text });

export const summaryOf = w => ours(w).map(c => c.body).join('\n---\n');
export const forB = text => ({ id: 5000, user: { login: APP_LOGIN }, body: `${COMMENT_MARKER}\n<!-- head:${SHA_B} -->\n<!-- run:1 -->\n## Independent review\n\n**${text}** for the newer head` });
export const workflow = readFileSync(new URL('../../.github/workflows/independent-review.yml', import.meta.url), 'utf8');
