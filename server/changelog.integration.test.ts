import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingFixture } from './coach-test-support.js';

const path = '/api/changelog';
const week = '2026-11-23';
test('members share a product catalogue within their active department', async (t) => {
  const f = await coachingFixture();
  t.after(() => f.close());
  const saved = await f.request('member', path + '/products', 'POST', {
    name: 'Lantern',
  });
  assert.equal(saved.status, 201);
  const product = await saved.json();
  const read = (role: string) =>
    f.request(role, path + '?week=' + week).then((r) => r.json());
  assert.deepEqual((await read('peer')).products, [product]);
  assert.deepEqual((await read('outsider')).products, []);
});

const url = 'https://github.com/JesusFilm/lantern/pull/17';
const input = {
  week,
  title: 'A clearer weekly plan',
  changed: 'Show the goal in context.',
  benefit: 'Members can find the next step.',
  links: [url],
};
test('only verified work can be published or edited, and the department retains its history', async (t) => {
  const f = await coachingFixture(undefined, undefined, {
    pullRequest: async (_repo: string, number: string) => {
      if (number === '99') throw new Error('unavailable');
      return {
        title: 'Show goal details',
        merged: number !== '18',
        base: number === '19' ? 'release' : 'main',
        defaultBranch: 'main',
      };
    },
  });
  t.after(() => f.close());
  const product = await (
    await f.request('member', path + '/products', 'POST', { name: 'Lantern' })
  ).json();
  const body = { ...input, productId: product.id };
  const save = (role: string, changes: object = {}, id?: string) =>
    f.request(
      role,
      path + '/entries' + (id ? '/' + id : ''),
      id ? 'PUT' : 'POST',
      { ...body, ...changes },
    );
  const read = async (role: string, query = '') =>
    (await (await f.request(role, path + '?week=' + week + query)).json())
      .entries;
  for (const changes of [
    { benefit: ' ' },
    { week: '2026-11-24' },
    { week: '0000-01-03' },
    { productId: '' },
    { authorId: f.ids.peer },
    { links: [] },
    { links: [url.replace('JesusFilm', 'another')] },
    { links: [url, url.replace('17', '18')] },
    { links: [url.replace('17', '19')] },
  ])
    assert.equal((await save('member', changes)).status, 400);
  assert.equal(
    (await save('member', { links: [url.replace('17', '99')] })).status,
    503,
  );
  assert.deepEqual(await read('member'), []);
  assert.equal((await save('outsider')).status, 400);
  const result = await save('member', {
    links: [url, url.replace('17', '20')],
  });
  assert.equal(result.status, 201);
  const { id } = await result.json();
  const [published] = await read('member', '&view=mine');
  assert.equal(published.product, 'Lantern');
  assert.equal(published.changed, input.changed);
  assert.equal(published.benefit, input.benefit);
  assert.deepEqual(
    published.links.map((pr: { url: string }) => pr.url),
    [url, url.replace('17', '20')],
  );
  assert.equal((await save('peer', {}, id)).status, 404);
  assert.equal((await save('outsider', {}, id)).status, 404);
  assert.equal((await save('member', { title: 'Revised' }, id)).status, 200);
  assert.equal(
    (await save('member', { links: [url.replace('17', '99')] }, id)).status,
    503,
  );
  assert.deepEqual(await read('peer', '&view=mine'), []);
  assert.deepEqual(await read('outsider'), []);
  await f.admin.query(
    'UPDATE memberships SET deleted_at=now() WHERE user_id=$1',
    [f.ids.member],
  );
  assert.equal((await f.request('member', path + '?week=' + week)).status, 403);
  const [entry] = await read('peer');
  assert.equal(entry.title, 'Revised');
  assert.equal(entry.author, 'member');
  assert.deepEqual(entry.links, [{ title: 'Show goal details', url }]);
});

test('hidden routes return 404 and a missing hosted verifier prevents publication', async (t) => {
  const { resolveFeatureConfig } = await import('./features.js');
  const flags = resolveFeatureConfig({}, 'local'),
    states = new Map(flags.states);
  const f = await coachingFixture(undefined, { ...flags, states });
  t.after(() => f.close());
  const product = await (
    await f.request('member', path + '/products', 'POST', { name: 'Video' })
  ).json();
  const draft = { ...input, productId: product.id };
  assert.equal(
    (await f.request('member', path + '/entries', 'POST', draft)).status,
    503,
  );
  assert.deepEqual(
    (await (await f.request('member', path + '?week=' + week)).json()).entries,
    [],
  );
  states.set('changelog', 'off');
  for (const [suffix, method, body] of [
    ['?week=' + week, 'GET', undefined],
    ['/products', 'POST', { name: 'Hidden' }],
    ['/entries', 'POST', draft],
    ['/entries/' + product.id, 'PUT', draft],
  ] as const)
    assert.equal(
      (await f.request('member', path + suffix, method, body)).status,
      404,
    );
});

test('ending membership while GitHub is verifying prevents the pending publication', async (t) => {
  let signalStarted!: () => void, resume!: () => void;
  const started = new Promise<void>(resolve => { signalStarted=resolve; });
  const waiting = new Promise<void>(resolve => { resume=resolve; });
  const f = await coachingFixture(undefined, undefined, {
    pullRequest: async () => {
      signalStarted();
      await waiting;
      return {
        title: 'Verified change',
        merged: true,
        defaultBranch: 'main',
        base: 'main',
      };
    },
  });
  t.after(() => f.close());
  const product = await (
    await f.request('peer', path + '/products', 'POST', { name: 'Lantern' })
  ).json();
  const pending = f.request('member', path + '/entries', 'POST', {
    ...input,
    productId: product.id,
  });
  await started;
  try {
    await f.admin.query(
      'UPDATE memberships SET deleted_at=now() WHERE user_id=$1',
      [f.ids.member],
    );
  } finally {
    resume();
  }
  assert.equal((await pending).status, 403);
  assert.deepEqual(
    (await (await f.request('peer', path + '?week=' + week)).json()).entries,
    [],
  );
});
