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
