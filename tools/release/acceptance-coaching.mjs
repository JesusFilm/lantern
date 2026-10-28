import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

// Uses ordinary authenticated browser/HTTP routes. The enclosing fixture owns
// cleanup and session revocation; no generated text or tokens enter evidence.
export async function runCoachingJourney({ context, origin, runId, enabled }) {
  const page = await context.newPage();
  const title = `Synthetic coaching ${runId}`;
  await page.goto(origin + '/?page=coach');
  await page.getByRole('button', { name: 'Create a focus', exact: true }).click();
  assert.equal(typeof enabled, 'boolean');
  let targetDate;
  if (enabled) {
    // Each server turn permits primary and fallback attempts of 25 seconds each.
    const modelTimeout = 60000;
    async function modelTurn(button) {
      const [response] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === '/api/coach/suggest'
          && response.request().method() === 'POST', { timeout: modelTimeout }),
        button.click(),
      ]);
      assert.equal(response.status(), 200);
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: modelTimeout });
    }
    const next = page.getByRole('button', { name: 'Next', exact: true });
    await page.getByLabel('Your project work', { exact: true }).fill(
      'I maintain a synthetic build diagnostics tool for engineers. I can review three failed builds with them and record which troubleshooting steps help.',
    );
    await modelTurn(next);
    const objectiveField = page.getByLabel('Objective', { exact: true });
    const answer = page.getByLabel('Your answer', { exact: true });
    for (let turn = 0; turn < 3; turn++) {
      await expect(objectiveField.or(answer)).toBeVisible();
      if (await objectiveField.isVisible()) break;
      await answer.fill('Engineers benefit by finding failed build causes sooner. I own the diagnostic messages and can review three failures with them, recording useful next steps.');
      await modelTurn(next);
    }
    await expect(objectiveField).toBeVisible();
    assert.ok((await objectiveField.inputValue()).trim());
    await next.click();
    await expect(page.getByRole('heading', { name: 'Which initiatives does it support?', exact: true })).toBeVisible();
    await modelTurn(next);
    await page.getByRole('radio').first().check();
    await next.click();
    targetDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    await page.getByLabel('Aim for', { exact: true }).fill(targetDate);
    await modelTurn(next);
    const goalField = page.getByLabel('Goal', { exact: true });
    await expect(goalField).toBeVisible();
    assert.ok((await goalField.inputValue()).trim());
    await page.getByRole('button', { name: 'Review draft', exact: true }).last().click();
  } else {
    const response = await context.request.post(origin + '/api/coach/suggest', {
      headers: { Origin: origin }, data: {}, timeout: 10000,
    });
    assert.equal(response.status(), 503);
    await expect(page.getByRole('heading', { name: 'Review your draft', exact: true })).toBeVisible();
    await page.getByLabel('Objective', { exact: true }).fill('Help engineers diagnose synthetic build failures.');
    await page.getByLabel('Goal', { exact: true }).fill('Review three synthetic build failures and record useful diagnostic steps.');
  }
  await page.getByLabel('Title', { exact: true }).fill(title);
  const objective = await page.getByLabel('Objective', { exact: true }).inputValue();
  const goal = await page.getByLabel('Goal', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue draft', exact: true }).click();
  await expect(page.getByLabel('Objective', { exact: true })).toHaveValue(objective);
  await expect(page.getByLabel('Goal', { exact: true })).toHaveValue(goal);
  await page.getByRole('button', { name: 'Ask career lead to review', exact: true }).click();
  await page.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect.poll(async () => {
    const response = await context.request.get(origin + '/api/coach/focuses', { timeout: 10000 });
    assert.equal(response.status(), 200);
    const records = await response.json();
    const record = records.find(item => item.focus.title === title);
    if (enabled && record) assert.equal(record.checkpoint?.date, targetDate);
    return record?.requests.at(-1)?.document.sections[0]?.goals[0];
  }).toBe(goal);
  await page.close();
}
