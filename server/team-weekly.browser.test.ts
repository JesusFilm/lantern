import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';
import { resolveFeatureConfig } from './features.js';

test('My team opens this week and navigates latest weekly teammate snapshots with retry and mobile layout', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('peer',path+'/plans','POST',{version:0,goals:[{text:'Ship the mobile search fix',links:[{kind:'repository',label:'JesusFilm/forge',url:'https://github.com/JesusFilm/forge'}]}]})).json();
  const goalId=saved.plans[0].goals[0].id;
  await f.request('peer','/api/integrations/github/profile','PATCH',{username:'octocat'});
  for(const [date,body,status] of [['2026-11-18','Investigating offline search.','on-track'],['2026-11-19','Waiting on a device to reproduce the issue.','blocked']]) await f.request('peer',path+'/updates','POST',{date,body,planVersion:1,goalStatuses:[{goalId,status}]});
  await f.request('peer','/api/weeks/2026-11-09/plans','POST',{version:0,goals:[{text:'Investigate search',links:[]}]});
  await f.request('peer','/api/weeks/2026-11-09/updates','POST',{date:'2026-11-12',body:'Last week’s investigation.',planVersion:1,goalStatuses:[]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
    await page.route('**/api/github-avatars/octocat',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="teal"/></svg>'}));
    await page.goto(f.origin+'/?page=team');
    await expect(page.getByRole('link',{name:'My team',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'My team',exact:true})).toBeVisible();
    await expect(page.locator('.week-range-full')).toHaveText('Mon, 16 Nov – Fri, 20 Nov');
    await expect(page.locator('.week-range-short')).toHaveText('16–20 Nov');
    const peer=page.getByRole('article',{name:'peer',exact:true});
    await expect(peer.locator('.team-avatar img')).toBeVisible();
    await expect.poll(()=>peer.locator('.team-avatar img').evaluate((img: { naturalWidth: number })=>img.naturalWidth)).toBe(80);
    await expect(peer.getByText('Waiting on a device to reproduce the issue.',{exact:true})).toBeVisible();
    await expect(peer.getByText('Blocked',{exact:true})).toBeVisible();
    await expect(peer.getByRole('link',{name:'forge',exact:true})).toHaveAttribute('href','https://github.com/JesusFilm/forge');
    const prev=page.getByRole('button',{name:'Previous week',exact:true}),next=page.getByRole('button',{name:'Next week',exact:true});
    await expect(peer.getByText('Investigating offline search.',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('group',{name:'Team update week',exact:true})).toBeVisible();
    await expect(next).toBeDisabled();await prev.click();
    await expect(peer.getByText('Last week’s investigation.',{exact:true})).toBeVisible();await expect(prev).toBeDisabled();await expect(next).toBeEnabled();
    await next.click();await expect(peer.getByText('Blocked',{exact:true})).toBeVisible();
    await prev.click();await page.getByRole('button',{name:'Go to current week',exact:true}).click();await expect(peer.getByText('Blocked',{exact:true})).toBeVisible();
    await page.route('**/api/team-updates?*',route=>route.fulfill({status:503,json:{error:'Team updates temporarily unavailable.'}}));
    await prev.click();await expect(page.getByRole('alert')).toContainText('Team updates temporarily unavailable.');
    await page.unroute('**/api/team-updates?*');await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(peer.getByText('Last week’s investigation.',{exact:true})).toBeVisible();
    await expect(page.getByRole('article',{name:'lead',exact:true}).getByText('No update yet',{exact:true})).toBeVisible();
    await page.unroute('**/api/github-avatars/octocat');
    await page.route('**/api/github-avatars/octocat',route=>route.abort());
    await page.reload();await expect(peer.locator('.team-avatar')).toHaveText('P');
    await expect(peer.locator('.team-avatar img')).toHaveCount(0);
    for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));}
  } finally {await browser.close();await vite.close();await f.close();}
});

test('My team shows elapsed time and latest updates before goals, with the empty state inside the update area', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  await f.request('peer',path+'/plans','POST',{version:0,goals:[{text:'Release search',links:[]}]});
  await f.request('peer',path+'/updates','POST',{date:'2026-11-18',body:'Search is ready.',planVersion:1,goalStatuses:[]});
  await f.admin.query("UPDATE daily_updates SET created_at='2026-11-17T21:00:00Z' WHERE user_id=$1",[f.ids.peer]);
  await f.request('peer','/api/integrations/github/profile','PATCH',{username:'octocat'});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});
    await context.clock.install({time:new Date('2026-11-19T10:00:00+13:00')});
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);
    const page=await context.newPage();await page.goto(f.origin+'/?page=team');
    const peer=page.getByRole('article',{name:'peer',exact:true});
    await expect(peer.getByText('Search is ready.',{exact:true})).toBeVisible();
    await expect(peer.getByText('1 day ago',{exact:true})).toBeVisible();
    await expect(peer.getByRole('link',{name:'octocat'})).toHaveCount(0);
    await expect(page.getByRole('article').first()).toHaveAccessibleName('peer');
    for(const [width,height] of [[1440,900],[768,1024],[640,360],[390,844],[320,700]] as const) {
      await page.setViewportSize({width,height});
      await expect.poll(async()=>{
        const update=await peer.getByText('Search is ready.',{exact:true}).boundingBox();
        const goals=await peer.getByText('Release search',{exact:true}).boundingBox();
        return !!update && !!goals && (width>800 ? update.x<goals.x : update.y<goals.y);
      }).toBe(true);
      const lead=page.getByRole('article',{name:'lead',exact:true});
      await expect(lead.locator('.team-update').getByText('No update yet',{exact:true})).toBeVisible();
      await expect(lead.locator('header').getByText('No update yet',{exact:true})).toHaveCount(0);
      assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    }
    await context.clock.fastForward(24*60*60*1000);await expect(peer.getByText('2 days ago',{exact:true})).toBeVisible();
    await page.reload();await expect(peer.getByText('Search is ready.',{exact:true})).toBeVisible();
    const longUpdate='Release details: '+ 'search'.repeat(600);
    assert.equal((await f.request('peer',path+'/updates','POST',{date:'2026-11-19',body:longUpdate,planVersion:1,goalStatuses:[]})).status,201);
    await page.reload();await expect(peer.getByText(longUpdate,{exact:true})).toBeVisible();
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await expect(peer.getByRole('textbox')).toHaveCount(0);
  } finally {await browser.close();await vite.close();await f.close();}
});

test('My team groups completed goals last and preserves the saved order within each group', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-23';
  try {
    const names=['Done first','Active first','Completed without a status','Reopened goal','Done second','Active second'];
    const saved=await(await f.request('peer',path+'/plans','POST',{version:0,goals:names.map((text,index)=>({text,completed:index===2||index===3,links:[]}))})).json();
    await f.request('lead',path+'/plans','POST',{version:0,goals:[{text:'All finished',completed:true,links:[]}]});
    const goals=saved.plans[0].goals;
    await f.request('peer',path+'/updates','POST',{date:'2026-11-27',body:'A mix of active and completed work.',planVersion:1,goalStatuses:[{goalId:goals[0].id,status:'done'},{goalId:goals[3].id,status:'on-track'},{goalId:goals[4].id,status:'done'}]});
    const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
    const browser=await chromium.launch();
    try {
      const context=await browser.newContext();await context.clock.setFixedTime(new Date('2026-11-27T12:00:00+13:00'));
      await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();await page.goto(f.origin+'/?page=team');
      const peer=page.getByRole('article',{name:'peer',exact:true});
      await expect(peer.locator('.week-today-goal-title')).toHaveText(['Active first','Reopened goal','Active second','Done first','Completed without a status','Done second']);
      await expect(peer.getByRole('heading',{name:'Completed',exact:true})).toBeVisible();
      await expect(peer.locator('.week-today-goal-title.is-done')).toHaveText(['Done first','Completed without a status','Done second']);
      const lead=page.getByRole('article',{name:'lead',exact:true});
      const column=await lead.locator('.team-goals-column').boundingBox(),heading=await lead.getByRole('heading',{name:'Completed',exact:true}).boundingBox();
      assert.ok(column && heading && Math.abs(heading.y-column.y)<1,'Completed starts at the top when there are no active goals');
    } finally {await browser.close();await vite.close();}
  } finally {await f.close();}
});

test('My team navigation and direct screen are available with production defaults', async () => {
  const f=await coachingFixture(undefined,resolveFeatureConfig({},'production'));
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);const browser=await chromium.launch();
  try {const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();await page.goto(f.origin+'/?page=team');await expect(page.getByRole('heading',{name:'My team',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'My team',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'TV dashboard',exact:true})).toHaveCount(0);await page.goto(f.origin+'/?page=tv');await expect(page.getByRole('heading',{name:'Position focuses',exact:true})).toBeVisible();await expect(page.locator('.tv-stage')).toHaveCount(0);}
  finally {await browser.close();await vite.close();await f.close();}
});
