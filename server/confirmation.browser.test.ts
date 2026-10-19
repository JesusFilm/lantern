import {chromium,expect} from '@playwright/test';
import {createServer as createViteServer} from 'vite';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {test} from 'node:test';
import {privilegeFixture} from './privilege-test-support.js';
import {migrate} from './schema.js';
import {createApp} from './app.js';
import {hash} from './access.js';
import type {PositionFocus} from '../shared/focus.js';

test('lead confirms in the browser; stale member edits retain input and the saved baseline becomes read-only', {timeout:45000}, async()=>{
  const f=await privilegeFixture();
  const server=createServer();
  const browser=await chromium.launch();
  let vite:Awaited<ReturnType<typeof createViteServer>>|undefined;
  try {
    await migrate(f.migration,f.roles);
    const lead=randomUUID(),member=randomUUID(),team=randomUUID();
    await f.admin.query("INSERT INTO allowed_domains VALUES('example.test')");
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Team')",[team]);
    for(const [id,name,role] of [[lead,'Lead','career-lead'],[member,'Member','member']]) {
      await f.admin.query("INSERT INTO users VALUES($1::uuid,$1::text,$2,$3,'example.test')",[id,`${id}@example.test`,name]);
      await f.admin.query('INSERT INTO approved_emails VALUES($1)',[`${id}@example.test`]);
      await f.admin.query('INSERT INTO memberships VALUES($1,$2,$3,NULL)',[id,team,role]);
      await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')",[hash(id!),id]);
    }
    await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
    const address=server.address(); assert.ok(address && typeof address!=='string');
    const origin=`http://127.0.0.1:${address.port}`;
    const app=createApp(f.runtime,{origin});
    vite=await createViteServer({server:{middlewareMode:{server},hmr:{server}},appType:'spa'});
    app.use(vite.middlewares);server.on('request',app);
    const memberContext=await browser.newContext(),leadContext=await browser.newContext();
    await memberContext.addCookies([{name:'lantern-session',value:member,url:origin}]);
    await leadContext.addCookies([{name:'lantern-session',value:lead,url:origin}]);
    const memberPage=await memberContext.newPage(), leadPage=await leadContext.newPage();
    memberPage.setDefaultTimeout(5000);leadPage.setDefaultTimeout(5000);
    const draft={title:'Annual agreement',start:'2026-01-01',end:'2026-12-31',sections:[{kind:'normal',objective:'Support onboarding',goals:['Publish a guide by June']}]};
    const response=await memberContext.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:draft});
    assert.equal(response.status(),201);const focus=await response.json() as PositionFocus;
    await memberPage.goto(origin+'/?page=focuses&focus='+focus.id);
    await expect(memberPage.getByRole('button',{name:'Confirm and lock',exact:true})).toHaveCount(0);
    await expect(memberPage.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
    await memberPage.getByRole('button',{name:'Account',exact:true}).click();
    await expect(memberPage.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
    await memberPage.goto(origin+'/?page=focuses&focus='+focus.id);
    await memberPage.getByRole('button',{name:'Edit objective',exact:true}).click();
    await memberPage.getByLabel('Objective',{exact:true}).fill('Unsaved thought to keep');
    await leadPage.goto(origin+'/?page=department&member='+member+'&memberFocus='+focus.id);
    await expect(leadPage.getByRole('heading',{name:'Annual agreement',exact:true})).toBeVisible();
    await expect(leadPage.getByText('Read-only member focus',{exact:true})).toHaveCount(0);
    await expect(leadPage.getByRole('button',{name:'Sign out',exact:true})).toHaveCount(0);
    await leadPage.getByRole('button',{name:'View all position focuses',exact:true}).click();
    await expect(leadPage.getByRole('heading',{name:'Member’s position focuses'})).toBeVisible();
    await leadPage.getByRole('button',{name:'Annual agreement',exact:true}).click();
    await leadPage.getByRole('button',{name:'Confirm and lock',exact:true}).click();
    const dialog=leadPage.getByRole('dialog');
    await expect(dialog).toContainText('Annual agreement');
    await expect(dialog).toContainText('Member');
    await expect(dialog.getByRole('region',{name:'This focus will become read-only.'})).toContainText('It cannot be edited or unlocked here.');
    await expect(dialog.getByText('1 Jan 2026 – 31 Dec 2026',{exact:true})).toBeVisible();
    await leadPage.screenshot({path:'/tmp/lantern-confirm-dialog.png',fullPage:true});
    await leadPage.setViewportSize({width:390,height:844});
    await leadPage.screenshot({path:'/tmp/lantern-confirm-dialog-mobile.png',fullPage:true});
    assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
    await leadPage.setViewportSize({width:1280,height:720});
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(leadPage.getByText('Draft',{exact:true})).toBeVisible();
    await leadPage.getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await dialog.getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await expect(leadPage.getByText(/Confirmed by Lead/)).toBeVisible();
    await memberPage.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();
    await expect(memberPage.getByRole('alert')).toContainText('confirmed and read-only');
    await expect(memberPage.getByLabel('Objective',{exact:true})).toHaveValue('Unsaved thought to keep');
    await memberPage.getByRole('button',{name:'Cancel',exact:true}).click();
    await memberPage.reload();await leadPage.reload();
    for(const page of [memberPage,leadPage]) {
      await expect(page.getByText(/Confirmed by Lead/)).toBeVisible();
      await expect(page.getByText('Support onboarding',{exact:true})).toBeVisible();
      await expect(page.getByText('Publish a guide by June',{exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:/Edit|Remove|Add SMART|Add objective|Confirm and lock/})).toHaveCount(0);
    }
    // Empty/partial drafts remain editable and explain why confirmation is unavailable.
    const partialResponse=await memberContext.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:{...draft,title:'Partial focus',sections:[]}});
    const partial=await partialResponse.json() as PositionFocus;
    await leadPage.goto(origin+'/?page=department&member='+member+'&memberFocus='+partial.id);
    await leadPage.getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await leadPage.getByRole('dialog').getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await expect(leadPage.getByRole('dialog').getByRole('alert')).toContainText('Normal objective');
    await leadPage.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal((await memberContext.request.put(origin+'/api/focuses/'+partial.id,{headers:{Origin:origin},data:{...draft,version:1}})).status(),200);

    // A stale confirmation cannot lock unseen changes; reopen, then retry a storage failure.
    await leadPage.reload();
    await leadPage.getByRole('button',{name:'Confirm and lock',exact:true}).click();
    assert.equal((await memberContext.request.put(origin+'/api/focuses/'+partial.id,{headers:{Origin:origin},data:{...draft,title:'Revised agreement',version:2}})).status(),200);
    await leadPage.getByRole('dialog').getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await expect(leadPage.getByRole('dialog').getByRole('alert')).toContainText('This focus changed');
    await leadPage.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    await leadPage.reload();
    await f.migration.query("ALTER TABLE position_focuses ADD CONSTRAINT synthetic_browser_failure CHECK (title <> 'Revised agreement' OR status='draft')");
    await leadPage.getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await leadPage.getByRole('dialog').getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await expect(leadPage.getByRole('dialog').getByRole('alert')).toContainText('temporarily unavailable');
    await f.migration.query('ALTER TABLE position_focuses DROP CONSTRAINT synthetic_browser_failure');
    await leadPage.getByRole('dialog').getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await expect(leadPage.getByText(/Confirmed by Lead/)).toBeVisible();

    // The lead can also confirm their own focus, then has the same immutable view.
    const ownResponse=await leadContext.request.post(origin+'/api/focuses',{headers:{Origin:origin},data:{...draft,title:'Lead agreement'}});
    const own=await ownResponse.json() as PositionFocus;
    await leadPage.goto(origin+'/?focus='+own.id);
    await leadPage.getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await expect(leadPage.getByRole('dialog')).toContainText('Lead agreement');
    await leadPage.getByRole('dialog').getByRole('button',{name:'Confirm and lock',exact:true}).click();
    await expect(leadPage.getByText(/Confirmed by Lead/)).toBeVisible();
    await expect(leadPage.getByRole('button',{name:/Edit|Remove|Add SMART|Add objective|Confirm and lock/})).toHaveCount(0);
    await leadPage.setViewportSize({width:390,height:844});
    await leadPage.screenshot({path:'/tmp/lantern-confirmed-mobile.png',fullPage:true});
    assert.ok(await leadPage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"));
  } finally {
    await browser.close();await vite?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await f.close();
  }
});
