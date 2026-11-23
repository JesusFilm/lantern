import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';

const goalDrafts = (...texts: string[]) => texts.map(text => ({ text, links: [] }));

test('a member plans a week and records daily updates with persistent history and save recovery', async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
    await context.clock.setFixedTime(new Date('2026-11-17T10:00:00+13:00'));
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(f.origin + '/?page=account&week=2026-11-09');
    await page.getByRole('link', { name: 'My week', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My week', exact: true })).toBeVisible();
    await expect(page.getByText('Mon, 16 Nov – Fri, 20 Nov', { exact: true })).toBeVisible();
    await expect(page.getByText('Other weeks', { exact: true })).toHaveCount(0);
    await expect(page.getByText('This week', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Only you can view these goals/)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Weekly goals', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Daily update', exact: true })).toBeVisible();
    await expect(page.getByLabel('Week starting')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save weekly goals', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Test sign-in with three people');
    await page.getByRole('button', { name: 'Add goal', exact: true }).click();
    await page.getByRole('textbox', { name: 'Weekly goal 2', exact: true }).fill('Investigate upload delays');
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Test sign-in with three people');
    await expect(page.getByRole('region', { name: 'Daily update', exact: true })).toBeVisible();
    await expect(page.getByLabel('Update date', { exact: true })).toHaveCount(0);
    await page.route('**/api/weeks/*/updates', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporarily unavailable. Try again.' }) }));
    await page.getByRole('textbox', { name: 'Daily update', exact: true }).fill('Two sessions done. Could use help with the upload trace.');
    for (const group of await page.locator('.week-goal-statuses').all()) await group.getByRole('radio', { name: 'On track', exact: true }).check();
    await expect(page.getByRole('alert')).toContainText('Temporarily unavailable');
    await expect(page.getByRole('textbox', { name: 'Daily update', exact: true })).toHaveValue('Two sessions done. Could use help with the upload trace.');
    await page.unroute('**/api/weeks/*/updates');
    await page.getByRole('button', { name: 'Retry saving update', exact: true }).click();
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).updates.at(-1)?.body).toBe('Two sessions done. Could use help with the upload trace.');
    await page.reload();
    const savedUpdate = await (await f.request('member', '/api/weeks/2026-11-16')).json();
    assert.equal(savedUpdate.updates[0].body, 'Two sessions done. Could use help with the upload trace.');
    assert.equal(savedUpdate.updates[0].date, '2026-11-17');
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Test sign-in with three people');
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Finish the third session');
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).plans.at(-1)?.goals[0].text).toBe('Finish the third session');
    const savedPlans = await (await f.request('member', '/api/weeks/2026-11-16')).json();
    assert.equal(savedPlans.plans[0].goals[0].text, 'Test sign-in with three people');
    assert.equal(savedPlans.plans.at(-1).goals[0].text, 'Finish the third session');
    await expect(page.locator('.week-history')).toHaveCount(0);
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).updates.at(-1).planVersion).toBe(savedPlans.plans.at(-1).version);
    await expect(page.getByText(/plan version|version \d/i)).toHaveCount(0);
    await expect(page.getByText(/plan version|version \d/i)).toHaveCount(0);
    await page.goto(f.origin + '/?page=week&week=2026-11-23');
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('');
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await expect(page.getByRole('textbox', { name: 'Daily update', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Finish the third session');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole('textbox', { name: 'Daily update', exact: true })).toBeVisible();
      assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false, 'No horizontal overflow at ' + width);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('weekly goals and daily updates can be edited together without replacing either draft', async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    await f.request('member', '/api/weeks/2026-11-16/plans', 'POST', { version: 0, goals: goalDrafts('Original weekly goal') });
    const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
    await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await page.getByRole('textbox', { name: 'Daily update', exact: true }).fill('My unfinished daily update');
    await expect(page.getByRole('textbox', { name: 'Daily update', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('My unfinished weekly goal');
    await expect(page.getByRole('textbox', { name: 'Daily update', exact: true })).toHaveValue('My unfinished daily update');
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('My unfinished weekly goal');
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('My week is available with production defaults and no feature flag', async () => {
  const f = await coachingFixture(undefined, resolveFeatureConfig({}, 'production'));
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage();
    await page.goto(f.origin + '/?page=week');
    await expect(page.getByRole('heading', { name: 'My week', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My week', exact: true })).toBeVisible();
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('leaving a weekly draft through browser history asks before discarding it', async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin);
    await page.getByRole('link', { name: 'My week', exact: true }).click();
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Keep this unsaved goal');
    let prompted = false;
    page.on('dialog', async dialog => { prompted = true; await dialog.dismiss(); });
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'My week', exact: true })).toBeVisible();
    assert.equal(prompted, true);
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Keep this unsaved goal');
    await expect(page).toHaveURL(/page=week/);
    page.removeAllListeners('dialog');
    page.once('dialog', dialog => dialog.accept());
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Position focuses', exact: true })).toBeVisible();
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test('a member links a weekly goal to their focus and an issue and retains the links through edits and reloads', async () => {
  const f = await coachingFixture();
  const focus = await (await f.request('member', '/api/focuses', 'POST', { title: 'My engineering focus', start: '2026-01-01', end: '2026-12-31', sections: [] })).json();
  await f.request('peer', '/api/focuses', 'POST', { title: 'Private peer focus', start: '2026-01-01', end: '2026-12-31', sections: [] });
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: 'spa' });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.route('**/api/focuses', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Focus choices unavailable.' }) }));
    await page.goto(f.origin + '/?page=week&week=2026-11-16');
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Ship the sign-in fix');
    await page.getByRole('button', { name: 'Actions for goal 1', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add link', exact: true }).click();
    await page.getByRole('button', { name: 'Position focus', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Focus choices unavailable.');
    await page.unroute('**/api/focuses');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Ship the sign-in fix');
    await expect(page.getByRole('button', { name: 'Private peer focus', exact: false })).toHaveCount(0);
    await page.getByRole('button', { name: /My engineering focus/ }).click();
    await page.getByRole('button', { name: 'Add link', exact: true }).click();
    await page.getByRole('button', { name: 'Actions for goal 1', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Add link', exact: true }).click();
    await page.getByRole('button', { name: 'URL', exact: true }).click();
    await page.getByRole('combobox', { name: /^Work type/ }).selectOption('issue');
    await page.getByRole('textbox', { name: 'Name (optional)', exact: true }).fill('Sign-in issue');
    await page.getByRole('textbox', { name: 'URL', exact: true }).fill('https://github.com/example/lantern/issues/42');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false, 'Expanded linked work fits ' + width);
    }
    await page.getByRole('button', { name: 'Add link', exact: true }).click();
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).plans.at(-1)?.goals[0].links.length).toBe(2);
    await expect(page.getByRole('button', { name: 'Edit work link 2 for goal 1', exact: true })).toContainText('Sign-in issue');
    await page.reload();
    await page.getByRole('button', { name: 'Edit work link 2 for goal 1', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue('https://github.com/example/lantern/issues/42');
    await page.getByRole('button', { name: 'Close link picker', exact: true }).click();
    await page.getByRole('button', { name: 'Remove work link 2 from goal 1', exact: true }).click();
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Ship and verify the fix');
    await page.route('**/api/weeks/*/plans', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Try again.' }) }));
    await expect(page.getByRole('alert')).toContainText('Try again');
    await expect(page.getByRole('button', { name: 'Edit work link 1 for goal 1', exact: true })).toContainText('My engineering focus');
    await page.unroute('**/api/weeks/*/plans');
    await page.getByRole('button', { name: 'Retry saving goals', exact: true }).click();
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-16')).json()).plans.at(-1)?.goals[0].text).toBe('Ship and verify the fix');
    await expect(page.getByRole('button', { name: 'Edit work link 2 for goal 1', exact: true })).toHaveCount(0);
    const saved = await (await f.request('member', '/api/weeks/2026-11-16')).json();
    assert.ok(saved.plans.some((plan: { goals: { links: { label?: string }[] }[] }) => plan.goals.some(goal => goal.links.some(link => link.label === 'Sign-in issue'))));
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    }
  } finally { await browser.close(); await vite.close(); await f.close(); }
});
