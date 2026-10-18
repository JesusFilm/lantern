import { approveEmail, revokeEmail } from './admission.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { privilegeFixture } from './privilege-test-support.js';
import { grantApplicationPrivileges } from './database-privileges.js';
import { chromium } from '@playwright/test';
import { createServer as createViteServer } from 'vite';
import { createApp } from './app.js';
import { migrate } from './schema.js';
import { configureDomains, setupDepartment, removeMember } from './membership.js';
import type { RegisteredUser, SessionView } from '../shared/access.js';
import type { IdentityProvider } from './google.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');

test('Google boundary, persistent access, assignment restrictions and browser journey', { timeout: 90000 }, async (t) => {
  const fixture = await privilegeFixture();
  const { runtime: db, admin, migration, roles } = fixture;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  const server = createServer();
  try {
    await migrate(migration);
    await grantApplicationPrivileges(migration, roles);
    await configureDomains(admin, ['example.test']);
    for (const name of ['lead', 'member', 'other', 'outsider']) await approveEmail(admin, `${name}@example.test`);
    let nextIdentity = 'lead';
    const provider: IdentityProvider = {
      authorizationUrl: (state, nonce, challenge) => {
        assert.ok(nonce); assert.ok(challenge);
        return `/auth/google/callback?${new URLSearchParams({ state, code: nextIdentity })}`;
      },
      exchange: async (code, verifier, nonce) => {
        assert.ok(verifier); assert.ok(nonce);
        if (code === 'invalid') throw new Error('Invalid token');
        if (code === 'browser-member') return { sub: code, name: 'Test browser-member', email: 'browser-member@gmail.com', hostedDomain: null };
        return { sub: code, name: `Test ${code}`, email: `${code}@example.test`, hostedDomain: code === 'outsider' ? 'other.test' : 'example.test' };
      },
    };
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    const app = createApp(db, { origin, provider, admissionPolicy: 'stage' });
    vite = await createViteServer({ server: { middlewareMode: {server}, hmr: {server} }, appType: 'spa' });
    app.use(vite.middlewares);
    server.on('request', app);
    const request = (path: string, cookie = '', body?: unknown, requestOrigin = origin) => fetch(origin + path, {
      redirect: 'manual', headers: { Cookie: cookie, Origin: requestOrigin, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
    });
    async function login(who: string) {
      nextIdentity = who;
      const start = await request('/auth/google');
      assert.equal(start.status, 302);
      const loginCookie = start.headers.get('set-cookie')!.split(';')[0]!;
      const callback = start.headers.get('location')!;
      const result = await request(callback, loginCookie);
      return { response: result, cookie: result.headers.get('set-cookie')?.match(/(?:^|, )lantern-session=[^;]+/)?.[0].replace(/^, /, '') ?? '', callback, loginCookie };
    }
    await t.test('state is bound to browser, single-use, and invalid identities/domains cannot register', async () => {
      const start = await request('/auth/google');
      const callback = start.headers.get('location')!;
      assert.equal((await request(callback)).headers.get('location'), '/?signInError=1');
      const valid = await login('lead');
      assert.ok(valid.cookie);
      assert.match(valid.response.headers.get('set-cookie')!, /HttpOnly/);
      assert.match(valid.response.headers.get('set-cookie')!, /SameSite=Lax/);
      assert.equal((await request(valid.callback, valid.loginCookie)).headers.get('location'), '/?signInError=1');
      for (const who of ['invalid', 'outsider']) {
        assert.equal((await login(who)).response.headers.get('location'), '/?signInError=1');
      }
      const rows = await admin.query('SELECT google_sub FROM users');
      assert.deepEqual(rows.rows.map((row) => row.google_sub), ['lead']);
    });
    const lead = await login('lead');
    const member = await login('member');
    const memberView = await (await request('/api/session', member.cookie)).json() as SessionView;
    const memberId: string = memberView.user!.id;
    await t.test('registration alone gives no department access or member-management authority', async () => {
      for (const path of ['/api/department', '/api/department/registered-users', '/api/guide']) {
        assert.equal((await request(path)).status, 401);
        assert.equal((await request(path, member.cookie)).status, 403);
      }
      assert.equal((await request('/api/department/members', '', { userId: memberId })).status, 401);
      assert.equal((await request('/api/department/members', member.cookie, { userId: memberId })).status, 403);
    });
    await setupDepartment(admin, 'Engineering test', 'lead@example.test');
    await setupDepartment(admin, 'Engineering test', 'lead@example.test');
    await t.test('backend safeguards and server authority reject privilege changes and forged writes', async () => {
      await assert.rejects(setupDepartment(admin, 'Engineering test', 'member@example.test'));
      await assert.rejects(configureDomains(admin, ['other.test']));
      const leadId = (await (await request('/api/session', lead.cookie)).json() as SessionView).user!.id;
      await assert.rejects(removeMember(admin, leadId));
      assert.equal((await request('/api/department/members', lead.cookie, { userId: memberId, role: 'career-lead' })).status, 400);
      assert.equal((await request('/api/department/members', lead.cookie, { userId: memberId, departmentId: randomUUID() })).status, 400);
      assert.equal((await request('/api/department/members', lead.cookie, { userId: 'unknown' })).status, 400);
      assert.equal((await request('/api/department/members', lead.cookie, { userId: memberId }, 'https://evil.test')).status, 403);
    });
    await t.test('assignment persists across a new session, cannot duplicate, and does not confer lead powers', async () => {
      const results = await Promise.all([request('/api/department/members', lead.cookie, { userId: memberId }), request('/api/department/members', lead.cookie, { userId: memberId })]);
      assert.deepEqual(results.map((r) => r.status), [204, 204]);
      assert.equal((await request('/api/department', member.cookie)).status, 403);
      assert.equal((await request('/api/guide', member.cookie)).status, 200);
      assert.equal((await request('/api/department', (await login('member')).cookie)).status, 403);
      assert.equal((await request('/api/department/members', member.cookie, { userId: memberId })).status, 403);
      const department = await (await request('/api/department', lead.cookie)).json() as { members: { id: string }[] };
      assert.equal(department.members.filter((u: { id: string }) => u.id === memberId).length, 1);
    });
    await t.test('backend removal retains membership history and immediately blocks existing sessions and rejoining', async () => {
      await removeMember(admin, memberId);
      await removeMember(admin, memberId);
      assert.equal((await request('/api/department', member.cookie)).status, 403);
      assert.equal((await request('/api/guide', member.cookie)).status, 403);
      const session = await (await request('/api/session', member.cookie)).json() as SessionView;
      assert.ok(session.user); assert.equal(session.department, undefined);
      assert.equal((await request('/api/department/members', lead.cookie, { userId: memberId })).status, 409);
      const users = await (await request('/api/department/registered-users', lead.cookie)).json() as RegisteredUser[];
      assert.equal(users.find((u) => u.id === memberId)!.status, 'former');
    });
    // Synthetic unavailable membership; this is not a supported multi-department setup path.
    const other = await login('other');
    const otherId = (await (await request('/api/session', other.cookie)).json() as SessionView).user!.id;
    const otherDept = randomUUID();
    await admin.query('INSERT INTO departments(id,name) VALUES($1,$2)', [otherDept, 'Other test department']);
    await admin.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [otherId, otherDept]);
    assert.equal((await request('/api/department/members', lead.cookie, { userId: otherId })).status, 409);

    await t.test('browser registration, waiting, selection, membership indicators, access, removal and sign-out', async () => {
      browser = await chromium.launch({ headless: true });
      const memberContext = await browser.newContext();
      const leadContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      const leadPage = await leadContext.newPage();
      const { expect } = await import('@playwright/test');
      nextIdentity = 'browser-member';
      await memberPage.goto(origin);
      await memberPage.getByRole('link', { name: 'Sign in with Google' }).click();
      await expect(memberPage).toHaveURL(origin + '/?signInError=1');
      await expect(memberPage.getByRole('alert')).toHaveText('Sign-in could not be completed. Try again or contact your career lead.');
      await expect(memberPage.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
      await approveEmail(admin, 'browser-member@gmail.com');
      await memberPage.getByRole('link', { name: 'Sign in with Google' }).click();
      await expect(memberPage.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();
      await expect(memberPage.getByText('Contact your career lead directly', { exact: false })).toBeVisible();
      nextIdentity = 'lead';
      await leadPage.goto(origin);
      await leadPage.getByRole('link', { name: 'Sign in with Google' }).click();
      await leadPage.getByRole('button', { name: 'Department users', exact: true }).click();
      await expect(leadPage.getByRole('heading', { name: 'Department users' })).toBeVisible();
      await leadPage.getByRole('button', { name: 'Add user', exact: true }).click();
      await expect(leadPage.getByText('Rejoining is not yet supported.', { exact: true })).toBeVisible();
      await expect(leadPage.locator('option', { hasText: 'other@example.test' })).toBeDisabled();
      await expect(leadPage.locator('option', { hasText: 'member@example.test · Former member' })).toBeDisabled();
      await expect(leadPage.locator('option', { hasText: 'lead@example.test' })).toBeDisabled();
      await leadPage.getByLabel('Search by name or email address').fill('browser-member');
      const browserId = (await admin.query("SELECT id FROM users WHERE google_sub='browser-member'")).rows[0].id;
      await leadPage.getByLabel('Registered user', { exact: true }).selectOption(browserId);
      await leadPage.getByRole('button', { name: 'Add selected user' }).click();
      await expect(leadPage.getByRole('status')).toHaveText('User added to the department.');
      await memberPage.getByRole('button', { name: 'Check access' }).click();
      await expect(memberPage.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
      await memberPage.getByRole('button', { name: 'Guide', exact: true }).click();
      await memberPage.getByRole('button', { name: 'Example', exact: true }).click();
      await expect(memberPage.getByRole('heading', { name: 'A simple position focus' })).toBeVisible();
      await expect(memberPage.getByRole('button', { name: 'Department users', exact: true })).toHaveCount(0);
      await expect(memberPage.getByRole('button', { name: 'Add user' })).toHaveCount(0);
      await memberPage.reload();
      await expect(memberPage.getByRole('button', { name: 'Department users', exact: true })).toHaveCount(0);
      await revokeEmail(admin, 'browser-member@gmail.com');
      assert.equal((await memberContext.request.get(origin + '/api/department')).status(), 401);
      await memberPage.evaluate("window.dispatchEvent(new Event('focus'))");
      await expect(memberPage.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
      await approveEmail(admin, 'browser-member@gmail.com');
      nextIdentity = 'browser-member';
      await memberPage.getByRole('link', { name: 'Sign in with Google' }).click();
      await expect(memberPage.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
      await removeMember(admin, browserId);
      assert.equal((await memberContext.request.get(origin + '/api/department')).status(), 403);
      await memberPage.reload();
      await expect(memberPage.getByRole('heading', { name: 'Your account is ready' })).toBeVisible();
      await memberPage.getByRole('button', { name: 'Sign out' }).click();
      await expect(memberPage.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
      await leadPage.setViewportSize({ width: 390, height: 844 });
      await leadPage.getByRole('button', { name: 'Add user', exact: true }).click();
      await expect(leadPage.getByRole('button', { name: 'Add selected user' })).toBeVisible();
      await leadPage.screenshot({ path: 'captures/access-members-mobile.png', fullPage: true });
      assert.ok(await leadPage.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      await leadPage.setViewportSize({ width: 1280, height: 900 });
      await leadPage.screenshot({ path: 'captures/access-members.png', fullPage: true });
    });
    await t.test('an edited display name survives a later Google login', async () => {
      const result = await fetch(origin + '/api/account', {method:'PATCH',headers:{Cookie:lead.cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Chosen name'})});
      assert.equal(result.status,200);
      const again = await login('lead');
      const profile = await (await request('/api/session',again.cookie)).json() as SessionView;
      assert.equal(profile.user!.name,'Chosen name');
    });
    await t.test('sign-out and session expiry invalidate server access', async () => {
      assert.equal((await request('/api/sign-out', lead.cookie, {})).status, 204);
      assert.equal((await request('/api/department', lead.cookie)).status, 401);
      await admin.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
      assert.equal((await request('/api/department', other.cookie)).status, 401);
    });
  } finally {
    await browser?.close();
    await vite?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fixture.close();
  }
});
