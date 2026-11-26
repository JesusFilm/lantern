import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';

test('visibility icon opens a dropdown beside the goal menu, persists choices and enforces access',async t=>{
 const f=await coachingFixture();t.after(()=>f.close());
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
 const path='/api/weeks/2026-11-23';
 await page.goto(f.origin+'/?page=week&week=2026-11-23');await page.getByRole('tab', { name: 'Goals', exact: true }).click();
 const goal=page.getByRole('textbox',{name:'Weekly goal 1',exact:true});
 await goal.fill('My private course');
 const icon=(name:string)=>page.getByRole('button',{name:'Visibility for goal 1: '+name,exact:true});
 await expect(icon('Team')).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Who can see goal 1',exact:true})).toHaveCount(0);
 for(const [label,value,peerVisible,leadVisible] of [
  ['Me and my career lead','lead',false,true],['Only me','private',false,false],['Team','team',true,true],
 ] as const){
  const current=page.getByRole('button',{name:/^Visibility for goal 1:/});
  await current.focus();await current.press('Enter');
  const menu=page.getByRole('menu',{name:'Visibility for goal 1',exact:true});
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitemradio')).toHaveCount(3);
  await menu.getByRole('menuitemradio',{name:label,exact:true}).click();
  await expect(menu).not.toBeVisible();
  await expect(icon(label)).toBeVisible();
  await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.goals[0]?.visibility).toBe(value);
  await page.reload();await page.getByRole('tab', { name: 'Goals', exact: true }).click();await expect(icon(label)).toBeVisible();
  for(const [role,visible] of [['peer',peerVisible],['lead',leadVisible]] as const){
   assert.equal(JSON.stringify(await(await f.request(role,'/api/team-updates?date=2026-11-23')).json()).includes('My private course'),visible);
  }
 }
 await icon('Team').click();
 await expect(page.getByRole('menuitemradio',{name:'Team',exact:true})).toHaveAttribute('aria-checked','true');
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
 await expect(icon('Team')).toBeFocused();
 await expect(icon('Team')).toBeVisible();
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});
  const [field,visibility,menu]=await Promise.all([goal.boundingBox(),icon('Team').boundingBox(),page.getByRole('button',{name:'Actions for goal 1',exact:true}).boundingBox()]);
  assert.ok(field && visibility && menu);
  assert.ok(field.x+field.width<=visibility.x && visibility.x+visibility.width<=menu.x,'Visibility sits between goal title and menu');
  assert.ok(visibility.width>=44 && visibility.height>=44,'Visibility has a touch target');
  await icon('Team').click();
  const choices=page.getByRole('menu',{name:'Visibility for goal 1',exact:true});
  await expect(choices.getByRole('menuitemradio',{name:'Only me',exact:true})).toBeInViewport();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
 }
 await page.route('**/api/weeks/*/plans',route=>route.fulfill({status:503,json:{error:'Could not save visibility.'}}));
 await icon('Team').click();
 await page.getByRole('menuitemradio',{name:'Me and my career lead',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Could not save visibility.');
 await expect(icon('Me and my career lead')).toBeVisible();
 assert.equal((await(await f.request('member',path)).json()).plans.at(-1).goals[0].visibility,'team');
 await page.unroute('**/api/weeks/*/plans');await page.getByRole('button',{name:'Retry saving goals',exact:true}).click();
 await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.goals[0]?.visibility).toBe('lead');
 await page.reload();await page.getByRole('tab', { name: 'Goals', exact: true }).click();await expect(icon('Me and my career lead')).toBeVisible();
});

test('turning privacy choices off preserves existing privacy while other goal edits still save',async t=>{
 const {resolveFeatureConfig}=await import('./features.js');const config=resolveFeatureConfig({},'local'),states=new Map(config.states);
 const f=await coachingFixture(undefined,{...config,states});t.after(()=>f.close());
 const saved=await(await f.request('member','/api/weeks/2026-11-23/plans','POST',{version:0,goals:[{text:'Private course',visibility:'private',links:[]}]})).json();
 states.set('weekly-goal-privacy','off');
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();
 await page.goto(f.origin+'/?page=week&week=2026-11-23');await page.getByRole('tab', { name: 'Goals', exact: true }).click();await expect(page.getByRole('button',{name:/^Visibility for goal 1:/})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Weekly goal 1',exact:true}).fill('Edited private course');
 await expect.poll(async()=>(await(await f.request('member','/api/weeks/2026-11-23')).json()).plans.at(-1)?.goals[0]?.text).toBe('Edited private course');
 const record=await(await f.request('member','/api/weeks/2026-11-23')).json();assert.equal(record.plans.at(-1).goals[0].visibility,'private');assert.equal(record.plans.at(-1).goals[0].id,saved.plans[0].goals[0].id);
 assert.ok(!JSON.stringify(await(await f.request('peer','/api/team-updates?date=2026-11-23')).json()).includes('private course'));
 await page.goto(f.origin+'/?page=week&week=2026-11-30');await page.getByRole('tab', { name: 'Goals', exact: true }).click();await expect(page.getByRole('button',{name:'Copy last week’s goals',exact:true})).toHaveCount(0);
 assert.deepEqual((await(await f.request('member','/api/weeks/2026-11-30')).json()).plans,[]);
 assert.ok(!JSON.stringify(await(await f.request('peer','/api/team-updates?date=2026-11-30')).json()).includes('Edited private course'));
});
