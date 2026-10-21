import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { chromium, expect, type Page } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import type { PositionFocus } from "../shared/focus.js";
import { createApp } from "./app.js";
import { privilegeFixture } from "./privilege-test-support.js";
import { migrate } from "./schema.js";

// Hold an actual HTTP response, including its database work, at the browser seam.
async function holdResponse(page: Page, url: string, method = "GET") {
  let release!: () => void, received!: () => void, delivered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { received = resolve; });
  const done = new Promise<void>(resolve => { delivered = resolve; });
  await page.route(url, async route => {
    if (route.request().method() !== method) return route.continue();
    const response = await route.fetch();
    received();
    await gate;
    await route.fulfill({ response });
    delivered();
  });
  return {
    ready,
    async release() {
      release();
      await done;
      await page.unroute(url);
      // Let fetch consumers and React render the response before assertions.
      await page.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    },
  };
}

test("draft workflow keeps edits and asynchronous reads with their source", { timeout: 60000 }, async t => {
  const fixture = await privilegeFixture();
  const server = createServer();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  try {
    browser = await chromium.launch();
    await migrate(fixture.migration, fixture.roles);
    const user = randomUUID(), department = randomUUID();
    await fixture.admin.query(
      "INSERT INTO users(id,google_sub,email,name) VALUES($1,'draft-member','draft@example.test','Draft member')", [user],
    );
    await fixture.admin.query("INSERT INTO departments(id,name) VALUES($1,'Draft team')", [department]);
    await fixture.admin.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [user, department]);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const app = createApp(fixture.runtime, { origin, localUserId: user });
    vite = await createViteServer({ server: { middlewareMode: { server }, hmr: { server } }, appType: "spa" });
    app.use(vite.middlewares);
    server.on("request", app);
    const context = await browser.newContext();
    async function createFocus(title: string) {
      const response = await context.request.post(origin + "/api/focuses", {
        headers: { Origin: origin },
        data: {
          title, start: "2026-01-01", end: "2026-12-31",
          sections: [{ kind: "normal", objective: `${title} objective`, goals: [`${title} goal`] }],
        },
      });
      assert.equal(response.status(), 201);
      return await response.json() as PositionFocus;
    }

    await t.test("a superseded own-focus read cannot undo browser Back", async () => {
      const focus = await createFocus("Read order");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        await page.goto(origin);
        await page.getByRole("button", { name: focus.title, exact: true }).click();
        await expect(page.getByRole("heading", { name: focus.title, exact: true })).toBeVisible();
        await page.goBack();
        await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
        const pending = await holdResponse(page, origin + "/api/focuses/" + focus.id);
        await page.goForward();
        await pending.ready;
        await page.goBack();
        await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
        await pending.release();
        assert.equal(new URL(page.url()).searchParams.get("focus"), null);
        await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: focus.title, exact: true })).toHaveCount(0);
      } finally {
        await page.close();
      }
    });

    await t.test("Back retains an objective edit and Save changes only its original focus", async () => {
      const original = await createFocus("Original source");
      const destination = await createFocus("Navigation destination");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        await page.goto(origin + "/?focus=" + destination.id);
        await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
        await page.getByRole("button", { name: original.title, exact: true }).click();
        await page.getByRole("button", { name: "Edit objective", exact: true }).click();
        await page.getByLabel("Objective", { exact: true }).fill("Keep this with the original source");
        await page.getByRole("checkbox", { name: "Other — none of these apply", exact: true }).check();
        await page.goBack();
        await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Keep this with the original source");
        await page.goBack();
        await expect(page.locator("main h1")).toHaveText(destination.title);
        await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Keep this with the original source");
        await expect(page.getByRole("checkbox", { name: "Other — none of these apply", exact: true })).toBeChecked();
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("heading", { name: original.title, exact: true })).toBeVisible();
        assert.equal(new URL(page.url()).searchParams.get("focus"), original.id);
        await page.reload();
        await expect(page.locator(".read-section")).toContainText("Keep this with the original source");
        await expect(page.locator(".alignment-summary")).toContainText("Other — none of these apply");
        const untouched = await (await context.request.get(origin + "/api/focuses/" + destination.id)).json();
        assert.deepEqual(untouched, destination);
      } finally {
        await page.close();
      }
    });

    await t.test("Forward can refresh the source without rebasing a pending goal onto its newer version", async () => {
      const source = await createFocus("Versioned source");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        await page.goto(origin);
        await page.getByRole("button", { name: source.title, exact: true }).click();
        await page.locator(".read-goal").getByRole("button", { name: "Edit", exact: true }).click();
        await page.getByLabel("SMART goal", { exact: true }).fill("My unsaved goal");
        const updated = await context.request.put(origin + "/api/focuses/" + source.id, {
          headers: { Origin: origin },
          data: { title: "Newer source title", start: source.start, end: source.end,
            sections: source.sections, version: source.version },
        });
        assert.equal(updated.status(), 200);
        await page.goBack();
        await expect(page.locator("main h1")).toHaveText("Position focuses");
        await page.goForward();
        await expect(page.locator("main h1")).toHaveText("Newer source title");
        await expect(page.getByLabel("SMART goal", { exact: true })).toHaveValue("My unsaved goal");
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("dialog").getByRole("alert")).toContainText("changed in another window");
        await expect(page.getByLabel("SMART goal", { exact: true })).toHaveValue("My unsaved goal");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Newer source title", exact: true })).toBeVisible();
        const saved = await (await context.request.get(origin + "/api/focuses/" + source.id)).json();
        assert.equal(saved.version, 2);
        assert.deepEqual(saved.sections, source.sections);
      } finally {
        await page.close();
      }
    });

    await t.test("a late navigation read cannot replace a completed metadata save", async () => {
      const source = await createFocus("Metadata source");
      const destination = await createFocus("Late destination");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        await page.goto(origin + "/?focus=" + destination.id);
        await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
        await page.getByRole("button", { name: source.title, exact: true }).click();
        await page.getByRole("button", { name: "Edit title & dates", exact: true }).click();
        await page.getByLabel("Document title").fill("Saved metadata source");
        await page.getByLabel("Period starts").fill("2026-02-01");
        await page.goBack();
        await expect(page.locator("main h1")).toHaveText("Position focuses");
        const pending = await holdResponse(page, origin + "/api/focuses/" + destination.id);
        await page.goBack();
        await pending.ready;
        await expect(page.getByLabel("Document title")).toHaveValue("Saved metadata source");
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Saved metadata source", exact: true })).toBeVisible();
        await pending.release();
        await expect(page.getByRole("heading", { name: "Saved metadata source", exact: true })).toBeVisible();
        assert.equal(new URL(page.url()).searchParams.get("focus"), source.id);
        await page.reload();
        await expect(page.getByRole("heading", { name: "Saved metadata source", exact: true })).toBeVisible();
        await expect(page.locator("header")).toContainText("1 Feb 2026");
        assert.deepEqual(await (await context.request.get(origin + "/api/focuses/" + destination.id)).json(), destination);
      } finally {
        await page.close();
      }
    });

    await t.test("new document input survives Back and still creates instead of overwriting the destination", async () => {
      const destination = await createFocus("Before creation");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        await page.goto(origin + "/?focus=" + destination.id);
        await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
        await page.getByRole("button", { name: "New position focus", exact: true }).click();
        await page.getByLabel("Document title").fill("Created after Back");
        await page.getByLabel("Period starts").fill("2027-01-01");
        await page.getByLabel("Period ends").fill("2027-12-31");
        await page.goBack();
        await expect(page.locator("main h1")).toHaveText(destination.title);
        await expect(page.getByLabel("Document title")).toHaveValue("Created after Back");
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Created after Back", exact: true })).toBeVisible();
        assert.notEqual(new URL(page.url()).searchParams.get("focus"), destination.id);
        await page.reload();
        await expect(page.getByRole("heading", { name: "Created after Back", exact: true })).toBeVisible();
        assert.deepEqual(await (await context.request.get(origin + "/api/focuses/" + destination.id)).json(), destination);
      } finally {
        await page.close();
      }
    });

    await t.test("Cancel reveals the navigation destination; a pending removal still belongs to its source", async () => {
      const source = await createFocus("Removal source");
      const destination = await createFocus("Removal destination");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        for (const action of ["Cancel", "Remove"] as const) {
          await page.goto(origin + "/?focus=" + destination.id);
          await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
          await page.getByRole("button", { name: source.title, exact: true }).click();
          await page.locator(".read-goal").getByRole("button", { name: "Remove", exact: true }).click();
          await page.goBack();
          await expect(page.locator("main h1")).toHaveText("Position focuses");
          await page.goBack();
          await expect(page.locator("main h1")).toHaveText(destination.title);
          await expect(page.getByRole("dialog")).toContainText("Position focus: Removal source");
          await page.getByRole("dialog").getByRole("button", { name: action, exact: true }).click();
          await expect(page.getByRole("heading", {
            name: action === "Cancel" ? destination.title : source.title, exact: true,
          })).toBeVisible();
          const saved = await (await context.request.get(origin + "/api/focuses/" + source.id)).json();
          assert.deepEqual(saved.sections[0].goals, action === "Cancel" ? ["Removal source goal"] : []);
          assert.deepEqual(await (await context.request.get(origin + "/api/focuses/" + destination.id)).json(), destination);
        }
      } finally {
        await page.close();
      }
    });

    await t.test("initiative loading failure blocks objective saving without blocking opening a focus; retry retains input", async () => {
      const source = await createFocus("Alignment readiness");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        await page.goto(origin);
        await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
        await page.route("**/api/department/direction", route => route.fulfill({
          status: 503, contentType: "application/json", body: JSON.stringify({ error: "Initiatives unavailable." }),
        }));
        await page.getByRole("button", { name: source.title, exact: true }).click();
        await page.getByRole("button", { name: "Edit objective", exact: true }).click();
        await page.getByLabel("Objective", { exact: true }).fill("Ready after retry");
        await expect(page.getByRole("button", { name: "Retry initiatives", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Wait for initiatives to load");
        assert.deepEqual(await (await context.request.get(origin + "/api/focuses/" + source.id)).json(), source);
        await page.unroute("**/api/department/direction");
        const pending = await holdResponse(page, origin + "/api/department/direction");
        await page.getByRole("button", { name: "Retry initiatives", exact: true }).click();
        await pending.ready;
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Wait for initiatives to load");
        await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Ready after retry");
        await pending.release();
        await page.getByRole("checkbox", { name: "Other — none of these apply", exact: true }).check();
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.reload();
        await expect(page.locator(".read-section")).toContainText("Ready after retry");
        await expect(page.locator(".alignment-summary")).toContainText("Other — none of these apply");
      } finally {
        await page.close();
      }
    });

    await t.test("pending saves retain busy cancellation behavior and cannot navigate after leaving the workspace", async () => {
      const source = await createFocus("Pending save source");
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      try {
        await page.goto(origin + "/?page=guide");
        await page.getByRole("button", { name: "Position focuses", exact: true }).click();
        await page.getByRole("button", { name: source.title, exact: true }).click();
        await page.locator(".read-goal").getByRole("button", { name: "Edit", exact: true }).click();
        await page.getByLabel("SMART goal", { exact: true }).fill("Saved while navigating");
        const pending = await holdResponse(page, origin + "/api/focuses/" + source.id, "PUT");
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await pending.ready;
        await page.goBack();
        await expect(page.locator("main h1")).toHaveText("Position focuses");
        await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
        await page.keyboard.press("Escape");
        await expect(page.getByLabel("SMART goal", { exact: true })).toHaveValue("Saved while navigating");
        await page.goBack();
        await expect(page.getByRole("heading", { name: "A draft, a conversation, an agreed focus.", exact: true })).toBeVisible();
        await pending.release();
        assert.equal(new URL(page.url()).searchParams.get("page"), "guide");
        await expect(page.getByRole("heading", { name: "A draft, a conversation, an agreed focus.", exact: true })).toBeVisible();
        const saved = await (await context.request.get(origin + "/api/focuses/" + source.id)).json();
        assert.deepEqual(saved.sections[0].goals, ["Saved while navigating"]);
      } finally {
        await page.close();
      }
    });
  } finally {
    await browser?.close();
    await vite?.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fixture.close();
  }
});
