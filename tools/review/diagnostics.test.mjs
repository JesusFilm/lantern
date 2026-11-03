import assert from 'node:assert/strict';
import { test } from 'node:test';
import { world, run, finalCheck, verdict, KEY, TOKEN, json } from './fake-github.mjs';

test('malformed model response identifies reviewer and round without exposing response or credentials', async () => {
  const secret = 'PRIVATE_RESPONSE_CONTENT';
  const w = world({ model: `Review ${secret}: ` + verdict() });
  const events = [];
  assert.equal((await run(w, { diagnostic: event => events.push(event) })).conclusion, 'failure');
  assert.match(finalCheck(w).output.summary, /not a single JSON object/);
  assert.equal(events.length, 1);
  assert.equal(events[0].reviewer, 'chunk-1');
  assert.equal(events[0].round, 1);
  assert.equal(events[0].outcome, 'invalid-response');
  assert.equal(events[0].stopReason, 'end_turn');
  assert.equal(events[0].textBlocks, 1);
  assert.equal(events[0].start, 'other');
  assert.ok(events[0].textBytes > 0);
  assert.match(events[0].structure, /\{/);
  for (const value of [secret, KEY, TOKEN, 'Looks correct.', 'decision', 'approve']) assert.ok(!JSON.stringify(events).includes(value));
});

test('diagnostics distinguish a later context round from the first response', async () => {
  const w = world();
  const fetch = w.fetch;
  let calls = 0;
  w.fetch = (url, init) => {
    if (!url.includes('gateway.example')) return fetch(url, init);
    return Promise.resolve(json({ stop_reason: 'end_turn', content: [{ type: 'text', text: calls++ === 0 ? '{"request_context":["dependency"]}' : '{"unfinished":"SECRET' }] }));
  };
  const events = [];
  assert.equal((await run(w, { diagnostic: event => events.push(event) })).conclusion, 'failure');
  assert.deepEqual(events.map(e => [e.reviewer, e.round, e.outcome]), [['chunk-1', 1, 'context-request'], ['chunk-1', 2, 'invalid-response']]);
  assert.match(events[1].structure, /unclosed/);
  assert.ok(!JSON.stringify(events).includes('SECRET'));
});

test('integration response is identified separately from successful chunk verdicts', async () => {
  const paths = Array.from({ length: 6 }, (_, i) => `server/part${i}.test.mjs`);
  const diff = paths.map(path => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-a\n+b\n`).join('');
  const w = world({ diff, contents: Object.fromEntries(paths.map(p => [`${p}@head`, 'x'.repeat(49000)])) });
  const fetch = w.fetch;
  w.fetch = (url, init) => url.includes('gateway.example') && JSON.parse(init.body).messages[0].content.includes('integration review')
    ? Promise.resolve(json({ content: [{ type: 'text', text: 'not JSON' }] })) : fetch(url, init);
  const events = [];
  assert.equal((await run(w, { diagnostic: event => events.push(event) })).conclusion, 'failure');
  assert.ok(events.length > 2);
  assert.ok(events.slice(0, -1).every(e => e.outcome === 'verdict' && e.reviewer.startsWith('chunk-')));
  assert.equal(events.at(-1).reviewer, 'integration');
  assert.equal(events.at(-1).outcome, 'invalid-response');
});

test('truncation retains safe gateway metadata while arbitrary metadata and text remain private', async () => {
  const w = world();
  const fetch = w.fetch;
  w.fetch = (url, init) => url.includes('gateway.example') ? Promise.resolve(json({
    stop_reason: 'max_tokens', usage: { output_tokens: 4000, input_tokens: 'SECRET' },
    id: 'SECRET', content: [{ type: 'text', text: 'SECRET' }],
  })) : fetch(url, init);
  const events = [];
  assert.equal((await run(w, { diagnostic: event => events.push(event) })).conclusion, 'failure');
  assert.match(finalCheck(w).output.summary, /truncated/);
  assert.equal(events[0].stopReason, 'max_tokens');
  assert.equal(events[0].outputTokens, 4000);
  assert.ok(!JSON.stringify(events).includes('SECRET'));
});

test('diagnostic structure is bounded, hides escaped string content and unknown stop reasons', async () => {
  const w = world();
  const fetch = w.fetch;
  w.fetch = (url, init) => url.includes('gateway.example') ? Promise.resolve(json({
    stop_reason: 'SECRET', usage: { output_tokens: 'SECRET' },
    content: [{ type: 'text', text: '"escaped \\" SECRET" ' + '{}'.repeat(500) }],
  })) : fetch(url, init);
  const events = [];
  assert.equal((await run(w, { diagnostic: event => events.push(event) })).conclusion, 'failure');
  assert.equal(events[0].stopReason, 'other');
  assert.equal(events[0].structureClipped, true);
  assert.ok(events[0].structure.length <= 240);
  assert.ok(!JSON.stringify(events).includes('SECRET'));
});

test('long supported thinking wrappers cannot hide the verdict structure that failed parsing', async () => {
  const w = world({ model: '<think>' + 'PRIVATE_REASONING '.repeat(100) + '</think>\n' + verdict() + ' EXTRA_PRIVATE_PROSE' });
  const events = [];
  assert.equal((await run(w, { diagnostic: event => events.push(event) })).conclusion, 'failure');
  assert.equal(events[0].start, 'think');
  assert.equal(events[0].structure, '{"…":"…","…":"…","…":[]}<value>');
  assert.equal(events[0].structureClipped, false);
  assert.ok(!JSON.stringify(events).includes('PRIVATE'));
});
