import {test} from 'node:test';
import {chromium,expect} from '@playwright/test';
import {createServer} from 'vite';
import {coachingFixture} from './coach-test-support.js';
import {resolveFeatureConfig} from './features.js';

test('Account creates a one-time team API token and revokes it without exposing it after reload',async()=>{
 const f=await coachingFixture(),vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);const browser=await chromium.launch();
 try{
  const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();
  await page.goto(f.origin+'/?page=account');const panel=page.getByRole('region',{name:'Team API access'});await expect(panel).toBeVisible();
  await panel.getByRole('textbox',{name:'Token name',exact:true}).fill('Office TV');await panel.getByRole('button',{name:'Create token',exact:true}).click();
  const secret=panel.getByRole('textbox',{name:'Bearer token',exact:true});await expect(secret).toHaveValue(/^lantern_tv_/);const token=await secret.inputValue();
  await expect(panel.getByRole('button',{name:'Revoke Office TV',exact:true})).toBeVisible();
  await page.reload();await expect(panel.getByRole('textbox',{name:'Bearer token',exact:true})).toHaveCount(0);await expect(panel.getByRole('button',{name:'Revoke Office TV',exact:true})).toBeVisible();
  const response=await context.request.get(f.origin+'/api/v1/team-updates?date=2026-11-19',{headers:{Authorization:'Bearer '+token}});expect(response.status()).toBe(200);
  await panel.getByRole('button',{name:'Revoke Office TV',exact:true}).click();await expect(panel.getByText('No active tokens.',{exact:true})).toBeVisible();
  expect((await context.request.get(f.origin+'/api/v1/team-updates?date=2026-11-19',{headers:{Authorization:'Bearer '+token}})).status()).toBe(401);
 }finally{await browser.close();await vite.close();await f.close();}
});

test('Account hides team API access when its feature is off',async()=>{
 const f=await coachingFixture(undefined,resolveFeatureConfig({LANTERN_FEATURES:'team-api=off'},'local')),vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);const browser=await chromium.launch();
 try{const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();await page.goto(f.origin+'/?page=account');await expect(page.getByRole('heading',{name:'Account',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Team API access'})).toHaveCount(0);}finally{await browser.close();await vite.close();await f.close();}
});
