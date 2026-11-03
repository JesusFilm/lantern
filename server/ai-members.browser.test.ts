import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expect } from '@playwright/test';
import type { AiMemberFocusResponse } from '../shared/ai-members.js';
import { aiBrowserFixture } from './ai-member-browser-test-support.js';

test('eligible owner adds a member, saves ordered focus and manages issuance-only secrets independently of profile Save', async () => {
  const f = await aiBrowserFixture();
  const errors: string[] = [];
  f.page.on('pageerror', e => errors.push(e.message));
  try {
    await f.page.goto(f.origin);
    await f.page.getByRole('button', { name: 'AI members — Experimental', exact: true }).click();
    await expect(f.page.getByText('Experimental · excluded from QA', { exact: true })).toBeVisible();
    await f.page.getByRole('button', { name: 'Add AI member', exact: true }).click();
    await f.page.getByLabel('Name', { exact: true }).fill('Synthetic helper');
    await f.page.getByLabel('Role / purpose (optional)').fill('Review synthetic changes');
    await f.page.getByRole('button', { name: 'Add member', exact: true }).click();
    await expect(f.page.getByRole('dialog')).toHaveCount(0);
    await f.page.reload();
    await f.page.getByRole('button', { name: 'Position focus', exact: true }).click();
    await f.page.getByLabel('Objective', { exact: true }).fill('Improve synthetic reliability');
    await f.page.getByLabel('SMART goal 1', { exact: true }).fill('Review three failures by December.');
    await f.page.getByRole('button', { name: 'Add SMART goal', exact: true }).click();
    await f.page.getByLabel('SMART goal 2', { exact: true }).fill('Publish two runbooks by January.');
    await f.page.getByRole('button', { name: 'Move goal 2 up', exact: true }).click();
    await f.page.getByRole('button', { name: 'Save focus', exact: true }).click();
    await f.page.getByRole('button', { name: 'Synthetic helper', exact: true }).click();
    await expect(f.page.getByText('Never retrieved', { exact: true })).toBeVisible();
    await f.page.getByLabel('Name', { exact: true }).fill('Pending name');
    await f.page.getByLabel('Token name', { exact: true }).fill('Morning reader');
    await f.page.getByRole('button', { name: 'Issue token', exact: true }).click();
    const secretField = f.page.getByLabel('New token secret', { exact: true });
    await expect(secretField).toHaveAttribute('type', 'password');
    const secret = await secretField.inputValue();
    await f.page.getByRole('button', { name: 'Reveal token', exact: true }).click();
    await expect(secretField).toHaveAttribute('type', 'text');
    await f.page.getByRole('button', { name: 'Done with token', exact: true }).click();
    await expect(secretField).toHaveCount(0);
    await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await f.page.reload();
    await f.page.getByRole('button', { name: 'Synthetic helper', exact: true }).click();
    await expect(f.page.getByText('Morning reader', { exact: true })).toBeVisible();
    await expect(secretField).toHaveCount(0);
    assert.equal(await f.page.evaluate(() => JSON.stringify([localStorage, sessionStorage])), '[{},{}]');
    const response = await fetch(f.origin + '/api/ai-member/position-focus', { headers: { Authorization: 'Bearer ' + secret } });
    assert.equal(response.status, 200);
    assert.deepEqual(((await response.json()) as AiMemberFocusResponse).focus.goals, ['Publish two runbooks by January.', 'Review three failures by December.']);
    await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await f.page.getByRole('button', { name: 'Synthetic helper', exact: true }).click();
    await expect(f.page.getByText(/Focus version 1 served/)).toBeVisible();
    f.page.once('dialog', d => d.accept());
    await f.page.getByRole('button', { name: 'Delete member', exact: true }).click();
    await expect(f.page.getByText('No AI members yet.', { exact: true })).toBeVisible();
    assert.deepEqual(errors, []);
  } finally { await f.close(); }
});

test('ineligible navigation is absent and direct experimental page cannot expose controls', async () => {
  const f = await aiBrowserFixture(undefined, false);
  try {
    await f.page.goto(f.origin + '/?page=ai-members');
    await expect(f.page.getByText('AI member management is unavailable.', { exact: true })).toBeVisible();
    await expect(f.page.getByRole('button', { name: 'AI members — Experimental', exact: true })).toHaveCount(0);
    await expect(f.page.getByRole('button', { name: 'Add AI member', exact: true })).toHaveCount(0);
  } finally { await f.close(); }
});

test('failed and stale focus saves retain pending edits; profile conflicts remain independent from retrieval', async () => {
  const f = await aiBrowserFixture();
  try {
    const member = await (await f.request('member', '/api/ai-members', 'POST', { name: 'Conflict helper' })).json();
    const path = '/api/ai-members/' + member.id;
    await f.page.goto(f.origin + '/?page=ai-members');
    await f.page.getByRole('button', { name: 'Position focus', exact: true }).click();
    await f.page.getByLabel('Objective', { exact: true }).fill('Pending outcome');
    await f.page.getByLabel('SMART goal 1', { exact: true }).fill('Pending goal');
    await f.page.route('**/api/ai-members/*/focus', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary storage failure' }) }));
    await f.page.getByRole('button', { name: 'Save focus', exact: true }).click();
    await expect(f.page.getByRole('alert')).toContainText('Temporary storage failure');
    await expect(f.page.getByLabel('Objective', { exact: true })).toHaveValue('Pending outcome');
    await f.page.unroute('**/api/ai-members/*/focus');
    await f.request('member', path + '/focus', 'PUT', { objective: 'Newer saved outcome', goals: ['Newer saved goal'], version: 0 });
    await f.page.getByRole('button', { name: 'Save focus', exact: true }).click();
    await expect(f.page.getByRole('alert')).toContainText('This focus changed');
    await expect(f.page.getByLabel('SMART goal 1', { exact: true })).toHaveValue('Pending goal');
    assert.equal((await (await f.request('member', path)).json()).focus.objective, 'Newer saved outcome');
    await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await f.page.getByRole('button', { name: 'Conflict helper', exact: true }).click();
    await f.page.getByLabel('Name', { exact: true }).fill('Pending profile');
    await f.request('member', path, 'PATCH', { name: 'Newer profile', purpose: '', profileRevision: 1 });
    await f.page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(f.page.getByRole('alert')).toContainText('This profile changed');
    await expect(f.page.getByLabel('Name', { exact: true })).toHaveValue('Pending profile');
    await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await f.page.reload();
    await expect(f.page.getByRole('button', { name: 'Newer profile', exact: true })).toBeVisible();
  } finally { await f.close(); }
});

test('coach suggestions require Apply and Save, discard on form change/cancellation and retain writing on provider failure', async () => {
  let mode: 'ok' | 'fail' | 'wait' = 'ok';
  const f = await aiBrowserFixture({ async suggest(_system, _input, validate, signal) {
    if (mode === 'fail') throw new Error('private provider diagnostic');
    if (mode === 'wait') await new Promise<void>((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true }));
    return validate({ objective: 'Suggested outcome', goals: ['Suggested first goal', 'Suggested second goal'] });
  } });
  try {
    const member = await (await f.request('member', '/api/ai-members', 'POST', { name: 'Coached helper' })).json();
    const path = '/api/ai-members/' + member.id;
    await f.page.goto(f.origin + '/?page=ai-members');
    await f.page.getByRole('button', { name: 'Position focus', exact: true }).click();
    await f.page.getByLabel('Objective', { exact: true }).fill('Manual outcome');
    await f.page.getByLabel('SMART goal 1', { exact: true }).fill('Manual goal');
    await f.page.getByRole('button', { name: 'Suggest improvements', exact: true }).click();
    await expect(f.page.getByRole('button', { name: 'Apply suggestion', exact: true })).toBeVisible();
    await expect(f.page.getByRole('dialog')).not.toBeVisible();
    await expect(f.page.getByLabel('Objective', { exact: true })).toHaveValue('Manual outcome');
    assert.equal((await (await f.request('member', path)).json()).focus, null);
    await f.page.getByLabel('Objective', { exact: true }).fill('Changed after suggestion');
    await expect(f.page.getByRole('button', { name: 'Apply suggestion', exact: true })).toHaveCount(0);
    await f.page.getByRole('button', { name: 'Suggest improvements', exact: true }).click();
    await f.page.getByRole('button', { name: 'Apply suggestion', exact: true }).click();
    await expect(f.page.getByLabel('SMART goal 2', { exact: true })).toHaveValue('Suggested second goal');
    assert.equal((await (await f.request('member', path)).json()).focus, null);
    mode = 'wait';
    await f.page.getByRole('button', { name: 'Suggest improvements', exact: true }).click();
    await f.page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(f.page.getByLabel('Objective', { exact: true })).toHaveValue('Suggested outcome');
    await expect(f.page.getByRole('button', { name: 'Apply suggestion', exact: true })).toHaveCount(0);
    mode = 'fail';
    await f.page.getByRole('button', { name: 'Suggest improvements', exact: true }).click();
    await expect(f.page.getByRole('alert')).toContainText('Your writing is still here');
    await expect(f.page.getByLabel('SMART goal 2', { exact: true })).toHaveValue('Suggested second goal');
    await f.page.getByRole('button', { name: 'Save focus', exact: true }).click();
    await expect(f.page.getByRole('button', { name: 'Position focus', exact: true })).toBeVisible();
    assert.deepEqual((await (await f.request('member', path)).json()).focus.goals, ['Suggested first goal', 'Suggested second goal']);
  } finally { await f.close(); }
});

for (const engine of ['chromium', 'webkit'] as const) test(`owner list, long focus and Manage reflow with reachable controls (${engine})`, async () => {
  const f = await aiBrowserFixture(undefined, true, engine);
  try {
    const member = await (await f.request('member', '/api/ai-members', 'POST', { name: 'Synthetic helper with a clear purpose', purpose: 'Review synthetic work. '.repeat(50) })).json();
    for (const size of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await f.page.setViewportSize(size);
      await f.page.goto(f.origin + '/?page=ai-members');
      await expect(f.page.getByRole('button', { name: 'Add AI member', exact: true })).toBeInViewport();
      await expect(f.page.getByRole('heading', { name: 'AI members', exact: true })).toBeInViewport();
      await expect(f.page.getByRole('button', { name: 'Position focus', exact: true })).toBeInViewport();
      assert.equal(await f.page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await f.page.getByRole('button', { name: 'Position focus', exact: true }).click();
      await expect(f.page.getByRole('heading', { name: 'Position focus', exact: true })).toBeInViewport();
      await f.page.getByLabel('Objective', { exact: true }).fill('Outcome with long-word-' + 'x'.repeat(250));
      await f.page.getByLabel('SMART goal 1', { exact: true }).fill('Review three synthetic tasks by December. '.repeat(50));
      assert.equal(await f.page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await f.page.getByRole('button', { name: 'Save focus', exact: true }).scrollIntoViewIfNeeded();
      await expect(f.page.getByRole('button', { name: 'Save focus', exact: true })).toBeInViewport();
      await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await f.page.getByRole('button', { name: member.name, exact: true }).click();
      await expect(f.page.getByRole('button', { name: 'Save changes', exact: true })).toBeInViewport();
      await expect(f.page.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
      const dialog = f.page.getByRole('dialog');
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await f.page.getByLabel('Token name', { exact: true }).fill('Synthetic reader');
      await f.page.getByRole('button', { name: 'Issue token', exact: true }).click();
      const secret = f.page.getByLabel('New token secret', { exact: true });
      await expect(secret).toBeVisible();
      await f.page.getByRole('button', { name: 'Reveal token', exact: true }).click();
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await f.page.getByRole('button', { name: 'Done with token', exact: true }).focus();
      await expect(f.page.getByRole('button', { name: 'Done with token', exact: true })).toBeFocused();
      await f.page.keyboard.press('Enter');
      await expect(secret).toHaveCount(0);
      await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
  } finally { await f.close(); }
});

test('an in-flight focus Save freezes suggestion application until persistence finishes', async () => {
  const f = await aiBrowserFixture({ async suggest(_system, _input, validate) { return validate({ objective: 'Suggested outcome', goals: ['Suggested goal'] }); } });
  let finishSave: (() => Promise<void>) | undefined;
  try {
    await f.request('member', '/api/ai-members', 'POST', { name: 'Save helper' });
    await f.page.goto(f.origin + '/?page=ai-members');
    await f.page.getByRole('button', { name: 'Position focus', exact: true }).click();
    await f.page.getByLabel('Objective', { exact: true }).fill('Manual outcome');
    await f.page.getByLabel('SMART goal 1', { exact: true }).fill('Manual goal');
    await f.page.getByRole('button', { name: 'Suggest improvements', exact: true }).click();
    await expect(f.page.getByRole('button', { name: 'Apply suggestion', exact: true })).toBeVisible();
    await expect(f.page.getByRole('dialog')).not.toBeVisible();
    await f.page.route('**/api/ai-members/*/focus', async route => {
      await new Promise<void>(resolve => { finishSave = async () => { await route.continue(); resolve(); }; });
    });
    await f.page.getByRole('button', { name: 'Save focus', exact: true }).click();
    await expect(f.page.getByRole('button', { name: 'Saving…', exact: true })).toBeVisible();
    await expect(f.page.getByRole('button', { name: 'Apply suggestion', exact: true })).toBeDisabled();
    await expect(f.page.getByLabel('Objective', { exact: true })).toBeDisabled();
    await expect.poll(() => !!finishSave).toBe(true);
    await finishSave!();
    finishSave = undefined;
    await expect(f.page.getByRole('button', { name: 'Position focus', exact: true })).toBeVisible();
  } finally { await finishSave?.().catch(() => {}); await f.close(); }
});

test('regeneration reveals a replacement only in that interaction and token deletion survives profile Cancel', async () => {
  const f = await aiBrowserFixture();
  try {
    const member = await (await f.request('member', '/api/ai-members', 'POST', { name: 'Token helper' })).json();
    const path = '/api/ai-members/' + member.id;
    await f.request('member', path + '/focus', 'PUT', { objective: 'Saved outcome', goals: ['Saved goal'], version: 0 });
    const original = await (await f.request('member', path + '/tokens', 'POST', { name: 'Reader' })).json();
    await f.page.goto(f.origin + '/?page=ai-members');
    await f.page.getByRole('button', { name: 'Token helper', exact: true }).click();
    f.page.once('dialog', d => d.dismiss());
    await f.page.getByRole('button', { name: 'Regenerate Reader', exact: true }).click();
    await expect(f.page.getByLabel('New token secret', { exact: true })).toHaveCount(0);
    assert.equal((await fetch(f.origin + '/api/ai-member/position-focus', { headers: { Authorization: 'Bearer ' + original.secret } })).status, 200);
    f.page.once('dialog', d => d.accept());
    await f.page.getByRole('button', { name: 'Regenerate Reader', exact: true }).click();
    const field = f.page.getByLabel('New token secret', { exact: true });
    await expect(field).toBeVisible();
    const replacement = await field.inputValue();
    assert.notEqual(replacement, original.secret);
    assert.equal((await fetch(f.origin + '/api/ai-member/position-focus', { headers: { Authorization: 'Bearer ' + original.secret } })).status, 401);
    await f.page.getByRole('button', { name: 'Done with token', exact: true }).click();
    f.page.once('dialog', d => d.accept());
    await f.page.getByRole('button', { name: 'Delete Reader', exact: true }).click();
    await expect(f.page.getByText('No tokens yet.', { exact: true })).toBeVisible();
    await f.page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await fetch(f.origin + '/api/ai-member/position-focus', { headers: { Authorization: 'Bearer ' + replacement } })).status, 401);
    assert.deepEqual((await (await f.request('member', path)).json()).tokens, []);
  } finally { await f.close(); }
});
