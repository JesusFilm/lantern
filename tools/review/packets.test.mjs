import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as tick } from 'node:timers/promises';
import { planPackets, reviewPool } from './packets.mjs';

test('packets preserve every diff section and full matching context exactly once', () => {
  const sections = [
    { path: 'src/a', text: 'first\n' },
    { path: 'src/b', text: 'second\n' },
    { path: 'src/a', text: 'third\n' },
    { path: 'deleted', text: 'removed\n' },
  ];
  const context = [
    { path: 'src/a', text: 'complete A\n' },
    { path: 'src/b', text: 'complete B\n' },
    { path: 'unrelated', text: 'not changed' },
  ];
  const expected = [{
    diff: 'first\nthird\nsecond\nremoved\n',
    files: context.slice(0, 2),
    paths: ['src/a', 'src/b', 'deleted'],
  }];
  assert.deepEqual(planPackets({ sections, context }), expected);
  assert.deepEqual(planPackets({ sections, context }), expected);
  assert.deepEqual(planPackets({ sections: [], context }), [{ diff: '', files: [], paths: [] }]);
});

test('pool supports serial, oversized concurrency and empty input, and rejects invalid bounds', async () => {
  let active = 0;
  const worker = async item => {
    assert.equal(++active, 1);
    await tick();
    active--;
    return item.toUpperCase();
  };
  assert.deepEqual(await reviewPool(['a', 'b', 'c'], worker, 1), ['A', 'B', 'C']);
  assert.deepEqual(await reviewPool(['a'], worker, 10), ['A']);
  assert.deepEqual(await reviewPool([], () => assert.fail('empty pool started work')), []);
  for (const concurrency of [0, -1, 1.5, Infinity, NaN]) {
    await assert.rejects(reviewPool(['a'], worker, concurrency), /concurrency/i);
  }
});

test('pool rejects the original error and never starts queued work after failure', async () => {
  const failure = new Error('worker failed');
  let release;
  let fail;
  const held = new Promise(resolve => { release = resolve; });
  const broken = new Promise((resolve, reject) => { fail = reject; });
  const started = [];
  const pending = reviewPool([0, 1, 2, 3], async item => {
    started.push(item);
    if (item === 0) return broken;
    await held;
    return item;
  }, 2);
  const rejected = assert.rejects(pending, error => error === failure);
  assert.deepEqual(started, [0, 1]);
  fail(failure);
  await rejected;
  release();
  await tick();
  assert.deepEqual(started, [0, 1]);
  await assert.rejects(reviewPool([0, 1], () => { throw failure; }, 1), error => error === failure);
});

test('review pool bounds concurrency at three by default and returns results in input order', async () => {
  const gates = Array.from({ length: 5 }, () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
  });
  const started = [];
  let active = 0;
  let peak = 0;
  const pending = reviewPool([0, 1, 2, 3, 4], async (item, index) => {
    assert.equal(index, item);
    started.push(item);
    peak = Math.max(peak, ++active);
    await gates[item].promise;
    active--;
    return `result-${item}`;
  });
  try {
    assert.deepEqual(started, [0, 1, 2]);
    gates[2].resolve();
    await tick();
    assert.deepEqual(started, [0, 1, 2, 3]);
    gates[3].resolve();
    await tick();
    assert.deepEqual(started, [0, 1, 2, 3, 4]);
  } finally {
    gates.forEach(gate => gate.resolve());
  }
  assert.deepEqual(await pending, ['result-0', 'result-1', 'result-2', 'result-3', 'result-4']);
  assert.equal(peak, 3);
});

test('all sections survive splitting, with at most twenty packets', () => {
  const sections = Array.from({ length: 21 }, (_, i) => ({ path: `src/${i}`, text: `diff-${i}\n` }));
  const context = sections.map(({ path }, i) => ({ path, text: `full-${i}\n` }));
  const packets = planPackets({ sections: sections.slice(0, 20), context, maxBytes: 8020 });
  assert.equal(packets.length, 20);
  assert.deepEqual(packets.flatMap(packet => packet.paths), sections.slice(0, 20).map(section => section.path));
  assert.equal(packets.map(packet => packet.diff).join(''), sections.slice(0, 20).map(section => section.text).join(''));
  assert.deepEqual(packets.flatMap(packet => packet.files), context.slice(0, 20));
  assert.throws(() => planPackets({ sections, context, maxBytes: 8020 }), /20.*packet|packet.*20/i);
});

test('packet limits count UTF-8 diff, full context, guidance and overhead per packet', () => {
  const sections = [{ path: 'a', text: 'é' }, { path: 'b', text: 'b' }];
  const context = [{ path: 'a', text: '🙂' }, { path: 'b', text: 'BB' }];
  assert.deepEqual(planPackets({ sections, context, guidanceBytes: 10, maxBytes: 8019 }), [{
    diff: 'éb', files: context, paths: ['a', 'b'],
  }]);
  assert.deepEqual(planPackets({ sections, context, guidanceBytes: 10, maxBytes: 8018 }), [
    { diff: 'é', files: [context[0]], paths: ['a'] },
    { diff: 'b', files: [context[1]], paths: ['b'] },
  ]);
  assert.throws(() => planPackets({ sections, context, guidanceBytes: 10, maxBytes: 8015 }), /a.*(large|limit|exceed)/i);
  assert.throws(() => planPackets({ sections: [{ path: 'huge', text: 'x'.repeat(192001) }], context: [] }), /huge.*(large|limit|exceed)/i);
});
