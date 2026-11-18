import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer as createViteServer } from 'vite';
import { createApp } from './app.js';
import { coachingFixture, draft } from './coach-test-support.js';
import { planAuthRecovery, applyAuthRecovery } from './auth-recovery.js';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`recovered JFP sign-in, preserved workspace, sign-out and retry at ${viewport.width}px`, { timeout: 60000 }, async () => {
    const f = await coachingFixture();
    const server = createServer();
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
    try {
      const created = await f.request('lead', '/api/focuses', 'POST', { ...draft, title: 'Retained original focus' });
      assert.equal(created.status, 201);
      const focus = await created.json();
      const duplicate = randomUUID();
      await f.admin.query("INSERT INTO users VALUES($1,'jesusfilm:browser-recovery','lead@example.test','Duplicate')", [duplicate]);
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const address = server.address(); assert.ok(address && typeof address !== 'string');
      const origin = `http://127.0.0.1:${address.port}`;
      let fail = false;
      const app = createApp(f.runtime, { origin, provider: {
        authorizationUrl: state => `/fixture-provider?state=${state}`,
        exchange: async () => {
          if (fail) throw new Error('Synthetic provider failure');
          return { sub: 'jesusfilm:browser-recovery', email: 'lead@example.test', name: 'From JFP' };
        },
      } });
      app.get('/fixture-provider', (req, res) => {
        const state = String(req.query.state);
        res.type('html').send(`<h1>Fixture JFP sign-in</h1><a href="/auth/jesusfilm/callback?${new URLSearchParams({ state, code: 'test' })}">Continue</a><a href="/auth/jesusfilm/callback?${new URLSearchParams({ state, error: 'access_denied' })}">Cancel</a>`);
      });
      vite = await createViteServer({ server: { middlewareMode: { server }, hmr: { server } }, appType: 'spa' });
      app.use(vite.middlewares); server.on('request', app);
      browser = await chromium.launch();
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.name));
      const signIn = async () => {
        await expect(page.getByRole('heading', { name: 'Fixture JFP sign-in' })).toBeVisible();
        await page.getByRole('link', { name: 'Continue', exact: true }).click();
      };
      const retry = async () => {
        await expect(page.getByRole('alert')).toContainText('Sign-in could not be completed');
        await expect(page).toHaveURL(origin + '/?signInError=1');
        await expect(page.getByRole('heading', { name: 'Welcome to Lantern' })).toBeVisible();
        await expect(page.locator('nav').getByRole('button', { name: 'Account', exact: true, includeHidden: true })).toHaveCount(0);
        await expect(page.locator('nav [aria-current="page"]')).toHaveCount(0);
        for (const path of ['/api/focuses', '/api/department', '/api/guide', '/api/department/registered-users']) {
          assert.equal((await context.request.get(origin + path)).status(), 401, `${path} remains protected when signed out`);
        }
        await page.getByRole('link', { name: 'Sign in with Jesus Film' }).click();
        await signIn();
      };
      await page.goto(origin + '/auth/jesusfilm/callback?error=access_denied&state=qa-test');
      await retry();
      await expect(page.getByRole('alert')).toContainText('Sign-in could not be completed');
      assert.equal((await f.admin.query("SELECT id FROM users WHERE email='lead@example.test'")).rowCount, 2);

      // Existing lead session can see the conflict but cannot add either account.
      const operator = await browser.newContext({ viewport });
      await operator.addCookies([{ name: 'lantern-session', value: 'lead', url: origin }]);
      const adminPage = await operator.newPage();
      await adminPage.goto(origin + '/?page=department');
      await adminPage.getByRole('button', { name: 'Add user', exact: true }).click();
      await adminPage.getByLabel('Search by name or email address').fill('lead@example.test');
      const options = adminPage.locator('option', { hasText: 'lead@example.test' });
      await expect(options).toHaveCount(2);
      for (const option of await options.all()) await expect(option).toBeDisabled();
      await expect(adminPage.getByText('Account repair required. Contact your administrator.', { exact: true })).toHaveCount(2);
      assert.ok(await adminPage.evaluate("document.documentElement.scrollWidth <= innerWidth"));
      await operator.close();

      const plan = await planAuthRecovery(f.admin, { accountId: f.ids.lead, expectedSubject: f.ids.lead, authSubject: 'browser-recovery', email: 'lead@example.test', duplicateAccountId: duplicate });
      await applyAuthRecovery(f.admin, plan);
      await retry();
      await expect(page.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Retained original focus', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Retained original focus', exact: true })).toBeVisible();
      const session = await (await context.request.get(origin + '/api/session')).json();
      assert.equal(session.user.id, f.ids.lead); assert.equal(session.department.role, 'career-lead');
      assert.equal(session.department.name, 'Engineering');
      assert.equal((await context.request.get(`${origin}/api/focuses/${focus.id}`)).status(), 200);
      const users = await (await context.request.get(origin + '/api/department/registered-users')).json();
      assert.equal(users.filter((user: { email: string }) => user.email === 'lead@example.test').length, 1);
      assert.equal(users.find((user: { id: string }) => user.id === f.ids.lead).status, 'member');
      assert.equal((await context.request.get(`${origin}/api/department/members/${f.ids.outsider}/focuses`)).status(), 404);
      const oldSession = (await context.cookies()).find(cookie => cookie.name === 'lantern-session')!;
      const signOut = async () => {
        await page.getByRole('button', { name: 'Account', exact: true }).click();
        await page.getByRole('button', { name: 'Sign out', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Fixture JFP sign-in' })).toBeVisible();
      };
      await signOut();
      assert.equal((await fetch(origin + '/api/focuses', { headers: { Cookie: `lantern-session=${oldSession.value}` } })).status, 401);
      await signIn();
      await expect(page.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
      await signOut();
      await page.getByRole('link', { name: 'Cancel', exact: true }).click();
      await retry();
      await expect(page.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
      await signOut(); fail = true; await signIn(); fail = false; await retry();
      await expect(page.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
      assert.equal((await (await context.request.get(origin + '/api/session')).json()).user.id, f.ids.lead);
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close(); await vite?.close(); server.closeAllConnections();
      if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
      await f.close();
    }
  });
}
