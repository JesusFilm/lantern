import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';
import type { GitHubConnection } from './github.js';

function githubSource(): GitHubConnection {
  return {
    status: async () => ({ available: true, connected: true, account: 'Example team' }),
    connect: async () => ({ url: 'https://github.com/apps/example/installations/new' }),
    setup: async () => { throw new Error('Not used'); },
    register: async () => { throw new Error('Not used'); },
    install: async () => { throw new Error('Not used'); },
    repositories: async () => [], search: async () => ({ items: [] }),
  };
}

test('GitHub connection management belongs in career-lead department settings, never the goal picker', async () => {
  const f = await coachingFixture(undefined, undefined, { github: githubSource() });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    for (const actor of ['member', 'lead']) {
      const context = await browser.newContext();
      await context.addCookies([{ name: 'lantern-session', value: actor, url: f.origin }]);
      const page = await context.newPage(); page.setDefaultTimeout(5000);
      await page.goto(f.origin + '/?page=week&week=2026-11-16');await page.getByRole('tab',{name:'Goals',exact:true}).click();
      await page.getByRole('button', { name: 'Actions for goal 1', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add link', exact: true }).click();
      await page.getByRole('button', { name: 'Repositories', exact: true }).click();
      await expect(page.getByRole('searchbox', { name: 'Search GitHub', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Manage connection', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.goto(f.origin + '/?page=department&departmentTab=settings');
      if (actor === 'lead') {
        await expect(page.getByRole('heading', { name: 'GitHub connection', exact: true })).toBeVisible();
        await expect(page.getByText('Connected to Example team.', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Manage connection', exact: true })).toBeVisible();
        for (const { width, height } of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
          await page.setViewportSize({ width, height });
          await expect(page.getByRole('button', { name: 'Manage connection', exact: true })).toBeInViewport();
          assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false, `Settings fit at ${width}px`);
        }
        await page.screenshot({ path: '/tmp/lantern-department-settings.png' });
        await page.reload();
        await expect(page.getByRole('button', { name: 'Manage connection', exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Manage connection', exact: true })).toHaveCount(0);
        const denied = await context.request.get(f.origin + '/auth/github/connect', { maxRedirects: 0 });
        assert.equal(denied.status(), 403);
      }
      await context.close();
    }
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('department GitHub settings recover status failures and report blocked connection popups', async () => {
  const source = githubSource();
  let unavailable = true;
  source.status = async () => {
    if (unavailable) throw new Error('Connection status unavailable');
    return { available: true, connected: false };
  };
  const f = await coachingFixture(undefined, undefined, { github: source });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'lead', url: f.origin }]);
    await context.addInitScript('window.open = () => null;');
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=department&departmentTab=settings');
    await expect(page.getByRole('alert')).toBeVisible();
    unavailable = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('GitHub is not connected.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Allow a pop-up window');
    await page.goto(f.origin + '/?page=week&week=2026-11-16');await page.getByRole('tab',{name:'Goals',exact:true}).click();
    await page.getByRole('button', { name: 'Actions for goal 1', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add link', exact: true }).click();
    await page.getByRole('button', { name: 'Repositories', exact: true }).click();
    await expect(page.getByText(/Ask your career lead to connect GitHub/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect GitHub', exact: true })).toHaveCount(0);
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('production defaults expose GitHub settings without a weekly flag', async () => {
  const f = await coachingFixture(undefined, resolveFeatureConfig({}, 'production'), { github: githubSource() });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'lead', url: f.origin }]);
    const page = await context.newPage();
    await page.goto(f.origin + '/?page=department&departmentTab=settings');
    await expect(page.getByRole('heading', { name: 'Department', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub connection', exact: true })).toBeVisible();
    assert.equal((await context.request.get(f.origin + '/auth/github/connect', { maxRedirects: 0 })).status(), 302);
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('career leads finish GitHub setup in a popup and settings refresh the saved connection', async () => {
  const source = githubSource();
  let connected = false, origin = '';
  source.status = async () => ({ available: true, connected, account: connected ? 'Example team' : undefined, revision: connected ? 2 : undefined });
  source.connect = async (_department, state) => ({ url: origin + '/auth/github/app/setup?' + new URLSearchParams({ state, installation_id: '42' }) });
  source.install = async (_department, installation) => { assert.equal(installation, 42); connected = true; };
  const f = await coachingFixture(undefined, undefined, { github: source }); origin = f.origin;
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'lead', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=department&departmentTab=settings');
    await page.getByRole('button', { name: 'Connect GitHub', exact: true }).click();
    await expect(page.getByText('Connected to Example team.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Manage connection', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Connected to Example team.', { exact: true })).toBeVisible();
  } finally { await browser.close(); await vite.close(); await f.close(); }
});
