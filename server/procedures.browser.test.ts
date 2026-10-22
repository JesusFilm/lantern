import { chromium, expect } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { privilegeFixture } from "./privilege-test-support.js";
import { migrate } from "./schema.js";
import { createApp } from "./app.js";
import { hash } from "./access.js";

test("Guide Procedures uses the existing topic accordion and keeps visual guidance concise", { timeout: 90000 }, async () => {
  const f = await privilegeFixture(), server = createServer(), browser = await chromium.launch();
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  try {
    await migrate(f.migration, f.roles);
    const lead = randomUUID(), member = randomUUID(), team = randomUUID();
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Media team')", [team]);
    for (const [id, name, role] of [[lead, "Career Lead", "career-lead"], [member, "Member", "member"]]) {
      await f.admin.query("INSERT INTO users VALUES($1::uuid,$1::text,$2,$3)", [id, `${id}@example.test`, name]);
      await f.admin.query("INSERT INTO approved_emails VALUES($1)", [`${id}@example.test`]);
      await f.admin.query("INSERT INTO memberships VALUES($1,$2,$3,NULL)", [id, team, role]);
      await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')", [hash(id!), id]);
    }
    await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const app = createApp(f.runtime, { origin });
    vite = await createViteServer({ server: { middlewareMode: { server }, hmr: { server } }, appType: "spa" });
    app.use(vite.middlewares); server.on("request", app);
    const leadContext = await browser.newContext(), memberContext = await browser.newContext();
    await leadContext.addCookies([{ name: "lantern-session", value: lead, url: origin }]);
    await memberContext.addCookies([{ name: "lantern-session", value: member, url: origin }]);
    const leadPage = await leadContext.newPage(), memberPage = await memberContext.newPage();
    leadPage.setDefaultTimeout(5000); memberPage.setDefaultTimeout(5000);
    await memberPage.goto(origin + '/?page=guide');
    const procedures = memberPage.getByRole('button', { name: 'Procedures', exact: true });
    await expect(procedures).toHaveAttribute('aria-expanded', 'false');
    await procedures.click();
    await expect(procedures).toHaveAttribute('aria-expanded', 'true');
    const navigation = memberPage.getByLabel('Steps within Procedures');
    await expect(navigation.getByRole('button')).toHaveCount(3);
    await expect(navigation.getByRole('button', {name: 'The year', exact: true})).toHaveAttribute('aria-current', 'step');
    await expect(memberPage.getByRole('img', {name: 'Position Focus annual cycle'})).toBeVisible();
    await expect(memberPage.getByText('Focus 01 · Jan–Jun', {exact:true})).toBeVisible();
    await expect(memberPage.getByText('Focus 02 · Jul–Dec', {exact:true})).toBeVisible();
    for (const text of ['Two focuses.', 'One year.', 'Keep moving. Keep talking.', 'Writing guide', 'Amend together, anytime.', 'Illustrative annual rhythm']) {
      await expect(memberPage.getByText(text, {exact:true})).toHaveCount(0);
    }
    await navigation.getByRole('button', {name:'Agree a focus', exact:true}).click();
    await expect(memberPage.getByRole('heading', {name:'Start each half together.'})).toBeFocused();
    await expect(memberPage.getByRole('list', {name:'Agree a focus'}).getByRole('listitem')).toHaveCount(4);
    await expect(memberPage.getByText('One agreed focus for the next six months.', {exact:true})).toHaveCount(0);
    await navigation.getByRole('button', {name:'Make a change',exact:true}).click();
    await expect(memberPage.getByRole('heading', {name:'Priorities change. Your focus can too.'})).toBeFocused();
    await expect(memberPage.getByRole('list', {name:'Make a change'})).toContainText('Unlock revisionCareer lead');
    await expect(memberPage.getByText('Keep the agreed version until the revision is confirmed.', {exact:true})).toHaveCount(0);
    await expect(memberPage.getByRole('button', {name:'Next layout'})).toHaveCount(0);
    await memberPage.getByRole('button',{name:'Objectives',exact:true}).click();
    await expect(procedures).toHaveAttribute('aria-expanded','false');
    await expect(navigation).toHaveCount(0);
    await expect(memberPage.getByRole('heading',{name:'What makes a useful objective?'})).toBeVisible();
    await memberPage.setViewportSize({width:390,height:844});
    await procedures.click();
    for (const label of ['The year','Agree a focus','Make a change']) {
      await navigation.getByRole('button',{name:label,exact:true}).click();
      await expect(navigation.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','step');
      assert.ok(await memberPage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"));
    }
    const phoneContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await phoneContext.addCookies([{ name: "lantern-session", value: member, url: origin }]);
    const phone = await phoneContext.newPage();
    await phone.goto(origin + '/?page=guide');
    await phone.getByRole('button', {name:'Procedures',exact:true}).click();
    const phoneNavigation = phone.getByLabel('Steps within Procedures');
    const yearPanel = await phone.getByRole('img',{name:'Position Focus annual cycle'}).boundingBox();
    const yearNavigationEnd = await phoneNavigation.getByRole('button',{name:'Make a change',exact:true}).boundingBox();
    assert.ok(yearPanel && yearNavigationEnd && yearNavigationEnd.y + yearNavigationEnd.height <= yearPanel.y, 'landscape navigation must stay above the year circle');
    await phoneNavigation.getByRole('button',{name:'Make a change',exact:true}).click();
    const lastStep = await phoneNavigation.getByRole('button',{name:'Make a change',exact:true}).boundingBox();
    const panel = await phone.getByRole('list',{name:'Make a change'}).locator('..').boundingBox();
    assert.ok(lastStep && panel && lastStep.y + lastStep.height <= panel.y, 'landscape procedure navigation must not overlap content');
    await phone.setViewportSize({width:320,height:568});
    await phoneNavigation.getByRole('button',{name:'Agree a focus',exact:true}).click();
    await expect(phone.getByText('Draft',{exact:true})).toBeInViewport();
    await phoneNavigation.getByRole('button',{name:'Make a change',exact:true}).click();
    await expect(phone.getByText('Unlock revision',{exact:true})).toBeInViewport();
    await phoneNavigation.getByRole('button',{name:'The year',exact:true}).click();
    await expect(phone.getByRole('img',{name:'Position Focus annual cycle'})).toBeInViewport();
    const january = await phone.getByRole('listitem').filter({hasText:'JAN'}).boundingBox();
    const december = await phone.getByRole('listitem').filter({hasText:'DEC'}).boundingBox();
    assert.ok(january && december && december.x + december.width < january.x, 'year milestone labels must not overlap');
    await phone.setViewportSize({width:901,height:900});
    const narrowJanuary = await phone.getByRole('listitem').filter({hasText:'JAN'}).boundingBox();
    const narrowDecember = await phone.getByRole('listitem').filter({hasText:'DEC'}).boundingBox();
    assert.ok(narrowJanuary && narrowDecember && narrowDecember.x + narrowDecember.width < narrowJanuary.x, 'narrow desktop milestone labels must not overlap');
    await phoneContext.close();
    await leadPage.goto(origin + '/?page=guide');
    await leadPage.getByRole('button',{name:'Procedures',exact:true}).click();
    await expect(leadPage.getByRole('img',{name:'Position Focus annual cycle'})).toBeVisible();

  } finally {
    await browser.close(); await vite?.close(); server.closeAllConnections();
    await new Promise<void>(r => server.close(() => r())); await f.close();
  }
});
