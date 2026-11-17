import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, draft } from "./coach-test-support.js";

test("confirmation requires a request for the latest saved version on personal and department screens", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    for (const actor of ["lead", "member"] as const) {
      const created = await f.request(actor, "/api/focuses", "POST", draft);
      assert.equal(created.status, 201);
      const focus = await created.json();
      const routes = [`/?page=department&member=${f.ids[actor]}&memberFocus=${focus.id}`];
      if (actor === "lead") routes.push(`/?focus=${focus.id}`);
      for (const route of routes) {
        await page.goto(f.origin + route);
        await expect(page.getByRole("button", { name: "Confirm and lock", exact: true })).toBeDisabled();
        await expect(page.getByText("Request review of the latest saved version before confirming.", { exact: true })).toBeVisible();
      }
      assert.equal((await f.request(actor, `/api/coach/focuses/${focus.id}/request`, "POST", { version: focus.version })).status, 200);
      for (const route of routes) {
        await page.goto(f.origin + route);
        await expect(page.getByRole("button", { name: "Confirm and lock", exact: true })).toBeEnabled();
      }
      const changed = await f.request(actor, `/api/focuses/${focus.id}`, "PUT", { ...draft, title: "Updated saved focus", version: focus.version });
      assert.equal(changed.status, 200);
      const newer = await changed.json();
      for (const route of routes) {
        await page.goto(f.origin + route);
        await expect(page.getByRole("button", { name: "Confirm and lock", exact: true })).toBeDisabled();
        await expect(page.getByText("This focus has changed since review was requested. Request review of the latest saved version before confirming.", { exact: true })).toBeVisible();
      }
      assert.equal((await f.request(actor, `/api/coach/focuses/${focus.id}/request`, "POST", { version: newer.version })).status, 200);
      await page.reload();
      await expect(page.getByRole("button", { name: "Confirm and lock", exact: true })).toBeEnabled();
    }
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("a lead reviews and confirms their own request without a note or another reviewer", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    for (const actor of ["lead", "member"]) {
      assert.equal((await f.request(actor, "/api/account", "PATCH", { name: "Morgan Lee" })).status, 200);
    }
    const own = await (await f.request("lead", "/api/focuses", "POST", { ...draft, title: "My next half" })).json();
    const other = await (await f.request("member", "/api/focuses", "POST", { ...draft, title: "Member next half" })).json();
    assert.equal((await f.request("member", `/api/coach/focuses/${other.id}/request`, "POST", { version: other.version })).status, 200);
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    await page.goto(f.origin + `/?focus=${own.id}`);
    await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
    await expect(page.getByLabel("Review note · optional")).toBeVisible();
    await expect(page.getByText("Use this opportunity to review your focus again or discuss it with your senior or manager. You can confirm it yourself.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Send request", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirm and lock", exact: true })).toBeEnabled();
    await page.goto(f.origin + "/?page=reviews");
    const ownCard = page.locator("section").filter({ has: page.getByRole("heading", { name: "Your review request · My next half", exact: true }) });
    await expect(ownCard).toBeVisible();
    await expect(page.getByRole("heading", { name: "Morgan Lee · Member next half", exact: true })).toBeVisible();
    await ownCard.getByRole("button", { name: "Review focus", exact: true }).click();
    await expect(page.getByText("Your position focus", { exact: true })).toBeVisible();
    await expect(page.getByLabel("We have discussed and agreed this focus.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm focus", exact: true })).toBeDisabled();
    await page.getByLabel("I have reviewed this focus and am ready to confirm it.").check();
    await page.getByRole("button", { name: "Confirm focus", exact: true }).click();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Your review request · My next half", exact: true }) }).getByText("Confirmed", { exact: true })).toBeVisible();
    const saved = await (await f.request("lead", `/api/coach/focuses/${own.id}`)).json();
    assert.equal(saved.focus.status, "confirmed");
    assert.equal(saved.focus.confirmedBy.id, f.ids.lead);
    assert.equal(saved.requests.length, 1);
    assert.deepEqual(saved.notes, []);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("a failed review request retains its note for retry, and a browser edit requires another request", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const created = await f.request("lead", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const focus = await created.json(), path = `/api/coach/focuses/${focus.id}`;
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    await page.goto(f.origin + `/?focus=${focus.id}`);
    await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
    const note = page.getByLabel("Review note · optional");
    const confirm = page.getByRole("button", { name: "Confirm and lock", exact: true });
    await note.fill("Keep this review note");
    await page.route("**" + path + "/request", route => route.fulfill({
      status: 503, contentType: "application/json", body: JSON.stringify({ error: "Review temporarily unavailable." }),
    }));
    await page.getByRole("button", { name: "Send request", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Review temporarily unavailable.");
    await expect(note).toHaveValue("Keep this review note");
    await expect(confirm).toBeDisabled();
    const failed = await (await f.request("lead", path)).json();
    assert.equal(failed.focus.status, "draft");
    assert.deepEqual(failed.requests, []);
    assert.deepEqual(failed.notes, []);

    await page.unroute("**" + path + "/request");
    await page.getByRole("button", { name: "Send request", exact: true }).click();
    await expect(page.getByText("Keep this review note", { exact: true })).toBeVisible();
    await expect(confirm).toBeEnabled();
    await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
    await page.getByRole("button", { name: draft.title, exact: true }).click();
    await page.getByRole("button", { name: "Edit title & dates", exact: true }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: "Document title", exact: true }).fill("Changed after requesting review");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(confirm).toBeDisabled();
    await expect(page.getByText("This focus has changed since review was requested. Request review of the latest saved version before confirming.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
    await page.getByRole("button", { name: "Send changes for review", exact: true }).click();
    await expect(confirm).toBeEnabled();
    await page.reload();
    await expect(confirm).toBeEnabled();
    const saved = await (await f.request("lead", path)).json();
    assert.equal(saved.focus.status, "draft");
    assert.deepEqual(saved.requests.map((request: { document: { title: string; version: number } }) => [request.document.title, request.document.version]), [
      [draft.title, focus.version], ["Changed after requesting review", focus.version + 1],
    ]);
    assert.deepEqual(saved.notes.map((entry: { body: string }) => entry.body), ["Keep this review note"]);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("incomplete drafts stay saveable but cannot request review or confirm; members gain no confirmation authority", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const leadContext = await browser.newContext();
    const memberContext = await browser.newContext();
    await leadContext.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    await memberContext.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
    const leadPage = await leadContext.newPage(), memberPage = await memberContext.newPage();
    for (const sections of [[], [{ ...draft.sections[0], kind: "personal-development" }], [{ ...draft.sections[0], goals: [] }]]) {
      const created = await f.request("lead", "/api/focuses", "POST", { ...draft, sections });
      assert.equal(created.status, 201);
      const focus = await created.json();
      await leadPage.goto(f.origin + `/?focus=${focus.id}`);
      await expect(leadPage.getByRole("button", { name: "Confirm and lock", exact: true })).toBeDisabled();
      await expect(leadPage.getByText("Add a Contribution objective with at least one SMART goal before requesting review or confirming.", { exact: true })).toBeVisible();
      await leadPage.getByRole("button", { name: "Review & discussion", exact: true }).click();
      await expect(leadPage.getByRole("button", { name: "Send request", exact: true })).toBeDisabled();
      assert.equal((await f.request("lead", `/api/coach/focuses/${focus.id}/request`, "POST", { version: focus.version })).status, 400);
      const saved = await (await f.request("lead", `/api/focuses/${focus.id}`)).json();
      assert.equal(saved.status, "draft");
      assert.deepEqual(saved.sections, focus.sections);
    }
    const focus = await (await f.request("member", "/api/focuses", "POST", draft)).json();
    await memberPage.goto(f.origin + `/?focus=${focus.id}`);
    await expect(memberPage.getByRole("button", { name: "Confirm and lock", exact: true })).toHaveCount(0);
    await memberPage.getByRole("button", { name: "Review & discussion", exact: true }).click();
    await expect(memberPage.getByLabel("Note to career lead · optional")).toBeVisible();
    await memberPage.getByRole("button", { name: "Send request", exact: true }).click();
    await expect(memberPage.getByRole("heading", { name: "Review discussion", exact: true })).toBeVisible();
    await expect(memberPage.getByRole("button", { name: /Confirm focus|Confirm and lock/ })).toHaveCount(0);
    await expect(memberPage.getByRole("button", { name: "Review requests", exact: true })).toHaveCount(0);
    for (const path of [`/api/coach/focuses/${focus.id}/confirm`, `/api/department/members/${f.ids.member}/focuses/${focus.id}/confirm`]) {
      assert.equal((await f.request("member", path, "POST", { version: focus.version })).status, 403);
    }
    assert.equal((await f.request("peer", `/api/coach/focuses/${focus.id}`)).status, 404);
    assert.equal((await f.request("outsider", `/api/coach/focuses/${focus.id}`)).status, 404);
    assert.equal((await (await f.request("member", `/api/focuses/${focus.id}`)).json()).status, "draft");
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("confirmation and review actions stay separated on desktop and phones", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const focus = await (await f.request("lead", "/api/focuses", "POST", draft)).json();
    const context = await browser.newContext({ reducedMotion: "reduce" });
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    for (const requested of [false, true]) {
      if (requested) assert.equal((await f.request("lead", `/api/coach/focuses/${focus.id}/request`, "POST", { version: focus.version })).status, 200);
      for (const [width, height] of [[1440, 1000], [320, 568], [390, 844]]) {
        await page.setViewportSize({ width: width!, height: height! });
        await page.goto(f.origin + `/?focus=${focus.id}`);
        await page.getByRole("heading", { name: draft.title, exact: true }).waitFor();
        const details = page.getByRole("button", { name: "Draft · details", exact: true });
        if (await details.isVisible()) await details.click();
        const actions = [
          page.getByRole("button", { name: "Confirm and lock", exact: true }),
          page.getByRole("button", { name: "Review & discussion", exact: true }),
          page.getByRole("button", { name: "+ Add objective", exact: true }),
        ];
        for (const action of actions) await expect(action).toBeVisible();
        if (requested) await expect(actions[0]!).toBeEnabled();
        else await expect(actions[0]!).toBeDisabled();
        for (let index = 1; index < actions.length; index++) {
          const previous = await actions[index - 1]!.boundingBox(), next = await actions[index]!.boundingBox();
          assert.ok(previous && next);
          const minimumGap = index === 1 ? 16 : 12;
          assert.ok(next.y - previous.y - previous.height >= minimumGap || next.x - previous.x - previous.width >= minimumGap,
            `Actions need at least ${minimumGap}px separation at ${width}px (${requested ? "requested" : "unrequested"})`);
        }
        assert.ok(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"));
      }
    }
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
