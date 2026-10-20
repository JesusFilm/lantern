import assert from 'node:assert/strict';
import { chromium as defaultChromium, expect } from '@playwright/test';

export const ACCEPTANCE_CHECKS = Object.freeze([
  'authenticated-identities',
  'department-direction',
  'mission-image',
  'focus-authoring-persistence',
  'authorization-isolation',
  'stale-and-forged-writes',
  'lead-confirmation-lock',
  'account-and-guide',
  'browser-errors',
  'session-revocation',
]);

// The caller provisions disposable synthetic identities and removes their data.
// This journey uses ordinary sessions and public browser/HTTP interfaces only.
export async function runAcceptanceBrowser({ origin, sessions, runId }, { chromium = defaultChromium } = {}) {
  const checks = [], contexts = new Map(), identities = {};
  let browser, checkpoint = 'configuration', failure, cookieName, browserError = false;
  const timeout = 10000;
  const read = (context, path, options = {}) => context.request.get(origin + path, { timeout, ...options });
  const write = (context, method, path, data, headers = {}) => context.request[method](origin + path, {
    timeout, headers: { Origin: origin, ...headers }, data,
  });
  async function json(response, status = 200) {
    assert.equal(response.status(), status);
    return response.json();
  }
  async function saveDialog(page) {
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  function draft(focus) {
    return {
      title: focus.title, start: focus.start, end: focus.end,
      sections: focus.sections.map(section => ({
        ...section,
        ...(section.alignment ? { alignment: {
          other: section.alignment.other,
          initiatives: section.alignment.initiatives.map(({ id }) => ({ id })),
        } } : {}),
      })),
      version: focus.version,
    };
  }
  try {
    const target = new URL(origin);
    assert.equal(target.origin, origin);
    assert.ok(target.protocol === 'https:' || (target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)));
    assert.match(runId, /^[a-zA-Z0-9_-]{1,80}$/);
    const actors = ['member', 'peer', 'lead', 'outsider'];
    assert.ok(actors.every(actor => typeof sessions?.[actor] === 'string' && sessions[actor].length > 0));
    cookieName = target.protocol === 'https:' ? '__Host-lantern-session' : 'lantern-session';
    checkpoint = 'authenticated-identities';
    browser = await chromium.launch();
    for (const actor of actors) {
      const context = await browser.newContext();
      contexts.set(actor, context);
      context.setDefaultTimeout(timeout);
      context.setDefaultNavigationTimeout(15000);
      context.on('page', page => page.on('pageerror', () => { browserError = true; }));
      await context.addCookies([{ name: cookieName, value: sessions[actor], url: origin, httpOnly: true, secure: target.protocol === 'https:', sameSite: 'Lax' }]);
      const session = await json(await read(context, '/api/session'));
      assert.ok(session.user && session.department && !session.localAccess);
      assert.equal(session.department.role, actor === 'lead' ? 'career-lead' : 'member');
      identities[actor] = session;
    }
    assert.equal(new Set(Object.values(identities).map(session => session.user.id)).size, 4);
    assert.equal(identities.member.department.id, identities.peer.department.id);
    assert.equal(identities.member.department.id, identities.lead.department.id);
    assert.notEqual(identities.member.department.id, identities.outsider.department.id);
    checks.push(checkpoint);
    const member = contexts.get('member'), lead = contexts.get('lead');
    const memberPage = await member.newPage(), leadPage = await lead.newPage();

    checkpoint = 'department-direction';
    const mission = `Synthetic release mission ${runId}`, initiative = `Release initiative ${runId}`;
    await leadPage.goto(origin + '/?page=department');
    await leadPage.getByRole('button', { name: 'Mission & initiatives', exact: true }).click();
    await leadPage.getByLabel('Organizational mission', { exact: true }).fill(mission);
    await leadPage.getByRole('button', { name: 'Add initiative', exact: true }).click();
    await leadPage.getByLabel('Initiative name').fill(initiative);
    await leadPage.getByRole('dialog').getByRole('button', { name: 'Add initiative', exact: true }).click();
    await leadPage.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(leadPage.getByRole('status')).toContainText('Team direction saved');
    await leadPage.reload();
    await expect(leadPage.getByLabel('Organizational mission', { exact: true })).toHaveValue(mission);
    await expect(leadPage.getByRole('cell', { name: initiative, exact: true })).toBeVisible();
    await memberPage.goto(origin);
    await expect(memberPage.getByRole('region', { name: 'Our mission' })).toContainText(mission);
    checks.push(checkpoint);

    checkpoint = 'mission-image';
    await leadPage.getByRole('region', { name: 'Our mission' }).getByRole('button', { name: 'Change image', exact: true }).click();
    const imageDialog = leadPage.getByRole('dialog', { name: 'Banner image', exact: true });
    // Fixed 2x2 PNG: exercise browser conversion and deployed Sharp persistence
    // without writing an asset, screenshot or trace to the runner filesystem.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQImWNgqJsKQhAKABvOBE0blUQxAAAAAElFTkSuQmCC', 'base64');
    await imageDialog.getByLabel('Choose image').setInputFiles({ name: 'synthetic-release.png', mimeType: 'image/png', buffer: png });
    await expect(imageDialog.getByRole('button', { name: 'Use image', exact: true })).toBeEnabled();
    await imageDialog.getByRole('button', { name: 'Use image', exact: true }).click();
    await leadPage.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(leadPage.getByRole('status')).toContainText('Team direction saved');
    await leadPage.reload();
    await memberPage.reload();
    for (const page of [leadPage, memberPage]) {
      const image = page.getByRole('region', { name: 'Our mission' }).locator('img');
      await expect(image).toHaveAttribute('src', /^data:image\/webp;base64,/);
      await expect.poll(() => image.evaluate(element => ({ loaded: element.complete, width: element.naturalWidth, height: element.naturalHeight }))).toEqual({ loaded: true, width: 2, height: 2 });
    }
    checks.push(checkpoint);

    checkpoint = 'focus-authoring-persistence';
    const initialTitle = `Release draft ${runId}`, title = `Release agreement ${runId}`;
    const objective = 'Help the synthetic team prepare useful position focuses.';
    const goal = 'Publish two synthetic examples by December.';
    await memberPage.getByRole('button', { name: 'New position focus', exact: true }).click();
    await memberPage.getByLabel('Document title').fill(initialTitle);
    await memberPage.getByLabel('Period starts').fill('2026-01-01');
    await memberPage.getByLabel('Period ends').fill('2026-12-31');
    await saveDialog(memberPage);
    await expect(memberPage.getByRole('heading', { name: initialTitle, exact: true })).toBeVisible();
    const focusId = new URL(memberPage.url()).searchParams.get('focus');
    assert.ok(focusId);
    const path = '/api/focuses/' + focusId;
    const original = await json(await read(member, path));
    await memberPage.getByRole('button', { name: 'Edit title & dates', exact: true }).click();
    await memberPage.getByLabel('Document title').fill(title);
    await saveDialog(memberPage);
    await memberPage.getByRole('button', { name: 'Add objective', exact: true }).click();
    await memberPage.getByLabel('Objective', { exact: true }).fill('Prepare synthetic examples.');
    await memberPage.getByRole('checkbox', { name: initiative, exact: true }).check();
    await saveDialog(memberPage);
    await memberPage.getByRole('button', { name: 'Edit objective', exact: true }).click();
    await memberPage.getByLabel('Objective', { exact: true }).fill(objective);
    await saveDialog(memberPage);
    await memberPage.getByRole('button', { name: '+ Add SMART goal', exact: true }).click();
    await memberPage.getByLabel('SMART goal', { exact: true }).fill('Publish one synthetic example by June.');
    await saveDialog(memberPage);
    await memberPage.getByRole('button', { name: 'Edit', exact: true }).click();
    await memberPage.getByLabel('SMART goal', { exact: true }).fill(goal);
    await saveDialog(memberPage);
    await memberPage.reload();
    await expect(memberPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
    for (const text of [objective, goal, initiative]) await expect(memberPage.getByText(text, { exact: true })).toBeVisible();
    const saved = await json(await read(member, path));
    assert.equal(saved.title, title);
    assert.deepEqual(saved.sections.map(section => ({ objective: section.objective, goals: section.goals })), [{ objective, goals: [goal] }]);
    assert.equal(saved.sections[0].alignment.initiatives[0].name, initiative);
    checks.push(checkpoint);

    checkpoint = 'authorization-isolation';
    for (const actor of ['peer', 'outsider', 'lead']) {
      const context = contexts.get(actor);
      assert.equal((await read(context, path)).status(), 404);
      assert.equal((await write(context, 'put', path, draft(saved))).status(), 404);
    }
    assert.equal((await read(member, '/api/department')).status(), 403);
    const scopedPath = `/api/department/members/${identities.member.user.id}/focuses/${focusId}`;
    assert.equal((await read(lead, scopedPath)).status(), 200);
    assert.equal((await write(member, 'post', scopedPath + '/confirm', { version: saved.version })).status(), 403);
    const outsider = contexts.get('outsider');
    const outside = await json(await write(outsider, 'post', '/api/focuses', {
      title: `Outside department ${runId}`, start: '2026-01-01', end: '2026-12-31', sections: [],
    }), 201);
    const outsidePath = `/api/department/members/${identities.outsider.user.id}/focuses/${outside.id}`;
    assert.equal((await read(lead, outsidePath)).status(), 404);
    assert.equal((await write(lead, 'post', outsidePath + '/confirm', { version: outside.version })).status(), 404);
    checks.push(checkpoint);

    checkpoint = 'stale-and-forged-writes';
    assert.equal((await write(member, 'put', path, { ...draft(saved), version: original.version })).status(), 409);
    assert.equal((await write(member, 'put', path, { ...draft(saved), userId: identities.peer.user.id })).status(), 400);
    assert.equal((await write(member, 'put', path, draft(saved), { Origin: 'https://invalid.example.test' })).status(), 403);
    assert.deepEqual(await json(await read(member, path)), saved);
    checks.push(checkpoint);

    checkpoint = 'lead-confirmation-lock';
    await leadPage.goto(`${origin}/?page=department&member=${identities.member.user.id}&memberFocus=${focusId}`);
    await expect(leadPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(leadPage.getByText(goal, { exact: true })).toBeVisible();
    await leadPage.getByRole('button', { name: 'Confirm and lock', exact: true }).click();
    await leadPage.getByRole('dialog').getByRole('button', { name: 'Confirm and lock', exact: true }).click();
    await expect(leadPage.getByRole('dialog')).toBeHidden();
    await memberPage.reload();
    await leadPage.reload();
    for (const page of [memberPage, leadPage]) {
      await expect(page.getByText(/Confirmed by /)).toBeVisible();
      await expect(page.getByText(goal, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Edit|Remove|Add SMART|Add objective|Confirm and lock/ })).toHaveCount(0);
    }
    const confirmed = await json(await read(member, path));
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.confirmedBy.id, identities.lead.user.id);
    assert.equal((await write(member, 'put', path, draft(confirmed))).status(), 409);
    checks.push(checkpoint);

    checkpoint = 'account-and-guide';
    await memberPage.getByRole('button', { name: 'Account', exact: true }).click();
    await memberPage.getByRole('button', { name: 'Edit name', exact: true }).click();
    const name = `Synthetic member ${runId}`;
    await memberPage.getByLabel('Display name', { exact: true }).fill(name);
    await saveDialog(memberPage);
    await memberPage.reload();
    await expect(memberPage.getByText(name, { exact: true })).toBeVisible();
    await memberPage.getByRole('button', { name: 'Guide', exact: true }).click();
    await expect(memberPage.getByRole('heading', { name: 'What makes a useful objective?', exact: true })).toBeVisible();
    await memberPage.getByRole('button', { name: 'Example', exact: true }).click();
    await expect(memberPage.getByRole('heading', { name: 'A simple position focus', exact: true })).toBeVisible();
    checks.push(checkpoint);
    checkpoint = 'browser-errors';
    assert.equal(browserError, false);
    checks.push(checkpoint);
  } catch {
    failure = checkpoint;
  } finally {
    // Revoke every supplied session even after an assertion fails. Never retain
    // Playwright traces, screenshots, response bodies, identities or raw errors.
    for (const [actor, context] of contexts) {
      try {
        assert.equal((await write(context, 'post', '/api/sign-out', {})).status(), 204);
        assert.equal((await read(context, '/api/focuses', { headers: { Cookie: `${cookieName}=${sessions[actor]}` } })).status(), 401);
      } catch {
        failure ??= 'session-revocation';
      }
    }
    try { await browser?.close(); }
    catch { failure ??= 'browser-close'; }
  }
  if (failure) throw new Error(`Staging acceptance failed [${failure}].`);
  return [...checks, 'session-revocation'];
}
