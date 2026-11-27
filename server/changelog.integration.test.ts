import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrate } from './schema.js';
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
      { ...body, ...(id ? { revision: 1 } : { publicationKey: randomUUID() }), ...changes },
    );
  const read = async (role: string, query = '') =>
    (await (await f.request(role, path + '?week=' + week + query)).json())
      .entries;
  for (const changes of [
    { publicationKey: undefined },
    { publicationKey: 'invalid' },
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
    (await save('member', { links: [url.replace('17', '99')], revision: published.revision + 1 }, id)).status,
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
  const draft = { ...input, publicationKey: randomUUID(), productId: product.id };
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
    publicationKey: randomUUID(),
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

const verified = { title: 'Verified change', merged: true, base: 'main', defaultBranch: 'main' };

test('overlapping publications share one result within an author and department', { timeout: 15000 }, async (t) => {
  let release!: () => void;
  const bothVerifying = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const f = await coachingFixture(undefined, undefined, {
    pullRequest: async () => {
      if (++calls === 2) release();
      await bothVerifying;
      return verified;
    },
  });
  t.after(() => f.close());
  const products = async (role: string) =>
    (await (await f.request(role, path + '/products', 'POST', { name: 'Lantern' })).json()).id;
  const body = { ...input, productId: await products('member'), publicationKey: randomUUID() };
  const publish = (role: string, changes = {}) =>
    f.request(role, path + '/entries', 'POST', { ...body, ...changes });
  const [a, b] = await Promise.all([publish('member'), publish('member')]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  const original = await a.json();
  assert.deepEqual(await b.json(), original);
  assert.equal((await publish('member', { title: 'Changed draft' })).status, 409);
  for (const response of [
    await publish('member', { publicationKey: randomUUID() }),
    await publish('peer'),
    await publish('outsider', { productId: await products('outsider') }),
  ]) {
    assert.equal(response.status, 201);
    assert.notEqual((await response.json()).id, original.id);
  }
  const entries = async (role: string) =>
    (await (await f.request(role, path + '?week=' + week)).json()).entries;
  assert.equal((await entries('peer')).length, 3);
  assert.equal((await entries('outsider')).length, 1);
});

test('edits require the revision the author read and preserve the winning edit', { timeout: 15000 }, async (t) => {
  let signalVerification!: () => void;
  let finishVerification!: () => void;
  const verifying = new Promise<void>((resolve) => { signalVerification = resolve; });
  const resume = new Promise<void>((resolve) => { finishVerification = resolve; });
  const f = await coachingFixture(undefined, undefined, {
    pullRequest: async (_repo, number) => {
      if (number === '18') {
        signalVerification();
        await resume;
      }
      return verified;
    },
  });
  t.after(() => f.close());
  const product = await (await f.request('member', path + '/products', 'POST', { name: 'Lantern' })).json();
  const body = { ...input, productId: product.id };
  const published = await f.request('member', path + '/entries', 'POST', { ...body, publicationKey: randomUUID() });
  assert.equal(published.status, 201);
  const { id } = await published.json();
  const read = async () => (await (await f.request('member', path + '?week=' + week)).json()).entries[0];
  const first = await read();
  const second = await read();
  const edit = (changes: object) => f.request('member', path + '/entries/' + id, 'PUT', { ...body, ...changes });
  const pending = edit({ benefit: 'Stale draft', links: [url.replace('17', '18')], revision: second.revision });
  await verifying;
  try {
    assert.equal((await edit({ title: 'New title', revision: first.revision })).status, 200);
  } finally {
    finishVerification();
  }
  assert.equal((await pending).status, 409);
  const saved = await read();
  assert.equal(saved.title, 'New title');
  assert.equal(saved.benefit, input.benefit);
  assert.equal(saved.revision, first.revision + 1);
  for (const revision of [undefined, '1', 0, 1.5])
    assert.equal((await edit({ revision })).status, 400);
});

test('schema 20 preserves existing publications and lets their authors edit from revision one', async (t) => {
  const f = await coachingFixture(undefined, undefined, { pullRequest: async () => verified });
  t.after(() => f.close());
  await f.migration.query(`
    ALTER TABLE changelog_entries DROP COLUMN publication_key, DROP COLUMN publication_hash, DROP COLUMN revision;
    DELETE FROM schema_migrations WHERE version=20;
  `);
  const product = await (await f.request('member', path + '/products', 'POST', { name: 'Lantern' })).json();
  const legacyInsert = async (title: string) => {
    const id = randomUUID();
    await f.runtime.query(
      `INSERT INTO changelog_entries(id,department_id,author_id,week,product_id,title,changed,benefit,links)
       SELECT $1,department_id,user_id,$3,$4,$5,$6,$7,$8 FROM memberships WHERE user_id=$2`,
      [id, f.ids.member, week, product.id, title, input.changed, input.benefit, JSON.stringify([{ url, title: verified.title }])],
    );
    return id;
  };
  const oldId = await legacyInsert('Before migration');
  await migrate(f.migration, f.roles);
  await legacyInsert('While replacing the old app');
  const entries = async () => (await (await f.request('peer', path + '?week=' + week)).json()).entries;
  const before = await entries();
  assert.equal(before.length, 2);
  assert.ok(before.every((entry: {revision: number}) => entry.revision === 1));
  const saved = await f.request('member', path + '/entries/' + oldId, 'PUT', {
    ...input, productId: product.id, revision: 1, title: 'Edited after migration',
  });
  assert.equal(saved.status, 200);
  const edited = (await entries()).find((entry: {id: string}) => entry.id === oldId);
  assert.equal(edited.title, 'Edited after migration');
  assert.equal(edited.revision, 2);
});
