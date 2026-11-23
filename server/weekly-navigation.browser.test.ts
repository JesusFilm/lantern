import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';

test('week history bounds are scoped to the active member and hidden with the feature', async () => {
  const f = await coachingFixture();
  try {
    assert.equal((await f.request('missing', '/api/weeks')).status, 401);
    assert.deepEqual(await (await f.request('member', '/api/weeks')).json(), { firstWeek: null });
    await f.request('member', '/api/weeks/2026-11-09/plans', 'POST', { version: 0, goals: [{text:'Demo goal',links:[]}] });
    await f.request('peer', '/api/weeks/2026-10-12/plans', 'POST', { version: 0, goals: [{text:'Private goal',links:[]}] });
    assert.deepEqual(await (await f.request('member', '/api/weeks')).json(), { firstWeek:'2026-11-09' });
    assert.deepEqual(await (await f.request('lead', '/api/weeks')).json(), { firstWeek:null });
  } finally { await f.close(); }
  const hidden = await coachingFixture(undefined, resolveFeatureConfig({}, 'production'));
  try { assert.equal((await hidden.request('member', '/api/weeks')).status, 404); } finally { await hidden.close(); }
});

test('week navigation supports planning ahead and returns one week at a time', async () => {
  const f = await coachingFixture();
  for (const week of ['2026-11-09','2026-11-16']) await f.request('member', '/api/weeks/'+week+'/plans', 'POST', { version:0,goals:[{text:week==='2026-11-09'?'Last week goal':'This week goal',links:[]}] });
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'}); f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
    await page.goto(f.origin+'/?page=week');
    const previous=page.getByRole('button',{name:'Previous week',exact:true}), next=page.getByRole('button',{name:'Next week',exact:true});
    await expect(previous).toBeEnabled();await expect(next).toBeEnabled();
    const range=page.getByText('Mon, 16 Nov – Fri, 20 Nov',{exact:true});await expect(range).toBeVisible();
    assert.equal(await range.evaluate(el=>el.tagName),'SPAN');
    await previous.click();await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('Last week goal');
    await expect(previous).toBeDisabled();await expect(next).toBeEnabled();
    await page.getByRole('button',{name:'Go to this week',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('This week goal');
    await previous.click();
    await next.click();await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('This week goal');await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('');
    await expect(page.getByRole('textbox',{name:'Daily update',exact:true})).toHaveCount(0);
    for (const status of await page.getByRole('radio').all()) await expect(status).toBeDisabled();
    await page.getByRole('textbox',{name:'Weekly goal 1',exact:true}).fill('Run the release smoke test');
    await expect.poll(async () => (await (await f.request('member','/api/weeks/2026-11-23')).json()).plans.at(-1)?.goals[0].text).toBe('Run the release smoke test');
    await page.reload();
    await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('Run the release smoke test');
    await next.click();
    await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('');
    await previous.click();
    await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('Run the release smoke test');
    await previous.click();
    await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveValue('This week goal');
    await page.getByRole('textbox',{name:'Daily update',exact:true}).fill('Uncommitted update');
    page.once('dialog',dialog=>dialog.dismiss());await previous.click();await expect(page.getByRole('textbox',{name:'Daily update',exact:true})).toHaveValue('Uncommitted update');
    for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));}
  }finally{await browser.close();await vite.close();await f.close();}
});
