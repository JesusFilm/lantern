import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { test } from 'node:test';
import { resolve } from 'node:path';

const mission = 'We partner with the Body of Christ through heart language media, so everyone, everywhere can encounter Jesus.';
test('Guide browser acceptance: independent walkthroughs, navigation, context, example and mobile', { timeout: 90000 }, async (t) => {
  const server = await createServer({ configFile: resolve('tools/guide-preview/vite.config.ts'), server: { host: '127.0.0.1', port: 0 } });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await t.test('optional resources start closed, SMART is independent and context stays reader-controlled', async () => {
      await page.goto(origin);
      await expect(page.getByRole('heading', { name: 'Find the purpose. Give your work direction.' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'SMART goals', exact: true })).toHaveCount(0);
      const contextButton = page.getByRole('button', { name: 'Our shared context' });
      await expect(contextButton).toHaveAttribute('aria-expanded', 'false');
      await contextButton.click();
      await expect(page.getByText(mission, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Department contribution' })).toHaveCount(0);
      await page.getByRole('button', { name: /Open SMART walkthrough/ }).click();
      await expect(page.getByRole('status')).toHaveText('Step 1 of 7');
      await expect(contextButton).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText(mission, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Next →', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Specific · name the change' })).toBeFocused();
      await contextButton.click();
      await page.getByRole('button', { name: 'Next →', exact: true }).click();
      await expect(contextButton).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText(mission, { exact: true })).toBeHidden();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Step 2 of 7');
      for (const title of ['Measurable · choose meaningful evidence', 'Achievable · check the conditions', 'Relevant · keep the outcome in view', 'Time-bound · agree when to learn or act', 'Use the same approach for growth']) {
        await page.getByRole('button', { name: 'Next →', exact: true }).click();
        await expect(page.getByRole('heading', { name: title })).toBeVisible();
      }
      await expect(page.getByText('Leadership development assignments are a separate optional part beneath personal development.', { exact: false })).toBeVisible();
      await page.getByRole('button', { name: 'Finish walkthrough' }).click();
      await expect(page.getByRole('button', { name: /Open objective walkthrough/ })).toBeVisible();
    });
    await t.test('objective walkthrough covers internal work, discovery, gaps and agreement without a default cadence', async () => {
      await page.getByRole('button', { name: /Open objective walkthrough/ }).click();
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
      for (const title of ['Connect your work to the mission', 'Internal contributions count', 'When direction is still unclear', 'Turn gaps into next steps', 'Agree a focus you can revisit']) {
        await page.getByRole('button', { name: 'Next →', exact: true }).click();
        await expect(page.getByRole('heading', { name: title })).toBeVisible();
      }
      await expect(page.getByText('There is no default schedule or fixed first-review interval.', { exact: false })).toBeVisible();
      await expect(page.getByText('Lock-in completes your position focus for the cycle.', { exact: false })).toBeVisible();
      await page.getByRole('button', { name: 'SMART goals', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Step 1 of 7');
      await page.getByRole('button', { name: '← Guide overview' }).click();
      await page.screenshot({ path: 'captures/guide-overview.png', fullPage: true });
    });
    await t.test('full example is discoverable and preserves the reference and optional development', async () => {
      await page.getByRole('button', { name: /Read the full example/ }).click();
      await expect(page.getByRole('heading', { name: 'A clearer next step for viewers' })).toBeVisible();
      await expect(page.getByText('not a mandatory organizational template', { exact: false })).toBeVisible();
      await page.getByRole('link', { name: 'SMART goals for the contribution' }).click();
      await expect(page.getByText('By Month 1: test 20 viewers', { exact: false })).toBeVisible();
      await expect(page.getByText('By Month 6: retest 20 viewers; aim for at least 16', { exact: false })).toBeVisible();
      await page.getByRole('link', { name: 'Personal development · optional' }).click();
      await expect(page.getByText('By Month 2: compare two build options', { exact: false })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Leadership development assignment · optional' })).toBeVisible();
      await page.getByRole('link', { name: 'Review, agreement and timing' }).click();
      await expect(page.getByText('Actual departmental review timing has not been supplied here.', { exact: false })).toBeVisible();
      await page.screenshot({ path: 'captures/guide-example.png', fullPage: true });
    });
    await t.test('missing context is omitted and does not remove the objective requirement', async () => {
      await page.goto(origin + '/?context=none');
      await expect(page.getByRole('button', { name: 'Our shared context' })).toHaveCount(0);
      await page.getByRole('button', { name: /Open objective walkthrough/ }).click();
      await page.getByRole('button', { name: 'Next →', exact: true }).click();
      await expect(page.getByText('You still need an individual objective.', { exact: false })).toBeVisible();
      await page.goto(origin + '/?context=department-only');
      await page.getByRole('button', { name: 'Our shared context' }).click();
      await expect(page.getByRole('heading', { name: 'Organizational mission' })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Department contribution' })).toBeVisible();
      await page.goto(origin + '/?context=both');
      await page.getByRole('button', { name: 'Our shared context' }).click();
      await expect(page.getByText(mission, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Department contribution' })).toBeVisible();
    });
    await t.test('mobile reading, keyboard entry and reduced-motion navigation work', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(origin);
      const entry = page.getByRole('button', { name: /Open objective walkthrough/ });
      await entry.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status')).toHaveText('Step 1 of 6');
      await page.getByRole('button', { name: 'Our shared context' }).click();
      await page.getByRole('button', { name: 'Next →', exact: true }).click();
      await expect(page.getByText(mission, { exact: true })).toBeVisible();
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      await expect(page.getByRole('heading', { name: 'Connect your work to the mission' })).toBeInViewport();
      await page.screenshot({ path: 'captures/guide-mobile.png', fullPage: true });
      await page.getByRole('button', { name: 'Engineering example', exact: true }).click();
      await page.getByRole('link', { name: 'Review, agreement and timing' }).click();
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.close(); }
});
