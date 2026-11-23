import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';

test('editable draggable goals share one page with a saved entry for today', async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
    await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'My week sections' })).toHaveCount(0);
    await expect(page.getByRole('radio').and(page.locator(':checked'))).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Ship the sign-in flow');
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.getByRole('textbox', { name: 'Weekly goal 2', exact: true }).fill('Investigate upload delays');
    await page.getByRole('button', { name: 'Actions for goal 1', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit details', exact: true }).click();
    await page.getByRole('textbox', { name: 'Markdown description for goal 1', exact: true }).fill('Supporting information for agents');
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continue to daily update', exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).plans.at(-1)?.goals.length).toBe(2);
    await expect(page.getByRole('radio').and(page.locator(':checked'))).toHaveCount(0);
    assert.deepEqual((await (await f.request('member', '/api/weeks/2026-11-16')).json()).updates, []);
    const goals = page.getByRole('region', { name: 'Weekly goals', exact: true });
    const update = page.getByRole('region', { name: 'Daily update', exact: true });
    await expect(goals).toBeVisible(); await expect(update).toBeVisible();
    const left = await goals.boundingBox(), right = await update.boundingBox();
    assert.ok(left && right && left.y + left.height <= right.y, 'The daily update sits below the goals');
    await expect(page.getByText('This week’s story', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Update date', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nothing has changed', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your goals', exact: true })).toHaveCount(0);
    await expect(page.getByText('How is each goal going today?', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit goals', exact: true })).toHaveCount(0);
    await expect(page.locator('.week-header').getByRole('button', { name: 'Add goal', exact: true })).toBeVisible();
    await expect(goals.getByText('Description', { exact: true })).toHaveCount(0);
    await expect(goals.getByText('Supporting information for agents', { exact: true })).toHaveCount(0);
    const card = goals.locator('.week-goal-block').first();
    const footer = card.getByRole('group');
    const cardBox = await card.boundingBox(), footerBox = await footer.boundingBox();
    assert.ok(cardBox && footerBox && Math.abs(footerBox.width - cardBox.width) <= 2, 'Status footer spans the card');
    const segments = await footer.locator('label').all();
    for (let i = 1; i < segments.length; i++) {
      const previous = await segments[i - 1]!.boundingBox(), current = await segments[i]!.boundingBox();
      assert.ok(previous && current && Math.abs(previous.x + previous.width - current.x) < 1, 'Status buttons join without gaps');
    }
    const sidebar = await page.locator('.sidebar').boundingBox();
    assert.ok(sidebar && left.x >= sidebar.x + sidebar.width, 'Goals must clear the desktop sidebar');
    const first = page.getByRole('group', { name: 'Status for Ship the sign-in flow', exact: true });
    const second = page.getByRole('group', { name: 'Status for Investigate upload delays', exact: true });
    await expect(page.getByRole('heading', { name: 'Daily update', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: "Save today's update", exact: true })).toHaveCount(0);
    const text = page.getByRole('textbox', { name: 'Daily update', exact: true });
    await page.route('**/api/weeks/*/updates', route => route.fulfill({ status: 503, json: { error: 'Try again shortly.' } }));
    await text.fill('Sign-in is moving forward; uploads need attention.');
    await first.getByRole('radio', { name: 'On track', exact: true }).check();
    await second.getByRole('radio', { name: 'At risk', exact: true }).check();
    await expect(page.getByRole('alert')).toContainText('Try again shortly.');
    await expect(text).toHaveValue('Sign-in is moving forward; uploads need attention.');
    await page.unroute('**/api/weeks/*/updates');
    await page.getByRole('button', { name: 'Retry saving update', exact: true }).click();
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).updates.at(-1)?.body).toBe('Sign-in is moving forward; uploads need attention.');
    await expect(text).toBeEditable();
    await expect(page.locator('details.week-day-entry')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit update', exact: true })).toHaveCount(0);
    await text.fill('Sign-in is ready; investigating uploads next.');
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).updates.at(-1)?.body).toBe('Sign-in is ready; investigating uploads next.');
    await page.reload();
    await expect(text).toHaveValue('Sign-in is ready; investigating uploads next.');
    await expect(text).toBeEditable();
    const record = await (await f.request('member', '/api/weeks/2026-11-16')).json();
    assert.equal(record.updates.length, 1); assert.equal(record.updates[0].date, '2026-11-19');
    assert.deepEqual(record.updates[0].goalStatuses.map((item: { status: string }) => item.status), ['on-track', 'at-risk']);
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Ship the sign-in flow');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('region', { name: 'Weekly goals', exact: true })).toBeVisible();
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    }
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('inline goals keep their daily statuses when newly added, renamed and dragged', async () => {
  const f = await coachingFixture();
  const path = '/api/weeks/2026-11-16';
  await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'First', links: [] }, { text: 'Second', links: [] }] });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
    await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await page.getByRole('group', { name: 'Status for First', exact: true }).getByRole('radio', { name: 'Blocked', exact: true }).check();
    await page.getByRole('textbox', { name: 'Daily update', exact: true }).fill('Working on these together.');
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.getByRole('group', { name: 'Status for goal 3', exact: true }).getByRole('radio', { name: 'At risk', exact: true }).check();
    await page.getByRole('textbox', { name: 'Weekly goal 3', exact: true }).fill('Third');
    await expect.poll(async () => {
      const record = await (await f.request('member', path)).json();
      const third = record.plans.at(-1)?.goals.find((goal: { text: string }) => goal.text === 'Third');
      return record.updates.at(-1)?.goalStatuses.find((flag: { goalId: string }) => flag.goalId === third?.id)?.status;
    }).toBe('at-risk');
    const source = await page.getByRole('button', { name: 'Reorder goal 1', exact: true }).boundingBox();
    const target = await page.locator('.week-goal-row').nth(2).boundingBox();
    assert.ok(source && target);
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2, target.y + target.height - 5, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 3', exact: true })).toHaveValue('First');
    await page.getByRole('textbox', { name: 'Weekly goal 2', exact: true }).fill('Third renamed');
    await expect.poll(async () => (await (await f.request('member', path)).json()).plans.at(-1)?.goals.map((goal: { text: string }) => goal.text)).toEqual(['Second', 'Third renamed', 'First']);
    await expect.poll(async () => (await (await f.request('member', path)).json()).updates.at(-1)?.goalStatuses.map((flag: { status: string }) => flag.status)).toEqual(['at-risk', 'blocked']);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveValue('Third renamed');
    await expect(page.getByRole('group', { name: 'Status for Third renamed', exact: true }).getByRole('radio', { name: 'At risk', exact: true })).toBeChecked();
    await expect(page.getByRole('group', { name: 'Status for First', exact: true }).getByRole('radio', { name: 'Blocked', exact: true })).toBeChecked();
  } finally { await browser.close(); await vite.close(); await f.close(); }
});
