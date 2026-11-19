import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture } from "./coach-test-support.js";
import { resolveFeatureConfig } from "./features.js";

test("sidebar collapse survives reload and navigation, expands again, and stays local to this browser", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: { server: f.server }, hmr: { server: f.server } },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    page.setDefaultTimeout(3000);
    await page.goto(f.origin);
    const sidebar = page.getByRole("complementary");
    const toggle = page.getByRole("button", { name: "Collapse sidebar", exact: true });
    await expect(toggle).toBeVisible();
    const toggleBox = (await toggle.boundingBox())!;
    const navBox = (await page.getByRole("navigation", { name: "Main navigation" }).boundingBox())!;
    const userBox = (await sidebar.getByText("lead", { exact: true }).boundingBox())!;
    assert.ok(toggleBox.y > navBox.y + navBox.height && toggleBox.y + toggleBox.height <= userBox.y, "sidebar toggle sits below navigation and above the user profile");
    const expanded = await sidebar.boundingBox();
    const icon = page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Guide", exact: true }).locator("svg");
    const iconBefore = (await icon.boundingBox())!;
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toHaveAttribute("aria-expanded", "false");
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(expanded!.width);
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(76);
    const iconCollapsed = (await icon.boundingBox())!;
    const rail = (await sidebar.boundingBox())!;
    const railCenter = rail.x + rail.width / 2;
    for (const item of [sidebar.locator('.brand img'), ...await sidebar.locator('nav button svg').all(), sidebar.locator('.sidebar-toggle svg'), sidebar.locator('.sidebar-avatar')]) {
      const box = (await item.boundingBox())!;
      assert.ok(Math.abs(box.x + box.width / 2 - railCenter) <= 0.5, 'collapsed logo, navigation, toggle and avatar share the rail centre');
    }
    assert.equal(iconCollapsed.x, iconBefore.x, "navigation icon stays anchored while collapsing");
    assert.equal(iconCollapsed.y, iconBefore.y);
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Guide", exact: true }).click();
    await expect(page).toHaveURL(/page=guide/);
    await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
    for (const name of ["Position focuses", "Review requests", "Guide", "Account", "Department"]) {
      await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    const fresh = await browser.newContext();
    await fresh.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
    const other = await fresh.newPage();
    await other.goto(f.origin);
    await expect(other.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
    await expect(other.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Department", exact: true })).toHaveCount(0);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("hidden sidebar collapse keeps labelled navigation expanded despite a saved preference", async () => {
  const f = await coachingFixture(undefined, resolveFeatureConfig({ LANTERN_FEATURES: "sidebar-collapse=off" }, "local"));
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
    await context.addInitScript(() => localStorage.setItem("lantern-sidebar", "collapsed"));
    const page = await context.newPage();
    await page.goto(f.origin);
    await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Collapse|Expand) sidebar$/ })).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByText("Position focuses", { exact: true })).toBeVisible();
    await nav.getByRole("link", { name: "Guide", exact: true }).click();
    await expect(page).toHaveURL(/page=guide/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Open menu", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Account", exact: true })).toBeVisible();
  } finally {
    await browser.close(); await vite.close(); await f.close();
  }
});

test("sidebar remains usable without storage and across narrow phone and landscape layouts", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    await context.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
      Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "QuotaExceededError"); };
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(f.origin);
    const menu = page.getByRole("button", { name: "Open menu", exact: true });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
    await menu.click();
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      for (const name of ["Position focuses", "Review requests", "Guide", "Account", "Department"]) {
        const button = nav.getByRole("link", { name, exact: true });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport();
        const box = await button.boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44, "icon controls remain touch sized");
      }
      assert.equal(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    }
    await nav.getByRole("link", { name: "Account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Menu", exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await expect(nav.getByText("Account", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await menu.click();
    await page.getByRole("button", { name: "Close menu", exact: true }).click();
    await expect(menu).toBeFocused();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); await vite.close(); await f.close();
  }
});

test('sidebar uses real links, keeps normal navigation guarded and supports opening a new tab',async()=>{
  const f=await coachingFixture();
  const vite=await createServer({server:{middlewareMode:{server:f.server},hmr:{server:f.server}},appType:'spa'});f.app.use(vite.middlewares);
  const browser=await chromium.launch();
  try {
    const context=await browser.newContext();await context.addCookies([{name:'lantern-session',value:'member',url:f.origin}]);
    const page=await context.newPage();await page.goto(f.origin+'/?page=week&week=2026-11-09&member=old&memberFocus=old');
    const nav=page.getByRole('navigation',{name:'Main navigation'}),team=nav.getByRole('link',{name:'My team',exact:true});
    await expect(team).toHaveAttribute('href',/page=team/);
    const href=await team.getAttribute('href');assert.ok(href&&!href.includes('member='));
    const popupPromise=context.waitForEvent('page');await team.click({button:'middle'});const popup=await popupPromise;
    await expect(popup).toHaveTitle('My team — Lantern');await expect(page).toHaveTitle('My week — Lantern');await popup.close();
    await page.evaluate("window.addEventListener('lantern-coach-leave',event=>event.preventDefault(),{once:true})");
    await team.click();await expect(page).toHaveTitle('My week — Lantern');
    await team.click();await expect(page).toHaveTitle('My team — Lantern');
    await expect(nav.getByRole('link',{name:'My team',exact:true})).toHaveAttribute('aria-current','page');
    await nav.getByRole('link',{name:'My week',exact:true}).click();await expect(page).not.toHaveURL(/week=2026-11-09/);
    await nav.getByRole('link',{name:'Account',exact:true}).focus();await page.keyboard.press('Enter');await expect(page).toHaveTitle('Account — Lantern');
  }finally{await browser.close();await vite.close();await f.close();}
});
