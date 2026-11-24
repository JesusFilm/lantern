import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture, draft } from './coach-test-support.js';

test('sidebar and review list flag unread work until its review is opened',async t=>{
 const f=await coachingFixture();t.after(()=>f.close());
 const focus=await(await f.request('member','/api/focuses','POST',draft)).json();
 const path='/api/coach/focuses/'+focus.id;
 await f.request('member',path+'/request','POST',{version:focus.version});
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'lead',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.goto(f.origin+'/?page=reviews');
 const count=page.getByLabel('1 focus with unread review activity');
 await expect(count).toBeVisible();await expect(page.getByText('New',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review focus',exact:true}).click();
 await expect(count).toHaveCount(0);
 await page.reload();await expect(count).toHaveCount(0);
 assert.deepEqual((await(await f.request('lead','/api/review-activity')).json()).items,[]);
 await page.getByRole('button',{name:'Review requests',exact:true}).click();
 await f.request('member',path+'/notes','POST',{version:focus.version,body:'A new member reply'});
 await page.reload();await expect(count).toBeVisible();
 await page.getByRole('button',{name:'Review focus',exact:true}).click();
 await expect(page.getByText('A new member reply',{exact:true})).toBeVisible();await expect(count).toHaveCount(0);
});

test('unread requests appear together above previously viewed focuses', async t => {
 const f=await coachingFixture(); t.after(()=>f.close());
 const send=async(title:string)=>{
  const focus=await(await f.request('member','/api/focuses','POST',{...draft,title})).json();
  const sent=await(await f.request('member',`/api/coach/focuses/${focus.id}/request`,'POST',{version:focus.version})).json();
  return {focus,requestId:sent.requests.at(-1).id};
 };
 const read=await send('Previously viewed focus');
 assert.equal((await f.request('lead',`/api/coach/focuses/${read.focus.id}/request-read`,'POST',{requestId:read.requestId})).status,204);
 await send('New focus');
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'lead',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.goto(f.origin+'/?page=reviews');
 const newGroup=page.getByRole('group',{name:'New activity'}), seenGroup=page.getByRole('group',{name:'Previously viewed'});
 await expect(newGroup.getByRole('heading',{name:'member · New focus'})).toBeVisible();
 await expect(seenGroup.getByRole('heading',{name:'member · Previously viewed focus'})).toBeVisible();
 assert.ok((await newGroup.boundingBox())!.y < (await seenGroup.boundingBox())!.y);
});

test('collapsed sidebar shows the unread count at the review icon corner', async t => {
 const f=await coachingFixture();t.after(()=>f.close());
 const focus=await(await f.request('member','/api/focuses','POST',draft)).json();
 await f.request('member',`/api/coach/focuses/${focus.id}/request`,'POST',{version:focus.version});
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'lead',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.goto(f.origin);
 const count=page.getByLabel('1 focus with unread review activity');await expect(count).toBeVisible();
 await page.getByRole('button',{name:'Collapse sidebar'}).click();
 await expect.poll(async()=> (await page.getByRole('complementary').boundingBox())!.width).toBe(76);
 const link=page.getByRole('link',{name:'Review requests',exact:true}), icon=link.locator('svg');
 await expect(link).toHaveAccessibleDescription('1 focus with unread review activity');
 await expect(count).toBeInViewport();
 const badge=(await count.boundingBox())!, iconBox=(await icon.boundingBox())!, nav=(await link.boundingBox())!;
 assert.ok(badge.x >= iconBox.x + iconBox.width * .4 && badge.y < iconBox.y + iconBox.height * .45, 'badge sits at the icon upper-right corner');
 assert.ok(badge.x + badge.width <= nav.x + nav.width && badge.y >= nav.y, 'badge remains within the link');
});

test('hidden review activity retains the original ungrouped list', async t => {
 const {resolveFeatureConfig}=await import('./features.js');
 const f=await coachingFixture(undefined,resolveFeatureConfig({LANTERN_FEATURES:'review-activity=off'},'local'));t.after(()=>f.close());
 const focus=await(await f.request('member','/api/focuses','POST',draft)).json();
 await f.request('member',`/api/coach/focuses/${focus.id}/request`,'POST',{version:focus.version});
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'lead',url:f.origin}]);const page=await context.newPage();
 await page.goto(f.origin+'/?page=reviews');
 await expect(page.getByRole('button',{name:'Review focus'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'New activity'})).toHaveCount(0);
 await expect(page.getByLabel('1 focus with unread review activity')).toHaveCount(0);
});

test('an initial activity failure does not label unread requests previously viewed', async t => {
 const f=await coachingFixture();t.after(()=>f.close());
 const focus=await(await f.request('member','/api/focuses','POST',draft)).json();
 await f.request('member',`/api/coach/focuses/${focus.id}/request`,'POST',{version:focus.version});
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'lead',url:f.origin}]);const page=await context.newPage();
 await page.route('**/api/review-activity',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
 await page.goto(f.origin+'/?page=reviews');
 await expect(page.getByRole('button',{name:'Review focus'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Previously viewed'})).toHaveCount(0);
});
