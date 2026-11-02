import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { CONTEXT_FILE_MAX, CONTEXT_TOTAL_MAX, guidancePaths, loadFileContext, loadGuidance } from './context.mjs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const exists = path => { try { read(path); return true; } catch { return false; } };

const GATE_FILES = [
  ...readdirSync(new URL('tools/review/', root)).filter(name => name.endsWith('.mjs')).map(name => `tools/review/${name}`),
  '.github/workflows/independent-review.yml',
  'docs/operations/review-gate.md',
];
const GUIDANCE = ['AGENTS.md', 'CONTEXT.md', 'GLOSSARY.md', 'docs/development/testing.md', 'docs/operations/review-gate.md', 'docs/adrs/AGENTS.md', 'docs/operations/releasing.md'].filter(exists);

const repoFetch = async url => {
  const path = decodeURIComponent(new URL(url).pathname.replace('/repos/o/r/contents/', ''));
  return exists(path) ? new Response(read(path), { status: 200 }) : new Response('missing', { status: 404 });
};
const modified = path => ({ filename: path, status: 'modified', patch: '@@ -1 +1 @@\n-a\n+b', additions: 1, deletions: 1, changes: 2 });
const load = files => loadFileContext({ fetch: repoFetch, token: 't', repository: 'o/r', headSha: 'a'.repeat(40), files });

test('P1 context limits: every file of the gate keeps headroom under the per-file limit, so a real edit stays reviewable', async () => {
  assert.ok(GATE_FILES.length >= 15, `found ${GATE_FILES.length} gate files`);
  for (const path of GATE_FILES) {
    const size = read(path).length;
    assert.ok(size <= CONTEXT_FILE_MAX * 2 / 3, `${path} is ${size} characters; split it before it approaches the ${CONTEXT_FILE_MAX} limit`);
    const [entry] = await load([modified(path)]);
    assert.equal(entry.omitted, undefined, path);
    assert.equal(entry.clipped, undefined, `${path} would be cut off even for a one-line change`);
    assert.equal(entry.text.length, size, path);
  }
});

test('P1 context limits: a change touching every file of the gate at once still fits the total budget with headroom', async () => {
  const total = GATE_FILES.reduce((sum, path) => sum + read(path).length, 0);
  assert.ok(total <= CONTEXT_TOTAL_MAX * 0.9, `the gate files total ${total} characters against a ${CONTEXT_TOTAL_MAX} budget`);
  const entries = await load(GATE_FILES.map(modified));
  assert.equal(entries.length, GATE_FILES.length);
  assert.deepEqual(entries.filter(e => e.omitted || e.clipped).map(e => e.path), []);
});

test('P1 context limits: the real trusted guidance fits whole, for every path class that adds a guidance file', async () => {
  const paths = ['tools/review/review.mjs', 'docs/adrs/0001-x.md', '.github/workflows/ci.yml', 'docs/operations/releasing.md'];
  const wanted = guidancePaths(paths).map(item => item.path);
  assert.deepEqual(wanted.filter(path => !GUIDANCE.includes(path)), [], 'every guidance path the loader asks for exists in the repository');
  assert.equal(wanted.length, 7);
  const loaded = await loadGuidance({ fetch: repoFetch, token: 't', repository: 'o/r', baseSha: 'd'.repeat(40), paths });
  assert.ok(loaded.length >= 5, `loaded ${loaded.length} guidance files`);
  assert.deepEqual(loaded.filter(file => file.omitted || file.clipped).map(file => file.path), []);
  for (const file of loaded) assert.ok(file.text.length <= 20_000, `${file.path} is ${file.text.length} characters, over two thirds of the 30,000 guidance limit`);
  assert.ok(loaded.reduce((sum, file) => sum + file.text.length, 0) <= 45_000, 'guidance total is within three quarters of the 60,000 budget');
});

test('P1 context limits: a file over the limit is clipped and reported, so the headroom assertions above are what keep the gate usable', async () => {
  const big = { fetch: async () => new Response('x'.repeat(CONTEXT_FILE_MAX + 1), { status: 200 }), token: 't', repository: 'o/r', headSha: 'a'.repeat(40), files: [modified('big.mjs')] };
  const [entry] = await loadFileContext(big);
  assert.equal(entry.clipped, true);
});
