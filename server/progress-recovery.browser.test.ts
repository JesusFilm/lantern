import {resolveFeatureConfig} from './features.js';
import {chromium,expect,type Page,type BrowserContext} from '@playwright/test';
import {createServer as viteServer} from 'vite';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {privilegeFixture} from './privilege-test-support.js';
import {migrate} from './schema.js';
import {createApp} from './app.js';
import {hash} from './access.js';

import type {PositionFocus} from '../shared/focus.js';

async function withProgress(run:(page:Page,member:BrowserContext,origin:string,focus:PositionFocus,events:unknown[])=>Promise<void>) {
 const events:unknown[]=[];
 const f=await privilegeFixture(),server=createServer(),browser=await chromium.launch(); let vite:Awaited<ReturnType<typeof viteServer>>|undefined;
 try {
  await migrate(f.migration,f.roles);const lead=randomUUID(),member=randomUUID(),team=randomUUID();
  await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Team')",[team]);
  for(const [id,role] of [[lead,'career-lead'],[member,'member']]){
   await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1::uuid,$1::text,$2,$3)",[id,`${id}@example.test`,role]);
   await f.admin.query('INSERT INTO approved_emails VALUES($1)',[`${id}@example.test`]);
   await f.admin.query('INSERT INTO memberships VALUES($1,$2,$3,NULL)',[id,team,role]);
   await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')",[hash(id!),id]);
  }
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address!=='string');const origin=`http://127.0.0.1:${address.port}`;
  const app=createApp(f.runtime,{origin,progressLog:event=>events.push(event),features:resolveFeatureConfig({},'local')});vite=await viteServer({server:{middlewareMode:{server},hmr:{server}},appType:'spa'});app.use(vite.middlewares);server.on('request',app);
  const mc=await browser.newContext({viewport:{width:1280,height:900}}),lc=await browser.newContext();
  await mc.addCookies([{name:'lantern-session',value:member,url:origin}]);await lc.addCookies([{name:'lantern-session',value:lead,url:origin}]);
  const created=await mc.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:{title:'Annual focus',start:'2026-01-01',end:'2026-12-31',sections:[{kind:'normal',objective:'Help onboarding',goals:['Publish a guide']}]}});const focus=await created.json() as PositionFocus;
  assert.equal((await mc.request.post(`${origin}/api/coach/focuses/${focus.id}/request`,{headers:{Origin:origin},data:{version:1}})).status(),200);
  assert.equal((await lc.request.post(`${origin}/api/department/members/${member}/focuses/${focus.id}/confirm`,{headers:{Origin:origin},data:{version:1}})).status(),200);
  const page=await mc.newPage();
  await page.goto(`${origin}/?page=focuses&focus=${focus.id}&view=progress`);
  await run(page,mc,origin,focus,events);
 } finally {await browser.close();await vite?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();}
}
test('lost save response reconciles committed progress before another edit', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('started this today');
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   assert.equal((await route.fetch()).status(),200);
   await route.abort('failed');
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('started this today',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit progress'}).first().click();
  await expect(page.getByLabel('Status',{exact:true})).toHaveValue('in-progress');
  await expect(page.getByLabel('Progress note')).toHaveValue('started this today');
  await page.getByLabel('Progress note').fill('started and continued');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('started and continued',{exact:true})).toBeVisible();
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes.length,1);
  assert.equal(saved.notes[0].body,'started and continued');
}));

test('a continuing outage retains input and can be retried', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('started this today');
  await page.route('**/api/focuses/*/progress-entry',route=>route.abort('failed'),{times:2});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved.");
  await expect(page.getByLabel('Status',{exact:true})).toHaveValue('in-progress');
  await expect(page.getByLabel('Progress note')).toHaveValue('started this today');
  const absent=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.deepEqual(absent,{notes:[],statuses:[]});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('started this today',{exact:true})).toBeVisible();
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes.length,1);
  assert.equal(saved.notes[0].body,'started this today');
}));

test('unconfirmed save is checked before retry and Cancel reloads saved progress', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('started this today');
  let writes=0;
  page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/progress-entry'))writes++});
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   assert.equal((await route.fetch()).status(),200);await route.abort('failed');
  },{times:1});
  await page.route('**/api/focuses/*/progress',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved.");
  await expect(page.getByLabel('Progress note')).toHaveValue('started this today');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved.");
  assert.equal(writes,2,'once the original revision is settled, a failed read must not trigger another write');
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('alert')).toContainText('Unavailable');
  await expect(page.getByRole('button',{name:'Add note'})).toHaveCount(0);
  await page.unroute('**/api/focuses/*/progress');
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByText('started this today',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit progress'}).click();
  await expect(page.getByLabel('Progress note')).toHaveValue('started this today');
  await page.getByLabel('Progress note').fill('continued today');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes[0].body,'continued today');
}));

test('recovery preserves a differing saved entry and the member edit without blaming another window', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('My pending note');
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   const committed=await route.fetch();assert.equal(committed.status(),200);
   const entry=await committed.json();
   const newer=await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'Newer saved note',revision:entry.status.revision,noteRevision:entry.note.revision}});
   assert.equal(newer.status(),200);
   await route.abort('failed');
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText('Saved progress differs from your edit.');
  await expect(page.getByRole('alert')).not.toContainText('another window');
  await expect(page.getByLabel('Progress note')).toHaveValue('My pending note');
  await expect(page.getByText('Latest saved note: Newer saved note',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByText('Newer saved note',{exact:true})).toBeVisible();
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes[0].body,'Newer saved note');
  assert.equal(saved.statuses[0].status,'achieved');
}));

for(const committed of [true,false]) {
 test(`retry checks an uncertain ${committed?'committed':'uncommitted'} save before writing`, {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('A retained edit');
  let writes=0;
  page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/progress-entry'))writes++});
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   if(committed)assert.equal((await route.fetch()).status(),200);
   await route.abort('failed');
  },{times:1});
  await page.route('**/api/focuses/*/progress',route=>route.fulfill({status:503,json:{error:'Unavailable'}}),{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved.");
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  assert.equal(writes,2);
  await page.reload();
  await expect(page.getByText('A retained edit',{exact:true})).toBeVisible();
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes.length,1);
  assert.equal(saved.notes[0].body,'A retained edit');
 }));
}

for(const fault of ['server-error','invalid-response','stale-match','clear'] as const) {
 test(`reconciles a SMART goal save after ${fault}`, {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  const goal=page.getByRole('region',{name:'SMART goal 1',exact:true});
  if(fault==='clear') {
   assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:0,status:'achieved',body:'Old note',revision:null,noteRevision:null}})).status(),200);
   await page.reload();await goal.getByRole('button',{name:'Edit progress'}).click();
  } else await goal.getByRole('button',{name:'Add note'}).click();
  const status=fault==='clear'?'':'needs-attention',body=fault==='clear'?'':'  Waiting for feedback  ';
  await page.getByLabel('Status',{exact:true}).selectOption(status);
  await page.getByLabel('Progress note').fill(body);
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   assert.equal((await route.fetch()).status(),200);
   if(fault==='clear')await route.abort('failed');
   else if(fault==='invalid-response')await route.fulfill({status:200,contentType:'application/json',body:'invalid json'});
   else await route.fulfill({status:fault==='stale-match'?409:503,json:{error:'Uncertain response'}});
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  if(fault==='clear') {
   await expect(goal.getByRole('button',{name:'Add note'})).toBeVisible();
   await expect(goal.locator('.progress-pill')).toHaveCount(0);
  } else {
   await expect(goal.getByText('Waiting for feedback',{exact:true})).toBeVisible();
   await expect(goal.getByText('Needs attention',{exact:true})).toBeVisible();
  }
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes.length,1);
  assert.equal(saved.notes[0].body,fault==='clear'?'':'Waiting for feedback');
  assert.equal(saved.statuses[0].status,status||null);
 }));
}

test('a timeout response after a committed save reloads the saved progress', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('Saved before timeout');
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   assert.equal((await route.fetch()).status(),200);
   await route.fulfill({status:408,json:{error:'Request timed out'}});
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Saved before timeout',{exact:true})).toBeVisible();
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes[0].body,'Saved before timeout');
}));

test('a delayed original save cannot commit after recovery has finished', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('Delayed original');
  let original:unknown;
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   original=route.request().postDataJSON();
   await route.abort('failed');
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Delayed original',{exact:true})).toBeVisible();
  const delayed=await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:original});
  assert.equal(delayed.status(),409,'the original stale write must not commit after recovery');
  await expect(page.getByText('Delayed original',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Delayed original',{exact:true})).toBeVisible();
}));

test('Cancel blocks stale progress while both attempts remain uncertain', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('Pending during outage');
  let original:unknown;
  await page.route('**/api/focuses/*/progress-entry',async route=>{
    original ??= route.request().postDataJSON();
    await route.abort('failed');
  });
  await page.route('**/api/focuses/*/progress-fence',route=>route.abort('failed'));
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await expect(page.getByRole('button',{name:'Add note'})).toHaveCount(0);
  const late=await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:original});
  assert.equal(late.status(),200);
  await page.unroute('**/api/focuses/*/progress-entry');await page.unroute('**/api/focuses/*/progress-fence');
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByText('Pending during outage',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit progress'}).click();
  await expect(page.getByLabel('Progress note')).toHaveValue('Pending during outage');
}));

test('an unresolved save survives navigation back to the same focus', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('Pending across navigation');
  let original:unknown;
  await page.route('**/api/focuses/*/progress-entry',async route=>{
    original ??= route.request().postDataJSON();
    await route.abort('failed');
  });
  await page.route('**/api/focuses/*/progress-fence',route=>route.abort('failed'));
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.getByRole('link',{name:'My week'}).click();
  await page.getByRole('link',{name:'Position focuses'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await expect(page.getByRole('button',{name:'Add note'})).toHaveCount(0);
  const late=await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:original});
  assert.equal(late.status(),200);
  await page.unroute('**/api/focuses/*/progress-entry');await page.unroute('**/api/focuses/*/progress-fence');
  await page.getByRole('button',{name:'Try again'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();
  await expect(page.getByText('Pending across navigation',{exact:true})).toBeVisible();
}));


test('progress save records a correlated client outcome without private note text', {timeout:45000},async()=>withProgress(async(page,_mc,_origin,_focus,events)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('This note is private');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>events.length).toBe(3);
  const logged=events as Array<{event:string;operationId:string;phase:string}>;
  assert.deepEqual(logged.map(event=>event.phase).sort(),['committed','response-received','state-update-scheduled']);
  assert.equal(new Set(logged.map(event=>event.operationId)).size,1);
  assert.match(logged[0]!.operationId,/^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(events).includes('This note is private'),false);
}));

test('timeout diagnostics record the status and correlate with the committed save', {timeout:45000},async()=>withProgress(async(page,_mc,_origin,_focus,events)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Timeout diagnostic content');
  await page.route('**/api/focuses/*/progress-entry',async route=>{
    assert.equal((await route.fetch()).status(),200);
    await route.fulfill({status:408,json:{error:'Request timed out'}});
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>events.some(event=>(event as {phase:string}).phase==='response-error')).toBe(true);
  const logged=events as Array<{operationId:string;phase:string;httpStatus?:number}>;
  const committed=logged.find(event=>event.phase==='committed');
  const failure=logged.find(event=>event.phase==='response-error');
  assert.equal(failure?.operationId,committed?.operationId);
  assert.equal(failure?.httpStatus,408);
  assert.equal(JSON.stringify(events).includes('Timeout diagnostic content'),false);
}));

test('navigation during an in-flight save cannot show stale progress after it completes', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus,events)=>{
  await page.getByRole('link',{name:'My week'}).click();
  await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Saved during navigation');
  let release!:()=>void,seen!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve}), requestSeen=new Promise<void>(resolve=>{seen=resolve});
  let delayedStatus=0;
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   seen();await gate;
   const response=await route.fetch();delayedStatus=response.status();await route.fulfill({response});
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await requestSeen;
  await page.goBack();
  await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();
  await expect(page.getByText('Saved during navigation',{exact:true})).toBeVisible();
  release();
  await expect.poll(()=>delayedStatus).toBe(409);
  await expect.poll(()=>events.some(event=>(event as {phase:string}).phase==='view-gone')).toBe(true);
  await page.reload();
  await expect(page.getByText('Saved during navigation',{exact:true})).toBeVisible();
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes[0].body,'Saved during navigation');
}));

test('an unresolved save warns before reloading the browser', {timeout:45000},async()=>withProgress(async(page)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Unsure if saved');
  await page.route('**/api/focuses/*/progress-entry',route=>route.abort('failed'));
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  assert.equal(await page.evaluate("window.dispatchEvent(new Event('beforeunload',{cancelable:true}))"),false);
}));

test('diagnostic delivery failure does not block a successful save', {timeout:45000},async()=>withProgress(async(page)=>{
  await page.route('**/api/progress-diagnostics',route=>route.abort('failed'));
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('A successful save');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('A successful save',{exact:true})).toBeVisible();
}));

test('diagnostics distinguish a malformed response from a failed fetch', {timeout:45000},async()=>withProgress(async(page,_mc,_origin,_focus,events)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Malformed response note');
  await page.route('**/api/focuses/*/progress-entry',async route=>{
    assert.equal((await route.fetch()).status(),200);
    await route.fulfill({status:200,contentType:'application/json',body:'not json'});
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>events.some(event=>(event as {phase:string}).phase==='response-invalid')).toBe(true);
  assert.equal(events.some(event=>(event as {phase:string}).phase==='fetch-failed'),false);
}));

test('a failed diagnostic delivery is retried after the browser reconnects', {timeout:45000},async()=>withProgress(async(page,_mc,_origin,_focus,events)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Offline diagnostic note');
  await page.route('**/api/progress-diagnostics',route=>route.abort('failed'),{times:1});
  await page.route('**/api/focuses/*/progress-entry',route=>route.abort('failed'),{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Offline diagnostic note',{exact:true})).toBeVisible();
  await page.evaluate("window.dispatchEvent(new Event('online'))");
  await expect.poll(()=>events.some(event=>(event as {phase:string}).phase==='fetch-failed')).toBe(true);
  const logged=events as Array<{operationId:string;phase:string}>;
  assert.equal(logged.find(event=>event.phase==='fetch-failed')?.operationId,logged.find(event=>event.phase==='committed')?.operationId);
  assert.equal(JSON.stringify(events).includes('Offline diagnostic note'),false);
}));

test('a conflict with an unavailable refresh cannot expose stale progress after Cancel', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('My pending text');
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'in-progress',body:'Saved elsewhere',revision:null,noteRevision:null}})).status(),200);
  await page.route('**/api/focuses/*/progress',route=>route.fulfill({status:503,json:{error:'Progress unavailable'}}));
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('alert')).toContainText('Progress unavailable');
  await expect(page.getByRole('button',{name:'Add note'})).toHaveCount(0);
  await page.unroute('**/api/focuses/*/progress');
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByText('Saved elsewhere',{exact:true})).toBeVisible();
}));

test('a malformed success response cannot erase the pending save or crash the progress view', {timeout:45000},async()=>withProgress(async(page,_mc,_origin,_focus,events)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Validated response note');
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   assert.equal((await route.fetch()).status(),200);
   await route.fulfill({status:200,json:{}});
  },{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Validated response note',{exact:true})).toBeVisible();
  await expect.poll(()=>events.some(event=>(event as {phase:string}).phase==='response-invalid')).toBe(true);
  await page.reload();
  await expect(page.getByText('Validated response note',{exact:true})).toBeVisible();
}));

test('a malformed retry response does not resolve an uncertain save', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Uncertain malformed retry');
  let original:unknown, attempts=0;
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   original ??= route.request().postDataJSON();attempts++;
   if(attempts===1)await route.abort('failed');else await route.fulfill({status:200,json:{}});
  });
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('button',{name:'Add note',exact:true}).first()).toBeVisible();
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:original})).status(),409);
  await expect(page.getByText('Uncertain malformed retry',{exact:true})).toHaveCount(0);
}));

test('a stalled save reaches recovery without waiting indefinitely', {timeout:45000},async()=>withProgress(async(page)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Save after a stall');
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve});
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   await gate;await route.abort('failed').catch(()=>{});
  },{times:1});
  try {
   await page.getByRole('button',{name:'Save progress'}).click();
   await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:15000});
   await expect(page.getByText('Save after a stall',{exact:true})).toBeVisible();
  } finally {release()}
}));

test('a conflicting save during navigation preserves the member’s pending edit for review', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('link',{name:'My week'}).click();
  await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('My in-flight note');
  let release!:()=>void,seen!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve}),requestSeen=new Promise<void>(resolve=>{seen=resolve});
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   seen();await gate;await route.abort('failed').catch(()=>{});
  },{times:1});
  try {
   await page.getByRole('button',{name:'Save progress'}).click();await requestSeen;
   await page.goBack();
   assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'A different saved note',revision:null,noteRevision:null}})).status(),200);
   await page.getByRole('link',{name:'Position focuses'}).click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await expect(page.getByLabel('Progress note')).toHaveValue('My in-flight note');
   await expect(page.getByText('Latest saved note: A different saved note',{exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Cancel'}).click();
   await page.getByRole('button',{name:'Progress & notes'}).click();
   await expect(page.getByText('A different saved note',{exact:true})).toBeVisible();
  } finally {release()}
}));

test('a temporary session refresh failure preserves unresolved progress for the same member', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Pending during session outage');
  let original:unknown;
  await page.route('**/api/focuses/*/progress-entry',async route=>{original ??=route.request().postDataJSON();await route.abort('failed')});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'Session temporarily unavailable'}}));
  await page.evaluate("window.dispatchEvent(new Event('focus'))");
  await expect(page.getByRole('alert')).toContainText('Session temporarily unavailable');
  await page.unroute('**/api/session');
  await page.evaluate("window.dispatchEvent(new Event('focus'))");
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:original})).status(),200);
  await page.unroute('**/api/focuses/*/progress-entry');
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByText('Pending during session outage',{exact:true})).toBeVisible();
}));

test('a stalled recovery attempt returns control and retains the uncertain edit', {timeout:45000},async()=>withProgress(async(page)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Pending after a recovery stall');
  let release!:()=>void,attempts=0;
  const gate=new Promise<void>(resolve=>{release=resolve});
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   attempts++;
   if(attempts===1)await route.abort('failed');
   else {await gate;await route.abort('failed').catch(()=>{})}
  });
  try {
   await page.getByRole('button',{name:'Save progress'}).click();
   await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved",{timeout:15000});
   await expect(page.getByLabel('Progress note')).toHaveValue('Pending after a recovery stall');
   await expect(page.getByRole('button',{name:'Cancel'})).toBeEnabled();
  } finally {release()}
}));

test('navigation away during a conflicting recovery does not discard the pending edit', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Keep this pending edit');
  let releaseWrite!:()=>void,writeSeen!:()=>void;
  const writeGate=new Promise<void>(resolve=>{releaseWrite=resolve}), firstWrite=new Promise<void>(resolve=>{writeSeen=resolve});
  await page.route('**/api/focuses/*/progress-entry',async route=>{writeSeen();await writeGate;await route.abort('failed').catch(()=>{})},{times:1});
  let releaseRead!:()=>void,readSeen!:()=>void,readDone!:()=>void;
  const readGate=new Promise<void>(resolve=>{releaseRead=resolve}), readStarted=new Promise<void>(resolve=>{readSeen=resolve}), readFinished=new Promise<void>(resolve=>{readDone=resolve});
  try {
   await page.getByRole('button',{name:'Save progress'}).click();await firstWrite;await page.goBack();
   assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'The newer save',revision:null,noteRevision:null}})).status(),200);
   await page.route('**/api/focuses/*/progress',async route=>{
    const response=await route.fetch();readSeen();await readGate;
    try {await route.fulfill({response})}
    catch(error) {assert.match(String(error),/Route is already handled!/)}
    finally {readDone()}
   },{times:1});
   await page.getByRole('link',{name:'Position focuses'}).click();await readStarted;
   await page.goBack();releaseRead();await readFinished;
   await page.unroute('**/api/focuses/*/progress');
   await page.getByRole('link',{name:'Position focuses'}).click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await expect(page.getByLabel('Progress note')).toHaveValue('Keep this pending edit');
   await expect(page.getByText('Latest saved note: The newer save',{exact:true})).toBeVisible();
  } finally {releaseWrite();releaseRead()}
}));

test('an invalid progress read cannot erase an uncertain save', {timeout:45000},async()=>withProgress(async(page)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Saved despite invalid read');
  await page.route('**/api/focuses/*/progress-entry',async route=>{assert.equal((await route.fetch()).status(),200);await route.abort('failed')},{times:1});
  await page.route('**/api/focuses/*/progress',route=>route.fulfill({status:200,json:{}}));
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('alert')).toContainText('saved progress could not be read');
  await expect(page.getByRole('button',{name:'Add note'})).toHaveCount(0);
  await page.unroute('**/api/focuses/*/progress');await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByText('Saved despite invalid read',{exact:true})).toBeVisible();
}));

test('a late rejected response cannot discard a replay that is still in flight', {timeout:45000},async()=>withProgress(async(page,_mc,_origin,_focus,events)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Pending through rejected response');
  let releaseFirst!:()=>void,releaseSecond!:()=>void,seenFirst!:()=>void,seenSecond!:()=>void;
  const gateFirst=new Promise<void>(r=>{releaseFirst=r}),gateSecond=new Promise<void>(r=>{releaseSecond=r});
  const firstSeen=new Promise<void>(r=>{seenFirst=r}),secondSeen=new Promise<void>(r=>{seenSecond=r});
  let count=0,secondStatus=0,allowNewReplay=false;
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   const attempt=++count;
   if(attempt===1){seenFirst();await gateFirst;await route.fulfill({status:429,json:{error:'Too many requests'}}).catch(()=>{});return}
   if(!allowNewReplay){seenSecond();await gateSecond;const response=await route.fetch().catch(()=>undefined);if(response){secondStatus=response.status();await route.fulfill({response}).catch(()=>{})}return}
   await route.fulfill({response:await route.fetch()});
  });
  try {
   await page.getByRole('button',{name:'Save progress'}).click();await firstSeen;
   await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();await secondSeen;
   releaseFirst();
   await expect.poll(()=>events.some(event=>{const x=event as {phase:string;httpStatus?:number};return x.phase==='response-error'&&x.httpStatus===429})).toBe(true);
   await page.goBack();allowNewReplay=true;await page.getByRole('link',{name:'Position focuses'}).click();
   await page.getByRole('button',{name:'Progress & notes'}).click();
   await expect(page.getByText('Pending through rejected response',{exact:true})).toBeVisible();
   releaseSecond();await expect.poll(()=>secondStatus).toBe(409);
  } finally {releaseFirst();releaseSecond()}
}));

test('a failed replay stays uncertain after a late rejected original response', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus,events)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Uncertain replay');
  let releaseFirst!:()=>void,seenFirst!:()=>void,seenReplay!:()=>void,original:unknown;
  const firstGate=new Promise<void>(r=>{releaseFirst=r}),firstSeen=new Promise<void>(r=>{seenFirst=r}),replaySeen=new Promise<void>(r=>{seenReplay=r});
  let attempts=0;
  await page.route('**/api/focuses/*/progress-entry',async route=>{
   original ??=route.request().postDataJSON();
   if(++attempts===1){seenFirst();await firstGate;await route.fulfill({status:429,json:{error:'Too many requests'}}).catch(()=>{});return}
   seenReplay();await route.abort('failed');
  });
  try {
   await page.getByRole('button',{name:'Save progress'}).click();await firstSeen;
   await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();await replaySeen;
   await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
   releaseFirst();
   await expect.poll(()=>events.some(event=>{const x=event as {phase:string;httpStatus?:number};return x.phase==='response-error'&&x.httpStatus===429})).toBe(true);
   await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();
   await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
   assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:original})).status(),200);
   await page.unroute('**/api/focuses/*/progress-entry');await page.getByRole('button',{name:'Try again'}).click();
   await page.getByRole('button',{name:'Progress & notes'}).click();await expect(page.getByText('Uncertain replay',{exact:true})).toBeVisible();
  } finally {releaseFirst()}
}));

test('a recovered conflict remains available after navigating away again', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Keep across repeated navigation');
  let release!:()=>void,seen!:()=>void;const gate=new Promise<void>(r=>{release=r}),started=new Promise<void>(r=>{seen=r});
  await page.route('**/api/focuses/*/progress-entry',async route=>{seen();await gate;await route.abort('failed').catch(()=>{})},{times:1});
  try {
   await page.getByRole('button',{name:'Save progress'}).click();await started;await page.goBack();
   assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'Other saved note',revision:null,noteRevision:null}})).status(),200);
   await page.getByRole('link',{name:'Position focuses'}).click();await expect(page.getByRole('dialog')).toBeVisible();
   await expect(page.getByLabel('Progress note')).toHaveValue('Keep across repeated navigation');
   await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await expect(page.getByLabel('Progress note')).toHaveValue('Keep across repeated navigation');
   await expect(page.getByText('Latest saved note: Other saved note',{exact:true})).toBeVisible();
  } finally {release()}
}));

test('an accepted conflict keeps the revised edit through navigation until saved or cancelled', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('First version of my edit');
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'A newer saved entry',revision:null,noteRevision:null}})).status(),200);
  await page.getByRole('button',{name:'Save progress'}).click();await expect(page.getByRole('alert')).toContainText('Saved progress differs');
  await page.getByRole('button',{name:'Use latest version'}).click();
  await page.getByLabel('Progress note').fill('My revised edit');
  await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Progress note')).toHaveValue('My revised edit');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Progress & notes'}).click();
  await expect(page.getByText('My revised edit',{exact:true})).toBeVisible();
}));

test('an accepted draft asks for review again when saved progress changes during navigation', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('My first draft');
  const first=await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'First saved entry',revision:null,noteRevision:null}});
  assert.equal(first.status(),200);const entry=await first.json();
  await page.getByRole('button',{name:'Save progress'}).click();await page.getByRole('button',{name:'Use latest version'}).click();
  await page.getByLabel('Progress note').fill('My revised draft');await page.goBack();
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'in-progress',body:'Changed again',revision:entry.status.revision,noteRevision:entry.note.revision}})).status(),200);
  await page.getByRole('link',{name:'Position focuses'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Progress note')).toHaveValue('My revised draft');
  await expect(page.getByText('Latest saved note: Changed again',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Use latest version'}).click();
  await expect(page.getByLabel('Status',{exact:true})).toHaveValue('in-progress');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'Progress & notes'}).click();
  await expect(page.getByText('My revised draft',{exact:true})).toBeVisible();
}));

test('Cancel after an uncertain unsent save does not submit it and prevents a late commit', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Do not submit after cancel');
  let original:unknown;
  await page.route('**/api/focuses/*/progress-entry',async route=>{original ??=route.request().postDataJSON();await route.abort('failed')});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't check whether your progress was saved");
  await page.unroute('**/api/focuses/*/progress-entry');
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(page.getByRole('button',{name:'Add note',exact:true}).first()).toBeVisible();
  const saved=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  assert.equal(saved.notes.length,0);
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:original})).status(),409);
  await page.reload();await expect(page.getByText('Do not submit after cancel',{exact:true})).toHaveCount(0);
}));

test('a late successful response cannot discard an active conflict review', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Original saved note');
  let release!:()=>void,seen!:()=>void,committed!: {status:{revision:string};note:{revision:string}};
  const gate=new Promise<void>(r=>{release=r}),started=new Promise<void>(r=>{seen=r});
  await page.route('**/api/focuses/*/progress-entry',async route=>{const response=await route.fetch();assert.equal(response.status(),200);committed=await response.json();seen();await gate;await route.fulfill({response}).catch(()=>{})},{times:1});
  try {
   await page.getByRole('button',{name:'Save progress'}).click();await started;await page.goBack();
   assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'Other later save',revision:committed.status.revision,noteRevision:committed.note.revision}})).status(),200);
   await page.getByRole('link',{name:'Position focuses'}).click();await expect(page.getByRole('dialog')).toBeVisible();
   await page.getByLabel('Progress note').fill('My revised conflict edit');
   release();
   await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();
   await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Progress note')).toHaveValue('My revised conflict edit');
  } finally {release()}
}));

test('edits made during an uncertain save survive navigation', {timeout:45000},async()=>withProgress(async(page)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Originally submitted');
  await page.route('**/api/focuses/*/progress-entry',route=>route.abort('failed'));
  await page.getByRole('button',{name:'Save progress'}).click();await expect(page.getByRole('alert')).toContainText("We couldn't check");
  await page.getByLabel('Progress note').fill('Edited during the outage');await page.goBack();
  await page.unroute('**/api/focuses/*/progress-entry');await page.getByRole('link',{name:'Position focuses'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Progress note')).toHaveValue('Edited during the outage');
  await page.getByRole('button',{name:'Save progress'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Progress & notes'}).click();await expect(page.getByText('Edited during the outage',{exact:true})).toBeVisible();
}));

test('a rejected save does not discard an accepted conflict draft on navigation', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('My edit');
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'Saved elsewhere',revision:null,noteRevision:null}})).status(),200);
  await page.getByRole('button',{name:'Save progress'}).click();await page.getByRole('button',{name:'Use latest version'}).click();
  await page.getByLabel('Progress note').fill('Draft after review');
  await page.route('**/api/focuses/*/progress-entry',route=>route.fulfill({status:400,json:{error:'Please try again later'}}),{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();await expect(page.getByRole('alert')).toContainText('Please try again later');
  await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Progress note')).toHaveValue('Draft after review');
  await page.getByRole('button',{name:'Save progress'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Progress & notes'}).click();await expect(page.getByText('Draft after review',{exact:true})).toBeVisible();
}));

test('a late success during recovery read cannot detach the conflict draft', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus,events)=>{
  await page.getByRole('link',{name:'My week'}).click();await page.getByRole('link',{name:'Position focuses'}).click();
  await page.getByRole('button',{name:'Progress & notes'}).click();await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Progress note').fill('Pending while recovery reads');
  let releaseFirst!:()=>void,seenFirst!:()=>void,releaseRead!:()=>void,seenRead!:()=>void,committed!: {status:{revision:string};note:{revision:string}};
  const firstGate=new Promise<void>(r=>{releaseFirst=r}),firstSeen=new Promise<void>(r=>{seenFirst=r});
  const readGate=new Promise<void>(r=>{releaseRead=r}),readSeen=new Promise<void>(r=>{seenRead=r});
  await page.route('**/api/focuses/*/progress-entry',async route=>{const response=await route.fetch();assert.equal(response.status(),200);committed=await response.json();seenFirst();await firstGate;await route.fulfill({response}).catch(()=>{})},{times:1});
  try {
   await page.getByRole('button',{name:'Save progress'}).click();await firstSeen;await page.goBack();
   assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:null,status:'achieved',body:'Changed before read',revision:committed.status.revision,noteRevision:committed.note.revision}})).status(),200);
   await page.route('**/api/focuses/*/progress',async route=>{seenRead();await readGate;await route.fulfill({response:await route.fetch()}).catch(()=>{})});
   await page.getByRole('link',{name:'Position focuses'}).click();await readSeen;
   releaseFirst();await expect.poll(()=>events.some(event=>(event as {phase:string}).phase==='view-gone')).toBe(true);
   releaseRead();await expect(page.getByRole('dialog')).toBeVisible();
   await page.unroute('**/api/focuses/*/progress');
   await page.getByLabel('Progress note').fill('Revised after recovery');
   await page.goBack();await page.getByRole('link',{name:'Position focuses'}).click();
   await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Progress note')).toHaveValue('Revised after recovery');
  } finally {releaseFirst();releaseRead()}
}));
