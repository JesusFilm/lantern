import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { approveEmail, revokeEmail } from './admission.js';
import { createApp } from './app.js';
import { grantApplicationPrivileges } from './database-privileges.js';
import { resolveFeatureConfig } from './features.js';
import type { IdentityProvider } from './identity.js';
import { privilegeFixture } from './privilege-test-support.js';
import { migrate } from './schema.js';
import type { SessionView } from '../shared/access.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

test('the session lists only the features the signed-in account may see', { timeout: 60000 }, async () => {
  const fixture = await privilegeFixture();
  const { runtime: db, admin, migration, roles } = fixture;
  const server = createServer();
  try {
    await migrate(migration);
    await grantApplicationPrivileges(migration, roles);
    for (const name of ['owner', 'member']) await approveEmail(admin, name + '@example.test');
    let nextIdentity = 'owner';
    const provider: IdentityProvider = {
      authorizationUrl: (state) => '/auth/jesusfilm/callback?' + new URLSearchParams({ state, code: nextIdentity }),
      exchange: async (code) => ({ sub: code, name: 'Test ' + code, email: code + '@example.test' }),
    };
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const origin = 'http://127.0.0.1:' + address.port;
    const features = resolveFeatureConfig({
      LANTERN_FEATURES: 'focus-notes=preview,team-calendar=on',
      LANTERN_PREVIEW_EMAILS: 'Owner@example.test',
    }, 'production', ['focus-notes', 'team-calendar', 'unreleased']);
    server.on('request', createApp(db, { origin, provider, features }));
    const request = (path: string, cookie = '') => fetch(origin + path, { redirect: 'manual', headers: { Cookie: cookie, Origin: origin } });
    async function signIn(who: string) {
      nextIdentity = who;
      const start = await request('/auth/jesusfilm');
      const result = await request(start.headers.get('location')!, start.headers.get('set-cookie')!.split(';')[0]!);
      const cookie = result.headers.get('set-cookie')?.match(/(?:^|, )lantern-session=[^;]+/)?.[0].replace(/^, /, '');
      assert.ok(cookie, who + ' signs in');
      return cookie;
    }
    const seen = async (cookie = '') => (await (await request('/api/session', cookie)).json() as SessionView).features;

    const owner = await signIn('owner'), member = await signIn('member');
    assert.deepEqual(await seen(owner), ['focus-notes', 'team-calendar']);
    assert.deepEqual(await seen(member), ['team-calendar']);
    assert.deepEqual(await seen(), ['team-calendar']);

    // Preview follows the server-resolved account: it ends with the account's admission.
    await revokeEmail(admin, 'owner@example.test');
    assert.deepEqual(await seen(owner), ['team-calendar']);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fixture.close();
  }
});

test('an application without feature settings shows no flagged features', { timeout: 60000 }, async () => {
  const fixture = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(fixture.migration);
    await grantApplicationPrivileges(fixture.migration, fixture.roles);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const origin = 'http://127.0.0.1:' + address.port;
    server.on('request', createApp(fixture.runtime, { origin }));
    const session = await (await fetch(origin + '/api/session')).json() as SessionView;
    assert.deepEqual(session.features, []);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fixture.close();
  }
});
