import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import type { CoachRecord } from "../shared/coach.js";
import { coachingFixture, draft } from "./coach-test-support.js";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

for (const actor of ["member", "lead"] as const) {
  test(`${actor} acknowledges displayed draft replies and confirmed notes, leaving unopened notes unread`, async () => {
    const f = await coachingFixture();
    const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
    f.app.use(vite.middlewares);
    const browser = await chromium.launch();
    try {
      const created = await f.request("member", "/api/focuses", "POST", draft);
      assert.equal(created.status, 201);
      const focus = await created.json();
      const path = "/api/coach/focuses/" + focus.id;
      assert.equal((await f.request("member", path + "/request", "POST", { version: focus.version, note: "Please review my draft" })).status, 200);
      const record = async (): Promise<CoachRecord> => {
        const response = await f.request(actor, path);
        assert.equal(response.status, 200);
        return response.json();
      };
      const reply = async (body: string) => {
        const response = await f.request(actor === "member" ? "lead" : "member", path + "/notes", "POST", { version: focus.version, body });
        assert.equal(response.status, 200);
        return ((await response.json()) as CoachRecord).notes.at(-1)!;
      };
      const context = await browser.newContext();
      await context.addCookies([{ name: "lantern-session", value: actor, url: f.origin }]);
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.clock.install();
      await page.goto(f.origin + (actor === "member" ? "/?focus=" + focus.id : "/?page=reviews"));
      if (actor === "member") await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      const open = page.getByRole("button", { name: actor === "member" ? "Review discussion" : "Review focus", exact: true });
      await expect(open).toBeVisible();
      const hidden = await reply("Unread until the discussion opens");
      const poll = page.waitForResponse(r => r.url().endsWith(actor === "member" ? path : "/api/coach/focuses?view=lead") && r.request().method() === "GET");
      await page.clock.runFor(7100);
      await poll;
      await expect(page.getByText(hidden.body, { exact: true })).toHaveCount(0);
      assert.deepEqual((await record()).readIds, []);
      await open.click();
      await expect(page.getByText(hidden.body, { exact: true })).toBeVisible();
      await expect.poll(async () => (await record()).readIds).toContain(hidden.id);
      await expect.poll(async () => (await record()).readIds).toContain((await record()).notes[0]!.id);

      const visible = await reply("A reply arriving while we read");
      await page.clock.runFor(7100);
      await expect(page.getByText(visible.body, { exact: true })).toBeVisible();
      await expect.poll(async () => (await record()).readIds).toContain(visible.id);
      await page.reload();
      assert.ok((await record()).readIds.includes(visible.id), "Acknowledgement survives reload");
      const confirmedNote = await reply("Read this with the confirmed focus");
      assert.equal((await f.request("lead", path + "/confirm", "POST", { version: focus.version })).status, 200);
      await page.reload();
      if (actor === "lead") await open.click();
      await expect(page.getByText(confirmedNote.body, { exact: true })).toBeVisible();
      await expect.poll(async () => (await record()).readIds).toContain(confirmedNote.id);
      await expect(page.getByRole("button", { name: /Add note|Delete note/ })).toHaveCount(0);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await vite.close();
      await f.close();
    }
  });
}

test("delayed read responses preserve newer data and unread notes; failures retry only on intent", { timeout: 30000 }, async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  const release = gate();
  const staleRelease = gate();
  try {
    const focus = await (await f.request("member", "/api/focuses", "POST", draft)).json();
    const path = "/api/coach/focuses/" + focus.id;
    assert.equal((await f.request("member", path + "/request", "POST", { version: focus.version, note: "Initial displayed note" })).status, 200);
    const record = async (): Promise<CoachRecord> => (await f.request("lead", path)).json();
    const reply = async (body: string) => {
      const response = await f.request("member", path + "/notes", "POST", { version: focus.version, body });
      assert.equal(response.status, 200);
      return ((await response.json()) as CoachRecord).notes.at(-1)!;
    };
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.clock.install();
    let reads = 0;
    const pending = gate();
    const stalePending = gate();
    await page.route("**" + path + "/read", async route => {
      reads++;
      if (reads === 1) {
        pending.resolve();
        await release.promise;
        await route.fulfill({ response: await route.fetch() });
      } else if (reads === 3) {
        await route.fulfill({ status: 503, json: { error: "Acknowledgement temporarily unavailable" } });
      } else if (reads === 5) {
        stalePending.resolve();
        await staleRelease.promise;
        await route.fulfill({ status: 503, json: { error: "An obsolete read failed" } });
      } else await route.continue();
    });
    await page.goto(f.origin + "/?page=reviews");
    await page.getByRole("button", { name: "Review focus", exact: true }).click();
    await expect(page.getByText("Initial displayed note", { exact: true })).toBeVisible();
    await pending.promise;
    const unseen = await reply("Not displayed in the pending read");
    const changed = await f.request("member", "/api/focuses/" + focus.id, "PUT", { ...draft, title: "Newer unsent draft", version: focus.version });
    assert.equal(changed.status, 200);
    release.resolve();
    await expect.poll(async () => (await record()).readIds.length).toBe(1);
    // The read response includes the newer note and draft, but neither was displayed.
    await expect(page.getByText(unseen.body, { exact: true })).toHaveCount(0);
    assert.ok(!(await record()).readIds.includes(unseen.id));
    await page.clock.runFor(7100);
    await expect(page.getByText(unseen.body, { exact: true })).toBeVisible();
    await expect.poll(async () => (await record()).readIds).toContain(unseen.id);
    await expect(page.getByText("Newer saved changes have not been sent", { exact: true })).toBeVisible();

    const failed = await reply("A visible note whose acknowledgement fails");
    await page.clock.runFor(7100);
    await expect(page.getByRole("alert")).toContainText("Acknowledgement temporarily unavailable");
    await expect(page.getByText(failed.body, { exact: true })).toBeVisible();
    const polled = page.waitForResponse(r => r.url().endsWith("/api/coach/focuses?view=lead"));
    await page.clock.runFor(14100);
    await polled;
    assert.equal(reads, 3, "Failed acknowledgements must not loop on renders or polls");
    assert.ok(!(await record()).readIds.includes(failed.id));
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect.poll(async () => (await record()).readIds).toContain(failed.id);
    await expect(page.getByRole("alert")).toHaveCount(0);

    const stale = await reply("Leave before its read completes");
    await page.clock.runFor(7100);
    await expect(page.getByText(stale.body, { exact: true })).toBeVisible();
    await stalePending.promise;
    await page.getByRole("main").getByRole("button", { name: "Review requests", exact: true }).click();
    staleRelease.resolve();
    await expect(page.getByRole("heading", { name: "Review requests", exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    assert.ok(!(await record()).readIds.includes(stale.id));
    await page.getByRole("button", { name: "Review focus", exact: true }).click();
    await expect.poll(async () => (await record()).readIds).toContain(stale.id);
    await expect(page.getByRole("alert")).toHaveCount(0);
    assert.deepEqual(errors, []);
  } finally {
    release.resolve();
    staleRelease.resolve();
    await browser.close();
    await vite.close();
    await f.close();
  }
});
