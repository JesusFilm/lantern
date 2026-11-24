import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig, type FeatureConfig } from './features.js';

async function copyBrowserFixture(t: TestContext, features?: FeatureConfig) {
  const fixture = await coachingFixture(undefined, features);
  let vite: Awaited<ReturnType<typeof createServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  t.after(async () => {
    try { await browser?.close(); }
    finally {
      try { await vite?.close(); }
      finally { await fixture.close(); }
    }
  });
  vite = await createServer({ server: { middlewareMode: { server: fixture.server }, hmr: { server: fixture.server } }, appType: 'spa' });
  fixture.app.use(vite.middlewares);
  browser = await chromium.launch();
  return { ...fixture, browser };
}

test('copying last week appends fresh goals with details and links, without statuses or updates', async t => {
  const f = await copyBrowserFixture(t);
  const browser = f.browser;
  const sourcePath = '/api/weeks/2026-11-16', destinationPath = '/api/weeks/2026-11-23';
  const source = await (await f.request('member', sourcePath + '/plans', 'POST', { version: 0, goals: [
    { text: 'Run the release smoke test', description: 'Record results before release.', completed: true,
      links: [{ kind: 'issue', label: 'Release checks', url: 'https://example.test/checks' }] },
  ] })).json();
  await f.request('member', sourcePath + '/updates', 'POST', { date: '2026-11-19', body: 'Passed last week', planVersion: 1,
    goalStatuses: [{ goalId: source.plans[0].goals[0].id, status: 'done' }] });
  const history = await (await f.request('member', sourcePath)).json();
  const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
  await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
  await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  await page.goto(f.origin + '/?page=week&week=2026-11-23');
  const copy = page.getByRole('button', { name: 'Copy last week’s goals', exact: true });
  await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Prepare the demo');
  await expect.poll(async () => (await (await f.request('member', destinationPath)).json()).plans.length).toBe(1);
  await page.route('**/api/weeks/2026-11-16', route => route.fulfill({ status: 503, json: { error: 'Could not load last week.' } }));
  await copy.click(); await expect(page.getByRole('alert')).toContainText('Could not load last week.');
  await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Prepare the demo');
  await page.unroute('**/api/weeks/2026-11-16');
  await copy.click();
  await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveValue('Run the release smoke test');
  await expect.poll(async () => (await (await f.request('member', destinationPath)).json()).plans.at(-1)?.goals.length).toBe(2);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveValue('Run the release smoke test');
  const saved = await (await f.request('member', destinationPath)).json(), goal = saved.plans.at(-1).goals[1];
  assert.notEqual(goal.id, source.plans[0].goals[0].id);
  assert.equal(goal.description, 'Record results before release.');
  assert.equal(goal.completed, false);
  assert.deepEqual(goal.links, source.plans[0].goals[0].links);
  assert.deepEqual(saved.updates, []);
  for (const [width, height] of [[320, 844], [390, 844], [667, 375], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width: width!, height: height! });
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    await expect(copy).toBeInViewport();
    const dateRange = page.getByRole('button', { name: 'Go to this week', exact: true });
    assert.ok((await dateRange.boundingBox())!.width > 150, `The selected week stays readable at ${width}px beside copy controls`);
  }
  await expect(page.getByRole('radio').and(page.locator(':checked'))).toHaveCount(0);
  assert.deepEqual(await (await f.request('member', sourcePath)).json(), history);
  assert.deepEqual((await (await f.request('peer', destinationPath)).json()).plans, []);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('');
  await copy.click();
  await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Prepare the demo');
  await expect(page.getByRole('textbox', { name: 'Weekly goal 3', exact: true })).toHaveCount(0);
});

test('the copy control stays hidden when its flag is off while weekly editing remains available', async t => {
  const f = await copyBrowserFixture(t, resolveFeatureConfig({}, 'production'));
  const browser = f.browser;
  const context = await browser.newContext();
  await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
  const page = await context.newPage();
  await page.goto(f.origin + '/?page=week');
  await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy last week’s goals', exact: true })).toHaveCount(0);
});

test('copying handles an empty previous week and refuses excess goals without changing the draft', async t => {
  const f = await copyBrowserFixture(t);
  const browser = f.browser;
  await f.request('peer', '/api/weeks/2026-11-16/plans', 'POST', { version: 0, goals: [{ text: 'Private peer goal', links: [] }] });
  const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
  await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
  await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
  const page = await context.newPage();
  await page.goto(f.origin + '/?page=week&week=2026-11-23');
  const copy = page.getByRole('button', { name: 'Copy last week’s goals', exact: true });
  await copy.click(); await expect(page.getByRole('status')).toHaveText('No goals to copy from last week.');
  await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('');
  await f.request('member', '/api/weeks/2026-11-16/plans', 'POST', { version: 0,
    goals: Array.from({ length: 10 }, (_, index) => ({ text: `Recurring goal ${index + 1}`, links: [] })) });
  await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Keep this week’s goal');
  await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-23')).json()).plans.length).toBe(1);
  const saved = await (await f.request('member', '/api/weeks/2026-11-23')).json();
  await copy.click(); await expect(page.getByRole('alert')).toContainText('limit of 10 goals');
  await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('Keep this week’s goal');
  await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveCount(0);
  assert.deepEqual(await (await f.request('member', '/api/weeks/2026-11-23')).json(), saved);
});

test('reload stays unavailable during a pending copy and failed goal edits can still autosave afterwards', async t => {
  const f = await copyBrowserFixture(t);
  const browser = f.browser;
  for (const [week, text] of [['2026-11-16', 'Recurring smoke test'], ['2026-11-23', 'Original goal']]) {
    await f.request('member', `/api/weeks/${week}/plans`, 'POST', { version: 0, goals: [{ text, links: [] }] });
  }
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
    await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(5000);
    await page.goto(f.origin + '/?page=week&week=2026-11-23');
    await page.route('**/api/weeks/2026-11-23/plans', route => route.fulfill({ status: 503, json: { error: 'Could not save goals.' } }));
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Keep my failed edit');
    await expect(page.getByRole('alert')).toContainText('Could not save goals.');
    await page.route('**/api/weeks/2026-11-16', async route => { await held; await route.continue(); });
    await page.getByRole('button', { name: 'Copy last week’s goals', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reload saved week', exact: true })).toBeDisabled();
    await page.unroute('**/api/weeks/2026-11-23/plans');
    release();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveValue('Recurring smoke test');
    await expect.poll(async () => (await (await f.request('member', '/api/weeks/2026-11-23')).json()).plans.at(-1)?.goals.map((goal: { text: string }) => goal.text)).toEqual(['Keep my failed edit', 'Recurring smoke test']);
    await expect(page.getByRole('button', { name: 'Next week', exact: true })).toBeEnabled();
  } finally { release(); }
});

test('copying preserves saved goals whose titles were temporarily cleared', async t => {
  const f = await copyBrowserFixture(t);
  const browser = f.browser;
  const path = '/api/weeks/2026-11-16';
  const original = await (await f.request('member', path + '/plans', 'POST', { version: 0, goals: [{ text: 'Keep this saved goal', links: [] }] })).json();
  await f.request('member', '/api/weeks/2026-11-09/plans', 'POST', { version: 0, goals: [{ text: 'Recurring goal', links: [] }] });
  const context = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
  await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
  await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  await page.goto(f.origin + '/?page=week&week=2026-11-16');
  await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('');
  await page.getByRole('button', { name: 'Copy last week’s goals', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveValue('Recurring goal');
  await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('');
  assert.deepEqual(await (await f.request('member', path)).json(), original);
  await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('Edited saved goal');
  await expect.poll(async () => (await (await f.request('member', path)).json()).plans.at(-1)?.goals.map((goal: { text: string }) => goal.text)).toEqual(['Edited saved goal', 'Recurring goal']);
  const saved = await (await f.request('member', path)).json();
  assert.equal(saved.plans.at(-1).goals[0].id, original.plans[0].goals[0].id);
});

test('a status chosen on an empty draft while copying stays with that draft', async t => {
  const f = await copyBrowserFixture(t);
  await f.request('member', '/api/weeks/2026-11-09/plans', 'POST', { version: 0, goals: [{ text: 'Recurring goal', links: [] }] });
  const context = await f.browser.newContext({ timezoneId: 'Pacific/Auckland' });
  await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
  await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  await page.goto(f.origin + '/?page=week&week=2026-11-16');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    await page.route('**/api/weeks/2026-11-09', async route => { await held; await route.continue(); });
    await page.getByRole('button', { name: 'Copy last week’s goals', exact: true }).click();
    await page.getByRole('group', { name: 'Status for goal 1', exact: true }).getByRole('radio', { name: 'At risk', exact: true }).check();
    release();
    await expect(page.getByRole('textbox', { name: 'Weekly goal 2', exact: true })).toHaveValue('Recurring goal');
    await expect(page.getByRole('textbox', { name: 'Weekly goal 1', exact: true })).toHaveValue('');
    await page.getByRole('textbox', { name: 'Weekly goal 1', exact: true }).fill('My new goal');
    await expect.poll(async () => {
      const saved = await (await f.request('member', '/api/weeks/2026-11-16')).json();
      const flags = saved.updates.at(-1)?.goalStatuses;
      return { text: saved.plans.at(-1)?.goals.find((goal: { id: string }) => goal.id === flags?.[0]?.goalId)?.text, statuses: flags?.map((flag: { status: string }) => flag.status) };
    }).toEqual({ text: 'My new goal', statuses: ['at-risk'] });
  } finally { release(); }
});
