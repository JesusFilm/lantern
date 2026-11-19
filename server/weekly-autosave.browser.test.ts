import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import type { GitHubConnection } from './github.js';

const path = '/api/weeks/2026-11-16';

test('weekly goals autosave without replacing newer typing, retain failed edits and retry', async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  let release = () => {};
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await expect(page.getByRole('region', { name: 'Weekly goals', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save weekly goals', exact: true })).toHaveCount(0);
    let arrived = () => {};
    const waiting = new Promise<void>(resolve => { arrived = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/weeks/*/plans', async route => {
      const response = await route.fetch(); arrived(); await gate; await route.fulfill({ response });
    });
    const goal = page.getByRole('textbox', { name: 'Weekly goal 1', exact: true });
    await goal.fill('First wording');
    await waiting;
    await goal.fill('Newer wording while saving');
    release();
    await expect.poll(async () => (await (await f.request('member', path)).json()).plans.at(-1)?.goals[0].text).toBe('Newer wording while saving');
    await expect(goal).toBeFocused();
    await expect(goal).toHaveValue('Newer wording while saving');
    await expect(page.getByRole('region', { name: 'Weekly goals', exact: true })).toBeVisible();
    const saved = await (await f.request('member', path)).json();
    assert.equal(saved.plans[0].goals[0].id, saved.plans.at(-1).goals[0].id);
    await page.unroute('**/api/weeks/*/plans');
    await page.route('**/api/weeks/*/plans', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Try again shortly.' }) }));
    await goal.fill('Keep this unsaved change');
    await expect(page.getByRole('alert')).toContainText('Try again shortly.');
    await expect(goal).toHaveValue('Keep this unsaved change');
    await page.unroute('**/api/weeks/*/plans');
    await page.getByRole('button', { name: 'Retry saving goals', exact: true }).click();
    await expect.poll(async () => (await (await f.request('member', path)).json()).plans.at(-1)?.goals[0].text).toBe('Keep this unsaved change');
    await page.reload();
    await expect(goal).toHaveValue('Keep this unsaved change');
  } finally { release(); await browser.close(); await vite.close(); await f.close(); }
});

test('removing a weekly goal requires modal confirmation and autosaves the confirmed removal', async () => {
  const f = await coachingFixture();
  await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'Keep this', links: [] }, { text: 'Remove this', links: [] }] });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await page.getByRole('button', { name: 'Actions for goal 2', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete this goal?', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('You can’t undo this');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveValue('Remove this');
    await page.getByRole('button', { name: 'Actions for goal 2', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await dialog.getByRole('button', { name: 'Delete goal', exact: true }).click();
    await expect.poll(async () => (await (await f.request('member', path)).json()).plans.at(-1)?.goals.map((g: { text: string }) => g.text)).toEqual(['Keep this']);
    const saved = await (await f.request('member', path)).json();
    assert.equal(saved.plans[0].goals.length, 2, 'Historical plans stay intact');
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('Link has horizontal padding and its picker stays fullscreen across GitHub work types', async () => {
  const source: GitHubConnection = {
    status: async () => ({ connected: true, available: true, account: 'Example' }),
    connect: async () => { throw new Error('Not used'); }, setup: async () => { throw new Error('Not used'); },
    register: async () => { throw new Error('Not used'); }, install: async () => {},
    repositories: async () => [], search: async () => ({ items: [] }),
  };
  const f = await coachingFixture(undefined, undefined, { github: source });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await page.getByRole('button', { name: 'Actions for goal 1', exact: true }).click();
    const link = page.getByRole('menuitem', { name: 'Add link', exact: true });
    await expect(link).toHaveText('Add link');
    const padding = await page.evaluate<{ left: number; right: number }>('(() => { const style = getComputedStyle(document.querySelector(".week-goal-menu button")); return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) }; })()');
    assert.ok(padding.left >= 10 && padding.right >= 10);
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'Link work to this goal', exact: true });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const name of ['Repositories', 'Projects', 'Issues']) {
        await page.getByRole('button', { name, exact: true }).click();
        const bounds = await dialog.boundingBox();
        assert.deepEqual(bounds, width < 801 ? { x: 0, y: 0, width, height: 844 } : { x: (width - 1120) / 2, y: 32, width: 1120, height: 780 });
        await expect(page.getByRole('button', { name: 'Close link picker', exact: true })).toBeInViewport();
      }
    }
    await page.screenshot({ path: '/tmp/lantern-fullscreen-links.png' });
    await page.getByRole('button', { name: 'Close link picker', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  } finally { await browser.close(); await vite.close(); await f.close(); }
});
