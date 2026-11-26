import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { coachingFixture } from './coach-test-support.js';

test('weekly and daily navigation use accessible consistent action sizes', async t => {
  const f = await coachingFixture(); t.after(() => f.close());
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'spa' });
  t.after(() => vite.close()); f.app.use(vite.middlewares);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addCookies([{ name: 'lantern-session', value: 'member', url: f.origin }]);
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(f.origin + '/?page=week');
    for (const name of ['Previous week', 'Next week']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible(); const bounds = await button.boundingBox();
      assert.ok(bounds && bounds.height >= 44, `${name} at ${width}px needs a 44px touch target`);
    }
    await page.getByRole('tab',{name:'Goals',exact:true}).click();
    const addBounds=await page.getByRole('button',{name:'Add goal',exact:true}).boundingBox();assert.ok(addBounds && addBounds.height>=44);
    assert.ok(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
    await page.goto(f.origin + '/?page=team');
    const previous = page.getByRole('button', { name: 'Previous day', exact: true });
    await expect(previous).toBeVisible(); const bounds = await previous.boundingBox();
    assert.ok(bounds && bounds.height >= 44);
  }
});

test('primary page headings share a left edge at desktop and phone widths', async t => {
  const f = await coachingFixture(); t.after(() => f.close());
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'spa' });
  t.after(() => vite.close()); f.app.use(vite.middlewares);
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addCookies([{ name: 'lantern-session', value: 'lead', url: f.origin }]);
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  for (const width of [1822, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const left: number[] = [];
    for (const route of ['focuses', 'reviews', 'week', 'team', 'guide', 'department']) {
      await page.goto(f.origin + '/?page=' + route);
      const heading = page.getByRole('heading', { level: 1 }).first();
      await expect(heading).toBeVisible(); const bounds = await heading.boundingBox(); assert.ok(bounds);
      left.push(bounds.x);
    }
    assert.ok(Math.max(...left) - Math.min(...left) <= 2, `page headings at ${width}px: ${left.join(', ')}`);
  }
});

test('dialogs share close controls and link source tabs stay unfilled in dark appearance',async t=>{
 const f=await coachingFixture();t.after(()=>f.close());
 const vite=await createServer({server:{middlewareMode:true,hmr:false},appType:'spa'});t.after(()=>vite.close());f.app.use(vite.middlewares);
 const browser=await chromium.launch();t.after(()=>browser.close());const context=await browser.newContext();
 await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);const page=await context.newPage();page.setDefaultTimeout(5000);
 await page.goto(f.origin+'/?page=week');await page.getByRole('tab',{name:'Goals',exact:true}).click();await page.evaluate("document.documentElement.dataset.theme='dark'");
 await page.getByRole('button',{name:'Actions for goal 1',exact:true}).click();await page.getByRole('menuitem',{name:'Add link',exact:true}).click();
 const tab=page.getByRole('button',{name:'Position focus',exact:true});
 assert.equal(await tab.evaluate(element=>element.ownerDocument.defaultView!.getComputedStyle(element).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.screenshot({path:'/tmp/lantern-sharon-dark-link-dialog.png'});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Actions for goal 1',exact:true}).click();
 await page.getByRole('menuitem',{name:'Edit details',exact:true}).click();await expect(page.getByRole('button',{name:'Close dialog',exact:true})).toBeVisible();
});
