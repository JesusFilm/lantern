import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';

test('member chooses goal visibility, reloads it and retains team-visible daily updates',async t=>{
 const f=await coachingFixture();t.after(()=>f.close());
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.goto(f.origin+'/?page=week&week=2026-11-23');
 await page.getByRole('textbox',{name:'Weekly goal 1',exact:true}).fill('My private course');
 await page.getByLabel('Who can see goal 1', {exact:true}).selectOption('private');
 await expect.poll(async()=>(await(await f.request('member','/api/weeks/2026-11-23')).json()).plans.at(-1)?.goals[0]?.visibility).toBe('private');
 await page.reload();await expect(page.getByLabel('Who can see goal 1',{exact:true})).toHaveValue('private');
 await expect(page.getByText('Daily updates are visible to your department and on the team TV.',{exact:true})).toBeVisible();
 assert.ok(!JSON.stringify(await(await f.request('peer','/api/team-updates?date=2026-11-23')).json()).includes('My private course'));
});

test('turning privacy choices off preserves existing privacy while other goal edits still save',async t=>{
 const {resolveFeatureConfig}=await import('./features.js');const config=resolveFeatureConfig({},'local'),states=new Map(config.states);
 const f=await coachingFixture(undefined,{...config,states});t.after(()=>f.close());
 const saved=await(await f.request('member','/api/weeks/2026-11-23/plans','POST',{version:0,goals:[{text:'Private course',visibility:'private',links:[]}]})).json();
 states.set('weekly-goal-privacy','off');
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();
 await page.goto(f.origin+'/?page=week&week=2026-11-23');await expect(page.getByLabel('Who can see goal 1',{exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Weekly goal 1',exact:true}).fill('Edited private course');
 await expect.poll(async()=>(await(await f.request('member','/api/weeks/2026-11-23')).json()).plans.at(-1)?.goals[0]?.text).toBe('Edited private course');
 const record=await(await f.request('member','/api/weeks/2026-11-23')).json();assert.equal(record.plans.at(-1).goals[0].visibility,'private');assert.equal(record.plans.at(-1).goals[0].id,saved.plans[0].goals[0].id);
 assert.ok(!JSON.stringify(await(await f.request('peer','/api/team-updates?date=2026-11-23')).json()).includes('private course'));
});
