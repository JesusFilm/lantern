import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';

test('browser titles follow direct pages, navigation and history',async()=>{
  const f=await coachingFixture();
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'lead',url:f.origin}]);
    const page=await context.newPage();
    for(const [route,label] of [['focuses','Position focuses'],['week','My week'],['team','My team'],['guide','Guide'],['account','Account'],['department','Department'],['reviews','Review requests']]){
      await page.goto(f.origin+'/?page='+route);await expect(page).toHaveTitle(label+' — Lantern');
    }
    await page.getByRole('link',{name:'My week',exact:true}).click();await expect(page).toHaveTitle('My week — Lantern');
    await page.getByRole('link',{name:'My team',exact:true}).click();await expect(page).toHaveTitle('My team — Lantern');
    await page.goBack();await expect(page).toHaveTitle('My week — Lantern');
    await page.goForward();await expect(page).toHaveTitle('My team — Lantern');
    await expect(page.getByRole('link',{name:'TV dashboard',exact:true})).toHaveCount(0);
  }finally{await browser.close();await vite.close();await f.close();}
});
