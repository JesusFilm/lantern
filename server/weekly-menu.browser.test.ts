import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';

test('goal actions open from a dismissible menu and deletion still requires confirmation', async () => {
  const f = await coachingFixture();
  const path = '/api/weeks/2026-11-16';
  await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'First', links: [] }, { text: 'Second', links: [] }] });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    const actions = page.getByRole('button', { name: 'Actions for goal 1', exact: true });
    await expect(actions).toBeVisible();
    await expect(page.locator('.week-goal-footer')).toHaveCount(0);
    await actions.click();
    const menu = page.getByRole('menu', { name: 'Goal 1 actions', exact: true });
    await expect(menu).toBeVisible();
    assert.deepEqual(await menu.getByRole('menuitem').allTextContents(), ['Add link', 'Edit details', 'Delete']);
    await page.keyboard.press('Escape'); await expect(menu).not.toBeVisible();
    await actions.click(); await menu.getByRole('menuitem', { name: 'Add link', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Link work to this goal', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close link picker', exact: true }).click();
    await actions.click(); await menu.getByRole('menuitem', { name: 'Edit details', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit goal 1', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Markdown description for goal 1', exact: true }).fill('Supporting notes');
    await page.getByRole('button', { name: 'Close goal editor', exact: true }).click();
    await actions.click(); await menu.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Delete this goal?', exact: true });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('First');
    await actions.click(); await menu.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Delete goal', exact: true }).click();
    await expect.poll(async () => (await (await f.request('member', path)).json()).plans.at(-1)?.goals.map((goal: { text: string }) => goal.text)).toEqual(['Second']);
    await page.getByRole('button', { name: 'Actions for goal 1', exact: true }).click();
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).click();
    await expect(menu).not.toBeVisible();
  } finally { await browser.close(); await vite.close(); await f.close(); }
});
