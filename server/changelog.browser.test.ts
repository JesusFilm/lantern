import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';

test('member prepares an entry, retries verification and reads the published entry after reload', async (t) => {
  let available = false;
  const flags = resolveFeatureConfig({}, 'local'),
    states = new Map(flags.states);
  const f = await coachingFixture(
    undefined,
    { ...flags, states },
    {
      pullRequest: async () => {
        if (!available) throw Error('unavailable');
        return {
          title: 'Improve captions',
          merged: true,
          base: 'main',
          defaultBranch: 'main',
        };
      },
    },
  );
  t.after(() => f.close());
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'spa',
  });
  t.after(() => vite.close());
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addCookies([
    { name: 'lantern-session', value: 'member', url: f.origin },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  await page.goto(f.origin);
  await page.getByRole('link', { name: 'Changelog', exact: true }).click();
  await page.getByRole('button', { name: 'Write an entry' }).click();
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByLabel('Product name').fill('Film library');
  await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Title', { exact: true }).fill('Clearer captions');
  await page.getByLabel('What changed').fill('Larger caption text');
  await page.getByLabel('Why it helps').fill('Easier reading');
  await page
    .getByLabel('Pull request links')
    .fill('https://github.com/JesusFilm/library/pull/12');
  const publish = page.getByRole('button', { name: 'Publish' });
  await publish.click();
  await expect(page.getByRole('alert')).toContainText(
    'verification is unavailable',
  );
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Clearer captions',
  );
  const week = await page.getByLabel('Week starting').inputValue();
  available = true;
  await f.migration.query(
    'ALTER TABLE changelog_entries ADD CONSTRAINT simulate_save_failure CHECK(false)',
  );
  await publish.click();
  await expect(page.getByRole('alert')).toContainText(
    'temporarily unavailable',
  );
  await expect(page.getByLabel('Why it helps')).toHaveValue('Easier reading');
  const saved = await f.request('peer', '/api/changelog?week=' + week);
  assert.deepEqual((await saved.json()).entries, []);
  await f.migration.query(
    'ALTER TABLE changelog_entries DROP CONSTRAINT simulate_save_failure',
  );
  const entriesPath = '**/api/changelog/entries';
  await page.route(entriesPath, async (route) => {
    const committed = await route.fetch();
    assert.equal(committed.status(), 201);
    await route.abort('failed');
  }, { times: 1 });
  await publish.click();
  await expect(page.getByRole('alert')).toBeVisible();
  available = false;
  await publish.click();
  await expect(page.getByRole('heading', { name: 'Changelog' })).toBeVisible();
  assert.equal((await (await f.request('peer', '/api/changelog?week=' + week)).json()).entries.length, 1);
  await expect(
    page.getByRole('link', { name: 'Improve captions' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Clearer captions' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(
    page.getByRole('heading', { name: 'Clearer captions' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Next week' }).click();
  await page.getByRole('button', { name: 'Edit entry' }).click();
  await expect(page.getByLabel('Why it helps')).toHaveValue('Easier reading');
  available = true;
  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByRole('button', { name: 'Edit entry' }).click();
  await other.getByLabel('Title', { exact: true }).fill('Revised captions');
  await other.getByRole('button', { name: 'Save changes' }).click();
  await expect(other.getByRole('heading', { name: 'Revised captions' })).toBeVisible();
  await page.getByLabel('Why it helps').fill('Benefit from the second tab');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('newer version');
  await expect(page.getByLabel('Why it helps')).toHaveValue('Benefit from the second tab');
  await other.reload();
  await expect(other.getByRole('heading', { name: 'Revised captions' })).toBeVisible();
  await expect(other.getByText('Easier reading', { exact: true })).toBeVisible();
  available = false;
  await context.addCookies([
    { name: 'lantern-session', value: 'peer', url: f.origin },
  ]);
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Improve captions' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit entry' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mine', exact: true }).click();
  await expect(page.getByText('No entries for this week.')).toBeVisible();
  states.set('changelog', 'off');
  await page.goto(f.origin + '/?page=changelog');
  await expect(page.getByRole('link', { name: 'My week' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Changelog', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Write an entry' }),
  ).toHaveCount(0);
});
