import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';

test('My team opens today and navigates dated teammate snapshots with retry and mobile layout', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('peer',path+'/plans','POST',{version:0,goals:[{text:'Ship the mobile search fix',links:[{kind:'repository',label:'JesusFilm/forge',url:'https://github.com/JesusFilm/forge'}]}]})).json();
  const goalId=saved.plans[0].goals[0].id;
  await f.request('peer','/api/integrations/github/profile','PATCH',{username:'octocat'});
  for(const [date,body,status] of [['2026-11-18','Investigating offline search.','on-track'],['2026-11-19','Waiting on a device to reproduce the issue.','blocked']]) await f.request('peer',path+'/updates','POST',{date,body,planVersion:1,goalStatuses:[{goalId,status}]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
    await page.route('**/api/github-avatars/octocat',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="teal"/></svg>'}));
    await page.goto(f.origin+'/?page=team');
    await expect(page.getByRole('link',{name:'My team',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'My team',exact:true})).toBeVisible();
    const peer=page.getByRole('article',{name:'peer',exact:true});
    await expect(peer.locator('.team-avatar img')).toBeVisible();
    await expect.poll(()=>peer.locator('.team-avatar img').evaluate((img: { naturalWidth: number })=>img.naturalWidth)).toBe(80);
    await expect(peer.getByText('Waiting on a device to reproduce the issue.',{exact:true})).toBeVisible();
    await expect(peer.getByText('Blocked',{exact:true})).toBeVisible();
    await expect(peer.getByRole('link',{name:'forge',exact:true})).toHaveAttribute('href','https://github.com/JesusFilm/forge');
    const prev=page.getByRole('button',{name:'Previous day',exact:true}),next=page.getByRole('button',{name:'Next day',exact:true});
    await expect(next).toBeDisabled();await prev.click();
    await expect(peer.getByText('Investigating offline search.',{exact:true})).toBeVisible();await expect(prev).toBeDisabled();await expect(next).toBeEnabled();
    await next.click();await expect(peer.getByText('Blocked',{exact:true})).toBeVisible();
    await prev.click();await page.getByRole('button',{name:'Go to today',exact:true}).click();await expect(peer.getByText('Blocked',{exact:true})).toBeVisible();
    await page.route('**/api/team-updates?*',route=>route.fulfill({status:503,json:{error:'Team updates temporarily unavailable.'}}));
    await prev.click();await expect(page.getByRole('alert')).toContainText('Team updates temporarily unavailable.');
    await page.unroute('**/api/team-updates?*');await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(peer.getByText('Investigating offline search.',{exact:true})).toBeVisible();
    await expect(page.getByRole('article',{name:'lead',exact:true}).getByText('No update yet',{exact:true})).toBeVisible();
    await page.unroute('**/api/github-avatars/octocat');
    await page.route('**/api/github-avatars/octocat',route=>route.abort());
    await page.reload();await expect(peer.locator('.team-avatar')).toHaveText('P');
    await expect(peer.locator('.team-avatar img')).toHaveCount(0);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));}
  } finally {await browser.close();await vite.close();await f.close();}
});

test('My team navigation and direct screen are hidden with the feature off', async () => {
  const f=await coachingFixture(undefined,resolveFeatureConfig({LANTERN_FEATURES:'team-updates=off'},'local'));
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);const browser=await chromium.launch();
  try {const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();await page.goto(f.origin+'/?page=team');await expect(page.getByRole('heading',{name:'Page unavailable',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'My team',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'TV dashboard',exact:true})).toHaveCount(0);await page.goto(f.origin+'/?page=tv');await expect(page.getByRole('heading',{name:'Position focuses',exact:true})).toBeVisible();await expect(page.locator('.tv-stage')).toHaveCount(0);}
  finally {await browser.close();await vite.close();await f.close();}
});
