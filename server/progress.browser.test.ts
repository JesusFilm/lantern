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
  const app=createApp(f.runtime,{origin});vite=await viteServer({server:{middlewareMode:{server},hmr:{server}},appType:'spa'});app.use(vite.middlewares);server.on('request',app);
  const mc=await browser.newContext({viewport:{width:390,height:844}}),lc=await browser.newContext();
  await mc.addCookies([{name:'lantern-session',value:member,url:origin}]);await lc.addCookies([{name:'lantern-session',value:lead,url:origin}]);
  const created=await mc.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:{title:'Annual focus',start:'2026-01-01',end:'2026-12-31',sections:[{kind:'normal',objective:'Help onboarding',goals:['Publish a guide']}]}});const focus=await created.json();
  assert.equal((await lc.request.post(`${origin}/api/department/members/${member}/focuses/${focus.id}/confirm`,{headers:{Origin:origin},data:{version:1}})).status(),200);
  const page=await mc.newPage();await page.goto(`${origin}/?page=focuses&focus=${focus.id}`);await page.getByRole('button',{name:'Progress & notes'}).click();
  await expect(page.getByText('Track progress and add notes to each objective or SMART goal.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Notes',exact:true})).toHaveCount(0);
  const goal=page.getByRole('region',{name:'Objective 1'}).getByRole('region',{name:'SMART goal 1'});
  await expect(goal.locator('.progress-pill')).toHaveCount(0);
  await goal.getByRole('button',{name:'Add note'}).click();
  await page.getByLabel('Status',{exact:true}).selectOption('achieved');
  await page.getByLabel('Progress note').fill('Published the guide.');
  await page.getByRole('button',{name:'Save progress'}).click();
  await expect(goal.getByRole('button',{name:'Edit progress'})).toBeVisible();
  await expect(page.getByText('Track progress and add notes to each objective or SMART goal.')).toHaveCount(0);
  await page.getByRole('button',{name:'Focus',exact:true}).click();await expect(page.getByText('Achieved',{exact:true})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Progress & notes'}).click();await expect(page.getByText('Published the guide.')).toBeVisible();await expect(page.getByText('Achieved',{exact:true})).toBeVisible();
  await goal.getByRole('button',{name:'Edit progress'}).click();await page.getByLabel('Status',{exact:true}).selectOption('');await page.getByLabel('Progress note').fill('');await page.getByRole('button',{name:'Save progress'}).click();
  await expect(goal.locator('.progress-pill')).toHaveCount(0);await expect(goal.getByRole('button',{name:'Add note'})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Progress & notes'}).click();await expect(goal.getByRole('button',{name:'Add note'})).toBeVisible();await expect(goal.locator('.progress-pill')).toHaveCount(0);
  await goal.getByRole('button',{name:'Add note'}).click();await page.getByLabel('Progress note').fill('Published the guide.');await page.getByRole('button',{name:'Save progress'}).click();
  await expect(goal.locator('.progress-pill')).toHaveCount(0);await expect(goal.getByRole('button',{name:'Edit progress'})).toBeVisible();
  const leadPage=await lc.newPage();await leadPage.goto(`${origin}/?page=department&member=${member}&memberFocus=${focus.id}`);await leadPage.getByRole('button',{name:'Progress & notes'}).click();await expect(leadPage.getByText('Published the guide.')).toBeVisible();await expect(leadPage.getByRole('button',{name:'Add note'})).toHaveCount(0);
 } finally {await browser.close();await vite?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();}
});
