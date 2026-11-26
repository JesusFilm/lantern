import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';

test('Updates and Goals tabs retain drafts, save changes and support keyboard navigation', async () => {
  const f = await coachingFixture(), path = '/api/weeks/2026-11-16';
  await f.request('member', path + '/plans', 'POST', {version:0,goals:[{text:'Prepare the demo',links:[]}]});
  const vite = await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({timezoneId:'Pacific/Auckland'});
    await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);
    const page=await context.newPage();page.setDefaultTimeout(5000);
    await page.goto(f.origin+'/?page=week');
    const edit=page.locator('.week-header').getByRole('tab',{name:'Goals',exact:true});
    const updates=page.getByRole('tab',{name:'Updates',exact:true});
    await expect(updates).toHaveAttribute('aria-selected','true');
    await expect(edit).toBeVisible();
    await expect(page.getByRole('textbox',{name:'Weekly goal 1',exact:true})).toHaveCount(0);
    await page.getByRole('textbox',{name:'Daily update',exact:true}).fill('Ready for a review.');
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:844});
      const [date,button]=await Promise.all([page.locator('.week-navigation').boundingBox(),edit.boundingBox()]);
      assert.ok(date && button && Math.abs(date.y+date.height/2-button.y-button.height/2)<1,'Edit goals stays on the date row');
      assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
      await page.getByRole('heading',{name:'Today’s update',exact:true}).scrollIntoViewIfNeeded();
      const todayHeading=await page.getByRole('heading',{name:'Today’s update',exact:true}).boundingBox();
      await edit.click();
      const goalsHeading=await page.getByRole('heading',{name:'Weekly goals',exact:true}).boundingBox();
      assert.ok(todayHeading && goalsHeading && Math.abs(todayHeading.y-goalsHeading.y)<1 && Math.abs(todayHeading.x-goalsHeading.x)<1,'Section headings line up across tabs');
      await updates.click();
    }
    await edit.click();
    const dialog=page.getByRole('tabpanel',{name:'Goals',exact:true});
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox',{name:'Weekly goal 1',exact:true}).fill('Prepare the walkthrough');
    await dialog.getByRole('button',{name:'Add goal',exact:true}).click();
    await edit.focus();await page.keyboard.press('ArrowLeft');await expect(updates).toBeFocused();await expect(updates).toHaveAttribute('aria-selected','true');await expect(dialog).toHaveCount(0);
    await edit.click();
    const second=dialog.getByRole('textbox',{name:'Weekly goal 2',exact:true});
    await expect(second).toHaveValue('');
    await second.fill('Test on mobile');
    await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.goals.map((g:{text:string})=>g.text)).toEqual(['Prepare the walkthrough','Test on mobile']);
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:844});
      await expect(dialog.getByRole('button',{name:'Add goal',exact:true})).toBeInViewport();
      assert.equal(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth),false);
    }
    await updates.click();
    await expect(page.getByRole('textbox',{name:'Daily update',exact:true})).toHaveValue('Ready for a review.');
    await page.getByRole('group',{name:'Status for Test on mobile',exact:true}).getByRole('radio',{name:'On track',exact:true}).check();
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.at(-1)?.goalStatuses[0]?.status).toBe('on-track');
    await page.reload();await expect(page.getByText('Prepare the walkthrough',{exact:true})).toBeVisible();
    await edit.click();await expect(second).toHaveValue('Test on mobile');
    await page.route('**/api/weeks/*/plans',route=>route.fulfill({status:503,json:{error:'Try saving again.'}}));
    await second.fill('Keep this draft');await expect(dialog.getByRole('alert')).toContainText('Try saving again.');
    await updates.click();
    await expect(page.getByRole('alert')).toContainText('Try saving again.');
    await edit.click();await expect(second).toHaveValue('Keep this draft');
    await page.unroute('**/api/weeks/*/plans');await dialog.getByRole('button',{name:'Retry saving goals',exact:true}).click();
    await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.goals[1]?.text).toBe('Keep this draft');
    await page.setViewportSize({width:390,height:844});
    for(let number=3;number<=10;number++) {
      await dialog.getByRole('button',{name:'Add goal',exact:true}).click();
      await dialog.getByRole('textbox',{name:`Weekly goal ${number}`,exact:true}).fill(`Goal ${number}`);
    }
    await expect(dialog.getByRole('button',{name:'Add goal',exact:true})).toBeDisabled();
    await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.goals.length).toBe(10);
  } finally {await browser.close();await vite.close();await f.close();}
});

test('completed goals stay below active goals and return when their daily status changes', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Finished first',links:[]},{text:'Still working',links:[]},{text:'Needs review',links:[]}]})).json();
  await f.request('member',path+'/updates','POST',{date:'2026-11-19',body:'Progress',planVersion:1,goalStatuses:[{goalId:saved.plans[0].goals[0].id,status:'done'}]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    const today=page.getByRole('region',{name:'Daily update',exact:true});
    await expect(today.getByRole('listitem').locator('.week-today-goal-title')).toHaveText(['Still working','Needs review','Finished first']);
    await expect(today.getByRole('heading',{name:'Completed',exact:true})).toBeVisible();
    const edit=page.getByRole('tab',{name:'Goals',exact:true});await edit.click();
    const dialog=page.getByRole('tabpanel',{name:'Goals',exact:true});
    assert.deepEqual(await dialog.locator('input.week-goal-text').evaluateAll(elements=>elements.map(el=>el.getAttribute('value'))),['Still working','Needs review','Finished first']);
    await expect(dialog.getByRole('heading',{name:'Completed',exact:true})).toBeVisible();
    await page.getByRole('tab',{name:'Updates',exact:true}).click();
    await today.getByRole('group',{name:'Status for Still working',exact:true}).getByRole('radio',{name:'Done',exact:true}).check();
    await expect(today.getByRole('listitem').locator('.week-today-goal-title')).toHaveText(['Needs review','Finished first','Still working']);
    await today.getByRole('group',{name:'Status for Finished first',exact:true}).getByRole('radio',{name:'On track',exact:true}).check();
    await expect(today.getByRole('listitem').locator('.week-today-goal-title')).toHaveText(['Finished first','Needs review','Still working']);
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.at(-1)?.goalStatuses.map((flag:{status:string})=>flag.status)).toEqual(['on-track','done']);
    await page.reload();await expect(today.getByRole('listitem').locator('.week-today-goal-title')).toHaveText(['Finished first','Needs review','Still working']);
  } finally {await browser.close();await vite.close();await f.close();}
});

test('completed goals cannot be reordered while active goals retain keyboard ordering', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:['Done first','Active first','Done second','Active second'].map(text=>({text,links:[]}))})).json();
  await f.request('member',path+'/updates','POST',{date:'2026-11-19',body:'Progress',planVersion:1,goalStatuses:[0,2].map(index=>({goalId:saved.plans[0].goals[index].id,status:'done'}))});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    await page.getByRole('tab',{name:'Goals',exact:true}).click();
    const panel=page.getByRole('tabpanel',{name:'Goals',exact:true});
    for (const title of ['Done first','Done second']) {
      const row=panel.locator('.week-goal-row').filter({has:page.locator(`input[value="${title}"]`)});
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('button',{name:/Reorder goal/})).toHaveCount(0);
    }
    await expect(panel.getByRole('button',{name:/Reorder goal/})).toHaveCount(2);
    await panel.getByRole('button',{name:'Reorder goal 1',exact:true}).focus();await page.keyboard.press('ArrowDown');
    await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.goals.map((goal:{text:string})=>goal.text)).toEqual(['Done first','Active second','Done second','Active first']);
    await page.reload();await page.getByRole('tab',{name:'Goals',exact:true}).click();
    await expect.poll(()=>panel.getByRole('textbox',{name:/Weekly goal/}).evaluateAll(elements=>elements.map(element=>element.getAttribute('value')))).toEqual(['Active second','Active first','Done first','Done second']);
    await expect(panel.getByRole('button',{name:/Reorder goal/})).toHaveCount(2);
    await panel.getByRole('group',{name:'Status for Done first',exact:true}).getByRole('radio',{name:'On track',exact:true}).check();
    await expect(panel.getByRole('button',{name:/Reorder goal/})).toHaveCount(3);
  } finally {await browser.close();await vite.close();await f.close();}
});

test('Goals edits today’s status with shared persistence, completed grouping and save recovery', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Prepare the demo',links:[]},{text:'Review the notes',links:[]}]});
  await f.request('member',path+'/updates','POST',{date:'2026-11-19',body:'Keep these daily notes.',planVersion:1,goalStatuses:[]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    const goalsTab=page.getByRole('tab',{name:'Goals',exact:true}),updatesTab=page.getByRole('tab',{name:'Updates',exact:true});
    await goalsTab.click();
    const panel=page.getByRole('tabpanel',{name:'Goals',exact:true});
    const status=panel.getByRole('group',{name:'Status for Prepare the demo',exact:true});
    await expect(status.getByRole('radio')).toHaveCount(4);
    for(const [label,value] of [['On track','on-track'],['At risk','at-risk'],['Blocked','blocked'],['Done','done']]) {
      await status.getByRole('radio',{name:label,exact:true}).check();
      await expect.poll(async()=>{const update=(await(await f.request('member',path)).json()).updates.at(-1);return {status:update?.goalStatuses[0]?.status,body:update?.body};}).toEqual({status:value,body:'Keep these daily notes.'});
      await updatesTab.click();await expect(page.getByRole('group',{name:'Status for Prepare the demo',exact:true}).getByRole('radio',{name:label,exact:true})).toBeChecked();
      await goalsTab.click();
    }
    await expect(panel.getByRole('heading',{name:'Completed',exact:true})).toBeVisible();
    assert.deepEqual(await panel.locator('input.week-goal-text').evaluateAll(elements=>elements.map(el=>el.getAttribute('value'))),['Review the notes','Prepare the demo']);
    await page.reload();await goalsTab.click();await expect(status.getByRole('radio',{name:'Done',exact:true})).toBeChecked();
    await page.route('**/api/weeks/*/updates',route=>route.fulfill({status:503,json:{error:'Could not save status.'}}));
    await status.getByRole('radio',{name:'Blocked',exact:true}).check();
    await expect(panel.getByRole('alert')).toContainText('Could not save status.');
    await expect(status.getByRole('radio',{name:'Blocked',exact:true})).toBeChecked();
    await page.unroute('**/api/weeks/*/updates');await panel.getByRole('button',{name:'Retry saving update',exact:true}).click();
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.at(-1)?.goalStatuses[0]?.status).toBe('blocked');
    await updatesTab.click();await page.getByRole('group',{name:'Status for Prepare the demo',exact:true}).getByRole('radio',{name:'At risk',exact:true}).check();
    await goalsTab.click();await expect(status.getByRole('radio',{name:'At risk',exact:true})).toBeChecked();
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:844});
      await expect(status.getByRole('radio',{name:'Done',exact:true})).toBeVisible();
      const bounds=await status.boundingBox();assert.ok(bounds && bounds.height<=34,'Goal status controls stay slim');
      assert.equal(await page.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
    }
  } finally {await browser.close();await vite.close();await f.close();}
});

test('daily statuses carry forward while earlier completed goals stay out of today and history is preserved', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:['Track','Risk','Block','Finished','New goal'].map(text=>({text,links:[]}))})).json();
  const ids=saved.plans[0].goals.map((goal:{id:string})=>goal.id);
  await f.request('member',path+'/updates','POST',{date:'2026-11-17',body:'Earlier notes',planVersion:1,goalStatuses:[{goalId:ids[0],status:'on-track'},{goalId:ids[1],status:'at-risk'},{goalId:ids[2],status:'blocked'},{goalId:ids[3],status:'done'}]});
  await f.request('member',path+'/updates','POST',{date:'2026-11-18',body:'Yesterday only changed one goal',planVersion:1,goalStatuses:[{goalId:ids[1],status:'blocked'}]});
  const before=(await(await f.request('member',path)).json()).updates;
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-19T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    const today=page.getByRole('region',{name:'Daily update',exact:true});
    await expect(today.getByRole('textbox',{name:'Daily update',exact:true})).toHaveValue('');
    for(const [name,status] of [['Track','On track'],['Risk','Blocked'],['Block','Blocked']]) await expect(today.getByRole('group',{name:`Status for ${name}`,exact:true}).getByRole('radio',{name:status,exact:true})).toBeChecked();
    await expect(today.getByRole('group',{name:'Status for New goal',exact:true}).getByRole('radio',{checked:true})).toHaveCount(0);
    await expect(today.getByText('Finished',{exact:true})).toHaveCount(0);
    await page.getByRole('tab',{name:'Goals',exact:true}).click();
    const goals=page.getByRole('tabpanel',{name:'Goals',exact:true});
    await expect(goals.getByRole('group',{name:'Status for Finished',exact:true}).getByRole('radio',{name:'Done',exact:true})).toBeChecked();
    await expect(goals.locator('.week-goal-row').filter({has:page.locator('input[value="Finished"]')}).getByRole('button',{name:/Reorder goal/})).toHaveCount(0);
    await page.getByRole('tab',{name:'Updates',exact:true}).click();
    await today.getByRole('group',{name:'Status for Track',exact:true}).getByRole('radio',{name:'Done',exact:true}).check();
    await today.getByRole('textbox',{name:'Daily update',exact:true}).fill('Today only');
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.at(-1)?.body).toBe('Today only');
    await page.reload();
    await expect(today.getByText('Track',{exact:true})).toBeVisible();
    await expect(today.getByText('Finished',{exact:true})).toHaveCount(0);
    const history=page.locator('details.week-day-entry').filter({hasText:'Tuesday, 17 Nov'});await history.locator('summary').click();
    await expect(history.getByText('Finished',{exact:true})).toBeVisible();await expect(history.getByText('Done',{exact:true})).toBeVisible();
    const after=(await(await f.request('member',path)).json()).updates;assert.deepEqual(after.slice(0,2),before);
    await page.getByRole('tab',{name:'Goals',exact:true}).click();
    await goals.getByRole('group',{name:'Status for Finished',exact:true}).getByRole('radio',{name:'At risk',exact:true}).check();
    await page.getByRole('tab',{name:'Updates',exact:true}).click();
    await expect(today.getByRole('group',{name:'Status for Finished',exact:true}).getByRole('radio',{name:'At risk',exact:true})).toBeChecked();
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.at(-1)?.goalStatuses.find((flag:{goalId:string})=>flag.goalId===ids[3])?.status).toBe('at-risk');
  } finally {await browser.close();await vite.close();await f.close();}
});

test('an open tab carries statuses across midnight with a fresh note and hides yesterday’s completions', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Ongoing',links:[]},{text:'Finished yesterday',links:[]}]})).json();
  const flags=saved.plans[0].goals.map((goal:{id:string},index:number)=>({goalId:goal.id,status:index?'done':'at-risk'}));
  await f.request('member',path+'/updates','POST',{date:'2026-11-19',body:'Yesterday’s note',planVersion:1,goalStatuses:flags});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.install({time:new Date('2026-11-19T23:59:00+13:00')});
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    const today=page.getByRole('region',{name:'Daily update',exact:true}),text=today.getByRole('textbox',{name:'Daily update',exact:true});
    await expect(text).toHaveValue('Yesterday’s note');await expect(today.getByText('Finished yesterday',{exact:true})).toBeVisible();
    await context.clock.fastForward(120_000);
    await expect(today.getByText('Friday, 20 Nov',{exact:true})).toBeVisible();
    await expect(text).toHaveValue('');
    await expect(today.getByRole('group',{name:'Status for Ongoing',exact:true}).getByRole('radio',{name:'At risk',exact:true})).toBeChecked();
    await expect(today.getByText('Finished yesterday',{exact:true})).toHaveCount(0);
    await text.fill('Fresh Friday note');await context.clock.fastForward(1000);
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.at(-1)?.body).toBe('Fresh Friday note');
    const days=(await(await f.request('member',path)).json()).updates;
    assert.equal(days[0].body,'Yesterday’s note');assert.deepEqual(days[0].goalStatuses,flags);
    assert.equal(days[1].date,'2026-11-20');assert.deepEqual(days[1].goalStatuses,flags);
    await page.reload();await expect(text).toHaveValue('Fresh Friday note');await expect(today.getByText('Finished yesterday',{exact:true})).toHaveCount(0);
    await context.clock.setFixedTime(new Date('2026-11-21T10:00:00+13:00'));await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await expect(today.getByText('Saturday, 21 Nov',{exact:true})).toBeVisible();await expect(text).toHaveValue('');
    await expect(today.getByRole('group',{name:'Status for Ongoing',exact:true}).getByRole('radio',{name:'At risk',exact:true})).toBeChecked();
    await expect(today.getByText('Finished yesterday',{exact:true})).toHaveCount(0);
  } finally {await browser.close();await vite.close();await f.close();}
});

test('a status save finishing after midnight is carried into the fresh daily draft', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Finish the review',links:[]}]})).json();
  const goalId=saved.plans[0].goals[0].id;
  await f.request('member',path+'/updates','POST',{date:'2026-11-19',body:'Thursday note',planVersion:1,goalStatuses:[{goalId,status:'on-track'}]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.install({time:new Date('2026-11-19T23:59:00+13:00')});
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    const today=page.getByRole('region',{name:'Daily update',exact:true});
    let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});
    await page.route('**/api/weeks/*/updates',async route=>{started();await held;await route.continue();});
    await today.getByRole('group',{name:'Status for Finish the review',exact:true}).getByRole('radio',{name:'Blocked',exact:true}).check();await context.clock.fastForward(1000);await pending;
    await context.clock.fastForward(120_000);release();
    await expect(today.getByRole('textbox',{name:'Daily update',exact:true})).toHaveValue('');
    await expect(today.getByRole('group',{name:'Status for Finish the review',exact:true}).getByRole('radio',{name:'Blocked',exact:true})).toBeChecked();
    await expect(page.getByRole('region',{name:'Unsaved previous updates',exact:true})).toHaveCount(0);
    const days=(await(await f.request('member',path)).json()).updates;
    assert.equal(days.length,1);assert.equal(days[0].date,'2026-11-19');assert.equal(days[0].body,'Thursday note');assert.equal(days[0].goalStatuses[0].status,'blocked');
  } finally {release();await browser.close();await vite.close();await f.close();}
});

for (const failed of [false,true]) test(`midnight retains a ${failed?'failed':'debounced'} update for its original date and retry preserves today’s fresh message`, async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Keep working',links:[]}]})).json();
  const goalId=saved.plans[0].goals[0].id;
  await f.request('member',path+'/updates','POST',{date:'2026-11-19',body:'Saved Thursday note',planVersion:1,goalStatuses:[{goalId,status:'on-track'}]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.install({time:new Date('2026-11-19T23:59:00+13:00')});
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    await context.clock.pauseAt(new Date(failed?'2026-11-19T23:59:30+13:00':'2026-11-19T23:59:59.700+13:00'));
    if(failed) await page.route('**/api/weeks/*/updates',route=>route.fulfill({status:503,json:{error:'Temporarily unavailable.'}}));
    const today=page.getByRole('region',{name:'Daily update',exact:true}),text=today.getByRole('textbox',{name:'Daily update',exact:true});
    await text.fill('Retain Thursday’s final edit');await today.getByRole('group',{name:'Status for Keep working',exact:true}).getByRole('radio',{name:'Blocked',exact:true}).check();
    if(failed) {await context.clock.fastForward(1000);await expect(today.getByRole('alert')).toContainText('Temporarily unavailable.');}
    await context.clock.fastForward(failed?120_000:400);
    await expect(text).toHaveValue('');
    const retained=page.getByRole('region',{name:'Unsaved previous updates',exact:true});
    await expect(retained).toContainText('Retain Thursday’s final edit');await expect(retained).toContainText('Blocked');
    await expect(retained).toContainText('Thursday, 19 Nov');
    if(failed) {
      await retained.getByRole('button',{name:'Retry saving update for Thursday, 19 Nov',exact:true}).click();
      await expect(retained.getByRole('alert')).toContainText('Temporarily unavailable.');
      await expect(retained).toContainText('Retain Thursday’s final edit');
    }
    await text.fill('Friday’s own draft');
    if(failed) {
      await page.getByRole('tab',{name:'Goals',exact:true}).click();
      await page.getByRole('textbox',{name:'Weekly goal 1',exact:true}).fill('Keep working, renamed');
      await context.clock.fastForward(1000);
      await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.version).toBe(2);
      await page.getByRole('tab',{name:'Updates',exact:true}).click();
    }
    await page.unroute('**/api/weeks/*/updates');await retained.getByRole('button',{name:'Retry saving update for Thursday, 19 Nov',exact:true}).click();
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.find((update:{date:string})=>update.date==='2026-11-19')?.body).toBe('Retain Thursday’s final edit');
    await expect(retained).toHaveCount(0);await expect(text).toHaveValue('Friday’s own draft');
    await expect(today.getByRole('group',{name:failed?'Status for Keep working, renamed':'Status for Keep working',exact:true}).getByRole('radio',{name:'Blocked',exact:true})).toBeChecked();
    const record=(await(await f.request('member',path)).json());assert.equal(record.updates.find((update:{date:string})=>update.date==='2026-11-19').goalStatuses[0].status,'blocked');
  } finally {await browser.close();await vite.close();await f.close();}
});

test('historical completed goals remain completed and nonreorderable after partial daily updates', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Finished earlier',links:[]},{text:'Ongoing work',links:[]}]})).json();
  await f.request('member',path+'/updates','POST',{date:'2026-11-17',body:'Finished',planVersion:1,goalStatuses:[{goalId:saved.plans[0].goals[0].id,status:'done'}]});
  await f.request('member',path+'/updates','POST',{date:'2026-11-18',body:'Working',planVersion:1,goalStatuses:[{goalId:saved.plans[0].goals[1].id,status:'blocked'}]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.setFixedTime(new Date('2026-11-26T10:00:00+13:00'));
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week&week=2026-11-16');
    await page.getByRole('tab',{name:'Goals',exact:true}).click();const goals=page.getByRole('tabpanel',{name:'Goals',exact:true});
    await expect(goals.getByRole('heading',{name:'Completed',exact:true})).toBeVisible();
    assert.deepEqual(await goals.getByRole('textbox',{name:/Weekly goal/}).evaluateAll(elements=>elements.map(element=>element.getAttribute('value'))),['Ongoing work','Finished earlier']);
    await expect(goals.locator('.week-goal-row').filter({has:page.locator('input[value="Finished earlier"]')}).getByRole('button',{name:/Reorder goal/})).toHaveCount(0);
  } finally {await browser.close();await vite.close();await f.close();}
});

test('future planning does not create a retained daily update when the day changes', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-23';
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.install({time:new Date('2026-11-19T23:58:00+13:00')});
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week&week=2026-11-23');
    await page.getByRole('tab',{name:'Goals',exact:true}).click();await page.getByRole('textbox',{name:'Weekly goal 1',exact:true}).fill('Future planning only');
    await context.clock.fastForward(1000);await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.version).toBe(1);
    await context.clock.fastForward(180_000);
    await expect(page.getByRole('region',{name:'Unsaved previous updates',exact:true})).toHaveCount(0);
    assert.deepEqual((await(await f.request('member',path)).json()).updates,[]);
  } finally {await browser.close();await vite.close();await f.close();}
});

test('a new goal’s debounced status remains recoverable under its original date at midnight', async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Existing goal',links:[]}]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.install({time:new Date('2026-11-19T23:59:00+13:00')});
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    await context.clock.pauseAt(new Date('2026-11-19T23:59:59.700+13:00'));
    await page.getByRole('tab',{name:'Goals',exact:true}).click();await page.getByRole('button',{name:'Add goal',exact:true}).click();await page.getByRole('textbox',{name:'Weekly goal 2',exact:true}).fill('Newly added goal');
    await page.getByRole('group',{name:'Status for Newly added goal',exact:true}).getByRole('radio',{name:'Blocked',exact:true}).check();
    await context.clock.fastForward(400);await context.clock.fastForward(1000);
    await expect.poll(async()=>(await(await f.request('member',path)).json()).plans.at(-1)?.goals.length).toBe(2);
    const retained=page.getByRole('region',{name:'Unsaved previous updates',exact:true});await expect(retained).toContainText('Newly added goal: Blocked');
    await retained.getByRole('button',{name:'Retry saving update for Thursday, 19 Nov',exact:true}).click();
    await expect.poll(async()=>{const record=(await(await f.request('member',path)).json()),id=record.plans.at(-1)?.goals[1].id;return record.updates.find((update:{date:string})=>update.date==='2026-11-19')?.goalStatuses.find((flag:{goalId:string})=>flag.goalId===id)?.status;}).toBe('blocked');
    await page.getByRole('tab',{name:'Updates',exact:true}).click();await expect(page.getByRole('textbox',{name:'Daily update',exact:true})).toHaveValue('');
  } finally {await browser.close();await vite.close();await f.close();}
});

for (const view of ['Updates','Goals']) test(`retained retry preserves a status explicitly reselected in ${view} while saving`, async () => {
  const f=await coachingFixture(),path='/api/weeks/2026-11-16';
  const saved=await(await f.request('member',path+'/plans','POST',{version:0,goals:[{text:'Keep working',links:[]}]})).json();
  const goalId=saved.plans[0].goals[0].id;
  await f.request('member',path+'/updates','POST',{date:'2026-11-19',body:'Saved note',planVersion:1,goalStatuses:[{goalId,status:'on-track'}]});
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  try {
    const context=await browser.newContext({timezoneId:'Pacific/Auckland'});await context.clock.install({time:new Date('2026-11-19T23:59:00+13:00')});
    await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);await page.goto(f.origin+'/?page=week');
    await context.clock.pauseAt(new Date('2026-11-19T23:59:59.700+13:00'));
    await page.getByRole('group',{name:'Status for Keep working',exact:true}).getByRole('radio',{name:'Blocked',exact:true}).check();
    await context.clock.fastForward(400);
    const retained=page.getByRole('region',{name:'Unsaved previous updates',exact:true});await expect(retained).toContainText('Keep working: Blocked');
    await page.getByRole('tab',{name:view,exact:true}).click();
    let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});
    await page.route('**/api/weeks/*/updates',async route=>{started();await held;await route.continue();});
    await retained.getByRole('button',{name:'Retry saving update for Thursday, 19 Nov',exact:true}).click();await pending;
    const status=page.getByRole('group',{name:'Status for Keep working',exact:true});
    await status.getByRole('radio',{name:'At risk',exact:true}).check();
    await status.getByRole('radio',{name:'On track',exact:true}).check();
    release();await expect(retained).toHaveCount(0);
    await expect(status.getByRole('radio',{name:'On track',exact:true})).toBeChecked();
    await context.clock.fastForward(1000);
    await expect.poll(async()=>(await(await f.request('member',path)).json()).updates.find((update:{date:string})=>update.date==='2026-11-20')?.goalStatuses[0]?.status).toBe('on-track');
  } finally {release();await browser.close();await vite.close();await f.close();}
});
