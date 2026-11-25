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

async function withProgress(run:(page:Page,member:BrowserContext,origin:string,focus:PositionFocus)=>Promise<void>) {
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
  const app=createApp(f.runtime,{origin,features:resolveFeatureConfig({},'local')});vite=await viteServer({server:{middlewareMode:{server},hmr:{server}},appType:'spa'});app.use(vite.middlewares);server.on('request',app);
  const mc=await browser.newContext({viewport:{width:1280,height:900}}),lc=await browser.newContext();
  await mc.addCookies([{name:'lantern-session',value:member,url:origin}]);await lc.addCookies([{name:'lantern-session',value:lead,url:origin}]);
  const created=await mc.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:{title:'Annual focus',start:'2026-01-01',end:'2026-12-31',sections:[{kind:'normal',objective:'Help onboarding',goals:['Publish a guide']}]}});const focus=await created.json() as PositionFocus;
  assert.equal((await mc.request.post(`${origin}/api/coach/focuses/${focus.id}/request`,{headers:{Origin:origin},data:{version:1}})).status(),200);
  assert.equal((await lc.request.post(`${origin}/api/department/members/${member}/focuses/${focus.id}/confirm`,{headers:{Origin:origin},data:{version:1}})).status(),200);
  const page=await mc.newPage();
  await page.goto(`${origin}/?page=focuses&focus=${focus.id}&view=progress`);
  await run(page,mc,origin,focus);
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

test('save that never reaches the server retains input and can be retried', {timeout:45000},async()=>withProgress(async(page,mc,origin,focus)=>{
  await page.getByRole('button',{name:'Add note',exact:true}).first().click();
  await page.getByLabel('Status',{exact:true}).selectOption('in-progress');
  await page.getByLabel('Progress note').fill('started this today');
  await page.route('**/api/focuses/*/progress-entry',route=>route.abort('failed'),{times:1});
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText("We couldn't save your progress. Your edit is still here. Please try again.");
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
  assert.equal(writes,1,'a retry must check the uncertain save before sending another write');
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
  assert.equal(writes,committed?1:2);
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
