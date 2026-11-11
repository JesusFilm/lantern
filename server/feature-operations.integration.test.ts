import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { approveEmail } from './admission.js';
import { createApp } from './app.js';
import type { AccessConfig } from './access.js';
import { grantApplicationPrivileges } from './database-privileges.js';
import { resolveFeatureConfig } from './features.js';
import type { IdentityProvider } from './google.js';
import { privilegeFixture } from './privilege-test-support.js';
import { migrate } from './schema.js';

// The page reports configuration to the configured owner through their own
// authenticated browser; it never returns the preview account list.
test('only the signed-in owner with active membership can see flag states', { timeout: 60000 }, async () => {
  const f = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(f.migration);
    await grantApplicationPrivileges(f.migration, f.roles);
    for (const name of ['owner', 'member']) await approveEmail(f.admin, name + '@example.test');
    let next = 'owner';
    const provider: IdentityProvider = {
      authorizationUrl: state => '/auth/google/callback?' + new URLSearchParams({ state, code: next }),
      exchange: async code => ({ sub: code, name: code, email: code + '@example.test' }),
    };
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const origin = 'http://127.0.0.1:' + address.port;
    const features = resolveFeatureConfig({ LANTERN_FEATURES: 'focus-notes=preview,team-calendar=on',
      LANTERN_PREVIEW_EMAILS: 'private@example.test' }, 'production', ['focus-notes', 'team-calendar', 'unreleased']);
    const config: AccessConfig & { flagOwnerEmail: string } = { origin, provider, features, flagOwnerEmail: 'owner@example.test' };
    server.on('request', createApp(f.runtime, config));
    const request = (path: string, cookie = '') => fetch(origin + path, { redirect: 'manual', headers: { Cookie: cookie, Origin: origin } });
    async function signIn(who: string) {
      next = who;
      const start = await request('/auth/google');
      const result = await request(start.headers.get('location')!, start.headers.get('set-cookie')!.split(';')[0]!);
      const cookie = result.headers.get('set-cookie')?.match(/(?:^|, )lantern-session=[^;]+/)?.[0].replace(/^, /, '');
      assert.ok(cookie); return cookie;
    }
    const owner = await signIn('owner'), member = await signIn('member');
    const team = randomUUID();
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Synthetic team')", [team]);
    await f.admin.query("INSERT INTO memberships(user_id,department_id,role) SELECT id,$1,'member' FROM users WHERE email IN ('owner@example.test','member@example.test')", [team]);
    assert.equal((await request('/ops/feature-flags')).status, 401);
    assert.equal((await request('/ops/feature-flags', member)).status, 403);
    const response = await request('/ops/feature-flags', owner);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const page = await response.text();
    for (const value of ['focus-notes', 'preview', 'team-calendar', 'on', 'unreleased', 'off']) assert.ok(page.includes(value));
    assert.ok(!page.includes('private@example.test'));
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await context.addCookies([{ name: 'lantern-session', value: owner.split('=')[1]!, url: origin }]);
      const tab = await context.newPage();
      await tab.goto(origin + '/ops/feature-flags');
      assert.equal(await tab.getByRole('heading', { name: 'Feature flags' }).count(), 1);
      assert.equal(await tab.getByRole('row', { name: 'focus-notes preview' }).count(), 1);
    } finally { await browser.close(); }
    config.flagOwnerEmail = '';
    assert.equal((await request('/ops/feature-flags', owner)).status, 403, 'An unset owner must fail closed');
    config.flagOwnerEmail = 'owner@example.test';
    await f.admin.query("UPDATE memberships SET deleted_at=now() WHERE user_id=(SELECT id FROM users WHERE email='owner@example.test')");
    assert.equal((await request('/ops/feature-flags', owner)).status, 403);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await f.close();
  }
});
