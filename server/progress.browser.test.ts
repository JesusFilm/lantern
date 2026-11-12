import {resolveFeatureConfig} from './features.js';
import {chromium,expect} from '@playwright/test';
import {createServer as viteServer} from 'vite';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {privilegeFixture} from './privilege-test-support.js';
import {migrate} from './schema.js';
import {createApp} from './app.js';
import {hash} from './access.js';

test('member records status and goal note; lead reads progress after reload', {timeout:45000},async()=>{
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
  const mc=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),lc=await browser.newContext();
  await mc.addCookies([{name:'lantern-session',value:member,url:origin}]);await lc.addCookies([{name:'lantern-session',value:lead,url:origin}]);
  const created=await mc.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:{title:'Annual focus',start:'2026-01-01',end:'2026-12-31',sections:[{kind:'normal',objective:'Help onboarding',goals:['Publish a guide']},{kind:'normal',objective:'Improve support',goals:['Update support notes']}]}});const focus=await created.json();
  assert.equal((await lc.request.post(`${origin}/api/department/members/${member}/focuses/${focus.id}/confirm`,{headers:{Origin:origin},data:{version:1}})).status(),200);
  const page=await mc.newPage();
  await page.route('**/api/focuses/*/progress',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Progress temporarily unavailable.'})}));
  await page.goto(`${origin}/?page=focuses&focus=${focus.id}`);
  await expect(page.getByRole('alert')).toContainText('Progress temporarily unavailable.');
  await page.unroute('**/api/focuses/*/progress');await page.getByRole('button',{name:'Try again'}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Focus',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Progress & notes'})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'Progress & notes'}).click();
  await expect(page.getByRole('button',{name:'Progress & notes'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Focus',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByText('Track progress and add notes to each objective or SMART goal.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Notes',exact:true})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Objective 1'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Objective 2'})).toBeHidden();
  await page.getByRole('button',{name:'Next objective'}).click();
  await expect(page.getByRole('region',{name:'Objective 2'})).toBeVisible();
  await page.getByLabel('Read progress objectives').selectOption('all');
  await expect(page.getByRole('region',{name:'Objective 1'})).toBeVisible();
  await expect(page.getByRole('region',{name:'Objective 2'})).toBeVisible();
  await page.getByLabel('Read progress objectives').selectOption('0');
  const touch=await mc.newCDPSession(page), heading=page.getByRole('heading',{name:'Help onboarding'});
  await heading.scrollIntoViewIfNeeded();const box=await heading.boundingBox();assert.ok(box);
  const y=box.y+box.height/2;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.getByRole('region',{name:'Objective 2'})).toBeVisible();
  await page.getByRole('button',{name:'Previous objective'}).click();
  await expect(page.getByRole('region',{name:'Objective 1'})).toBeVisible();
  const goal=page.getByRole('region',{name:'Objective 1'}).getByRole('region',{name:'SMART goal 1'});
  await expect(goal.getByText('Publish a guide',{exact:true})).toBeVisible();
  await expect(goal.locator('.progress-pill')).toHaveCount(0);
  await goal.getByRole('button',{name:'Add note'}).click();
  await page.getByLabel('Status',{exact:true}).selectOption('achieved');
  await page.getByLabel('Progress note').fill('Published the guide.');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(goal.getByRole('button',{name:'Edit progress'})).toBeVisible();
  await expect(page.getByText('Track progress and add notes to each objective or SMART goal.')).toHaveCount(0);
  await page.getByRole('button',{name:'Focus',exact:true}).click();await expect(page.getByText('Achieved',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Progress & notes'}).click();await expect(page.getByText('Published the guide.')).toBeVisible();await expect(page.getByText('Achieved',{exact:true})).toBeVisible();
  const snapshot=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  const currentStatus=snapshot.statuses.find((x:{goal:number|null})=>x.goal===0),currentNote=snapshot.notes.find((x:{goal:number|null})=>x.goal===0);
  await goal.getByRole('button',{name:'Edit progress'}).click();await page.getByLabel('Progress note').fill('My unsaved update');
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:0,status:'needs-attention',body:'Another window update',revision:currentStatus.revision,noteRevision:currentNote.revision}})).status(),200);
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByRole('alert')).toContainText('changed in another window');
  await expect(page.getByLabel('Progress note')).toHaveValue('My unsaved update');
  await expect(page.getByText('Another window update')).toBeVisible();
  await page.getByRole('button',{name:'Use latest version'}).click();
  await expect(page.getByLabel('Status',{exact:true})).toHaveValue('needs-attention');
  await page.getByLabel('Progress note').fill('My unsaved update\n'+('Long progress detail\n'.repeat(25)));await page.getByRole('button',{name:'Save progress'}).click();
  await expect(page.getByText('My unsaved update')).toBeVisible();
  const noteClearsPager=async()=>{
   await page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');
   const note=await page.getByText('My unsaved update').boundingBox(),pager=await page.getByRole('navigation',{name:'Objective navigation'}).boundingBox();
   return !!note&&!!pager&&note.y+note.height<=pager.y;
  };
  await page.setViewportSize({width:390,height:500});
  await expect.poll(noteClearsPager,{message:'the fixed pager must not cover the last note'}).toBe(true);
  await page.setViewportSize({width:740,height:390});await expect(page.getByRole('navigation',{name:'Objective navigation'})).toBeVisible();
  await expect.poll(noteClearsPager,{message:'landscape pager must not cover the last note'}).toBe(true);
  await page.setViewportSize({width:390,height:844});
  const beforeStatusEdit=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  const currentStatusForEdit=beforeStatusEdit.statuses.find((x:{goal:number|null})=>x.goal===0),currentNoteForEdit=beforeStatusEdit.notes.find((x:{goal:number|null})=>x.goal===0);
  await goal.getByRole('button',{name:'Edit progress'}).click();await page.getByLabel('Status',{exact:true}).selectOption('achieved');
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:0,status:'needs-attention',body:'Latest remote note',revision:currentStatusForEdit.revision,noteRevision:currentNoteForEdit.revision}})).status(),200);
  await page.getByRole('button',{name:'Save progress'}).click();await expect(page.getByRole('alert')).toContainText('changed in another window');
  await page.getByRole('button',{name:'Use latest version'}).click();await expect(page.getByLabel('Progress note')).toHaveValue('Latest remote note');await expect(page.getByLabel('Status',{exact:true})).toHaveValue('achieved');
  await page.getByRole('button',{name:'Save progress'}).click();await expect(goal.getByText('Latest remote note')).toBeVisible();
  const beforeCancel=await (await mc.request.get(`${origin}/api/focuses/${focus.id}/progress`)).json();
  const statusBeforeCancel=beforeCancel.statuses.find((x:{goal:number|null})=>x.goal===0),noteBeforeCancel=beforeCancel.notes.find((x:{goal:number|null})=>x.goal===0);
  await goal.getByRole('button',{name:'Edit progress'}).click();await page.getByLabel('Progress note').fill('Discard this edit');
  assert.equal((await mc.request.put(`${origin}/api/focuses/${focus.id}/progress-entry`,{headers:{Origin:origin},data:{section:0,goal:0,status:'in-progress',body:'Latest saved after cancel',revision:statusBeforeCancel.revision,noteRevision:noteBeforeCancel.revision}})).status(),200);
  await page.getByRole('button',{name:'Save progress'}).click();await expect(page.getByRole('alert')).toContainText('changed in another window');
  await page.getByRole('button',{name:'Cancel'}).click();await expect(page.getByText('Latest saved after cancel')).toBeVisible();
  await goal.getByRole('button',{name:'Edit progress'}).click();await page.getByLabel('Status',{exact:true}).selectOption('');await page.getByLabel('Progress note').fill('');await page.getByRole('button',{name:'Save progress'}).click();
  await expect(goal.locator('.progress-pill')).toHaveCount(0);await expect(goal.getByRole('button',{name:'Add note'})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Progress & notes'}).click();await expect(goal.getByRole('button',{name:'Add note'})).toBeVisible();await expect(goal.locator('.progress-pill')).toHaveCount(0);
  await goal.getByRole('button',{name:'Add note'}).click();await page.getByLabel('Progress note').fill('Published the guide.');await page.getByRole('button',{name:'Save progress'}).click();
  await expect(goal.locator('.progress-pill')).toHaveCount(0);await expect(goal.getByRole('button',{name:'Edit progress'})).toBeVisible();
  const leadPage=await lc.newPage();const duplicateKeyErrors:string[]=[];leadPage.on('console', message=>{if(message.type()==='error' && message.text().includes('same key')) duplicateKeyErrors.push(message.text())});await leadPage.goto(`${origin}/?page=department&member=${member}&memberFocus=${focus.id}`);await leadPage.getByRole('button',{name:'Progress & notes'}).click();await expect(leadPage.getByText('Published the guide.')).toBeVisible();await expect(leadPage.getByRole('button',{name:'Add note'})).toHaveCount(0);assert.deepEqual(duplicateKeyErrors,[],'rendering the lead view must not duplicate React keys');
 } finally {await browser.close();await vite?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();}
});

test('hidden progress leaves member and lead focus views unchanged', {timeout:45000}, async()=>{
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
  const app=createApp(f.runtime,{origin});vite=await viteServer({server:{middlewareMode:{server},hmr:{server}},appType:'spa'});app.use(vite.middlewares);server.on('request',app);
  const mc=await browser.newContext(),lc=await browser.newContext();await mc.addCookies([{name:'lantern-session',value:member,url:origin}]);await lc.addCookies([{name:'lantern-session',value:lead,url:origin}]);
  const response=await mc.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:{title:'Annual focus',start:'2026-01-01',end:'2026-12-31',sections:[{kind:'normal',objective:'Help onboarding',goals:['Publish a guide']}]}});const focus=await response.json();
  assert.equal((await lc.request.post(`${origin}/api/department/members/${member}/focuses/${focus.id}/confirm`,{headers:{Origin:origin},data:{version:1}})).status(),200);
  const page=await mc.newPage();await page.goto(`${origin}/?page=focuses&focus=${focus.id}`);await expect(page.getByText('Help onboarding',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Progress & notes'})).toHaveCount(0);
  const leadPage=await lc.newPage();await leadPage.goto(`${origin}/?page=department&member=${member}&memberFocus=${focus.id}`);await expect(leadPage.getByText('Help onboarding',{exact:true})).toBeVisible();await expect(leadPage.getByRole('button',{name:'Progress & notes'})).toHaveCount(0);
 } finally {await browser.close();await vite?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();}
});
