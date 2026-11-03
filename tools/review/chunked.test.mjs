import assert from 'node:assert/strict';
import { test } from 'node:test';
import { world, run, modelCalls, finalCheck, verdict, json } from './fake-github.mjs';

const change = path => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a\n+b\n`;
const paths = Array.from({ length: 6 }, (_, i) => `server/part${i}.test.mjs`);
const large = () => world({ diff: paths.map(change).join(''), contents: Object.fromEntries(paths.map(p => [`${p}@head`, `// ${p}\n${'x'.repeat(49000)}`])) });

test('large reviews deliver every complete file and require an integration verdict', async () => {
  const w = large();
  assert.equal((await run(w)).conclusion, 'success');
  const calls = modelCalls(w);
  assert.ok(calls.length > 2);
  for (const path of paths) assert.ok(calls.some(c => c.body.messages[0].content.includes(`// ${path}\n${'x'.repeat(49000)}`)), path);
  assert.match(calls.at(-1).body.messages[0].content, /integration review/i);
  assert.match(finalCheck(w).output.summary, /chunk reviews/);
});

test('integration rejection blocks otherwise approving chunk reviews', async () => {
  const w = large();
  const fetch = w.fetch;
  w.fetch = async (url, init) => {
    if (url.includes('gateway.example') && JSON.parse(init.body).messages[0].content.includes('integration review')) return json({ content: [{ type: 'text', text: verdict({ decision: 'request_changes', summary: 'Contract mismatch.' }) }] });
    return fetch(url, init);
  };
  assert.equal((await run(w)).conclusion, 'failure');
});

test('gateway deadline fails even when transport ignores cancellation', async () => {
  const { callModel } = await import('./gateway.mjs');
  await assert.rejects(callModel({ fetch: () => new Promise(() => {}), baseUrl: 'https://gateway.example', timeoutMs: 5 }), /timed out/);
});

test('a late invalid file prevents all inference', async () => {
  const w = large();
  const fetch = w.fetch;
  w.fetch = (url, init) => url.includes('contents/server/part5.test.mjs') ? Promise.resolve(new Response(new Uint8Array([255]))) : fetch(url, init);
  assert.equal((await run(w)).conclusion, 'failure');
  assert.equal(modelCalls(w).length, 0);
});

test('valid diffs above the old byte cap are completely reviewed', async () => {
  const diff = Array.from({ length: 5 }, (_, i) => `diff --git a/added${i}.test.ts b/added${i}.test.ts\nnew file mode 100644\n--- /dev/null\n+++ b/added${i}.test.ts\n@@ -0,0 +1 @@\n+${String(i).repeat(39000)}\n`).join('');
  const w = world({ diff });
  assert.equal((await run(w)).conclusion, 'success');
  for (let i = 0; i < 5; i++) assert.equal(modelCalls(w).filter(c => c.body.messages[0].content.includes(String(i).repeat(39000))).length, 1);
});

test('integration receives raw callers and contracts from different packets', async () => {
  const names = ['server/caller.ts', 'shared/contract.ts', ...paths];
  const w = world({ diff: names.map(change).join(''), contents: Object.fromEntries(names.map(p => [`${p}@head`, `// ${p}\n${'x'.repeat(40000)}`])) });
  assert.equal((await run(w)).conclusion, 'success');
  const integration = modelCalls(w).at(-1).body.messages[0].content;
  for (const p of names.slice(0, 2)) assert.ok(integration.includes(`// ${p}\n${'x'.repeat(40000)}`));
});

test('a late rejection explanation survives verbose approving summaries', async () => {
  const w = large();
  const fetch = w.fetch;
  w.fetch = async (url, init) => {
    if (!url.includes('gateway.example')) return fetch(url, init);
    const integration = JSON.parse(init.body).messages[0].content.includes('integration review');
    return json({ content: [{ type: 'text', text: verdict(integration ? { decision: 'request_changes', summary: 'Required contract is inconsistent.' } : { summary: 'Looks correct. '.repeat(400) }) }] });
  };
  await run(w);
  assert.equal(finalCheck(w).conclusion, 'failure');
  assert.match(finalCheck(w).output.summary, /Integration: Required contract is inconsistent/);
  assert.match(finalCheck(w).output.summary, /summaries truncated/);
});

test('integration and browser tests in server and protected paths stay worker-assessed only', async () => {
  const tests = [
    'server/accounts.integration.test.ts',
    'server/accounts.browser.test.ts',
    'server/accounts.integration.test.mjs',
    'tools/release/acceptance-fixture.integration.test.mjs',
    'tools/review/contract.integration.test.mjs',
    'tools/review/fixtures/example.mjs',
  ];
  const names = ['server/caller.ts', 'shared/contract.ts', ...tests];
  const contents = Object.fromEntries(names.map(p => [`${p}@head`, `// RAW ${p}\n${'x'.repeat(40000)}`]));
  const w = world({ diff: names.map(change).join(''), contents });
  assert.equal((await run(w)).conclusion, 'success');
  const calls = modelCalls(w);
  const integration = calls.at(-1).body.messages[0].content;
  assert.match(integration, /integration review/);
  for (const path of tests) {
    assert.ok(integration.includes(path), 'inventory still accounts for ' + path);
    assert.ok(!integration.includes(`// RAW ${path}`), 'integration excludes raw test/fixture: ' + path);
    assert.ok(!integration.includes(`diff --git a/${path}`), 'integration excludes test/fixture patch: ' + path);
    assert.equal(calls.slice(0, -1).filter(c => c.body.messages[0].content.includes(contents[`${path}@head`])).length, 1, 'complete test/fixture reaches exactly one worker: ' + path);
  }
  for (const path of names.slice(0, 2)) assert.ok(integration.includes(contents[`${path}@head`]), 'integration retains raw implementation: ' + path);
});
