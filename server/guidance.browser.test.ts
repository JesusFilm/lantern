import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import { migrate } from "./schema.js";
import { createApp } from "./app.js";

test("first-focus guidance through the member workspace", { timeout: 90000 }, async (t) => {
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const schema = `guidance_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  const server = createServer();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  try {
    await migrate(db);
    const user = randomUUID(), department = randomUUID();
    await db.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,'guidance-user','member@example.test','Taylor Morgan')", [user]);
    await db.query("INSERT INTO departments(id,name) VALUES($1,'Engineering')", [department]);
    await db.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [user, department]);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const app = createApp(db, { origin, localUserId: user });
    vite = await createViteServer({ server: { middlewareMode: { server }, hmr: { server } }, appType: "spa" });
    app.use(vite.middlewares);
    server.on("request", app);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await t.test("an empty workspace explains the process without creating a focus", async () => {
      await page.goto(origin);
      await page.getByRole("button", { name: "Start here", exact: true }).click();
      await expect(page.getByRole("heading", { name: "A draft, a conversation, an agreed focus." })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start here", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("Saved drafts are visible to you and your career lead.", { exact: false })).toBeVisible();
      await expect(page.getByText("the focus can’t be edited or unlocked.", { exact: false })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Choose initiatives", exact: true })).toBeVisible();
      await expect(page.getByText("When editing an objective, choose all the initiatives it supports, or Other if none fit.", { exact: true })).toBeVisible();
      const process = page.getByRole("figure", { name: "A typical position focus process" });
      await expect(process).toBeVisible();
      await expect(process.getByText("Refine before confirming", { exact: true })).toBeVisible();
      await expect(process.getByText("Once agreed", { exact: true })).toBeVisible();
      await expect(process.getByRole("listitem")).toHaveText(["Prepare a small draft", "Talk it through together", "Agree, then confirm"]);
      assert.deepEqual(await (await page.request.get(origin + "/api/focuses")).json(), []);
      await page.getByRole("button", { name: "Start my draft", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Your first position focus" })).toBeVisible();
      await page.getByRole("button", { name: "Guide", exact: true }).click();
      await expect(page.getByRole("heading", { name: "A draft, a conversation, an agreed focus." })).toBeVisible();
    });

    await t.test("the engineering example is illustrative and the simple example remains available on a small phone", async () => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.getByRole("button", { name: "See an engineering example →", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Objective 1", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Engineering Example", exact: true })).toHaveAttribute("aria-current", "step");
      await expect(page.locator(".read-goal")).toHaveCount(2);
      await expect(page.getByRole("heading", { name: "Strategic initiatives", exact: true })).toBeVisible();
      await expect(page.locator(".read-objective").getByRole("listitem")).toHaveText(["Love What We Build", "Rethink How We Build"]);
      await expect(page.locator(".lesson-body").getByRole("heading")).toHaveText(["Objective 1", "Strategic initiatives", "SMART goals"]);
      await expect(page.locator(".read-objective > .read-text")).toHaveText("Help viewers understand how to take a meaningful next step after watching a film.");
      await expect(page.locator(".read-goal .read-text")).toHaveText([
        "By the end of week 2, agree the intended next step with Product, test the current screen with five viewers, and record where they struggle.",
        "By the end of week 6, release an agreed improvement with QA checks and repeat the task with five viewers. Aim for at least four to find the next step without help; record remaining difficulties.",
      ]);
      assert.equal(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      const submenu = page.getByLabel("Steps within Example");
      await expect(submenu.getByRole("button")).toHaveText(["Single Example", "Engineering Example"]);
      await expect(page.getByRole("button", { name: "Example", exact: true })).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator(".lesson-body").getByRole("button", { name: /Example$/ })).toHaveCount(0);
      await submenu.getByRole("button", { name: "Single Example", exact: true }).click();
      await expect(submenu.getByRole("button", { name: "Single Example", exact: true })).toHaveAttribute("aria-current", "step");
      await expect(page.getByRole("heading", { name: "Objective 1", exact: true })).toBeFocused();
      await expect(page.locator(".read-objective")).toContainText("Help new team members");
      await expect(page.locator(".read-objective").getByRole("listitem")).toHaveText(["Role Clarity And Growth"]);
      await expect(page.locator(".read-goal")).toHaveCount(2);
      await submenu.getByRole("button", { name: "Engineering Example", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(submenu.getByRole("button", { name: "Engineering Example", exact: true })).toHaveAttribute("aria-current", "step");
      await page.getByRole("button", { name: "Go to my position focuses", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Your first position focus" })).toBeVisible();
      assert.deepEqual(await (await page.request.get(origin + "/api/focuses")).json(), []);
    });

    await t.test("writing help preserves a phone draft through toggles, rotation, a failed save and a successful retry", async () => {
      await page.getByRole("button", { name: "New position focus", exact: true }).click();
      await page.getByLabel("Document title").fill("My first focus");
      await page.getByLabel("Period starts").fill("2026-11-01");
      await page.getByLabel("Period ends").fill("2026-12-31");
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page.getByRole("button", { name: "Add objective", exact: true }).click();
      const objective = "Help engineers diagnose failed releases quickly so service can be restored with confidence.";
      await page.getByLabel("Objective", { exact: true }).fill(objective);
      await expect(page.getByRole("radio", { name: "Contribution", exact: true })).toBeChecked();
      await expect(page.getByRole("heading", { name: "Describe a useful change." })).toBeVisible();
      await page.getByRole("button", { name: "Hide writing help", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Describe a useful change." })).not.toBeVisible();
      await page.getByRole("radio", { name: "Personal development (optional)", exact: true }).check();
      await page.getByRole("button", { name: "Show writing help", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Build a useful capability." })).toBeVisible();
      await page.getByRole("radio", { name: "Leadership (optional)", exact: true }).check();
      await expect(page.getByRole("heading", { name: "Help others succeed." })).toBeVisible();
      await page.getByRole("radio", { name: "Contribution", exact: true }).check();
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.getByLabel("Objective", { exact: true })).toHaveValue(objective);
      await page.setViewportSize({ width: 390, height: 844 });
      const failSave = async (route: import("@playwright/test").Route) => route.request().method() === "PUT"
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporarily unavailable." }) })
        : route.continue();
      await page.route("**/api/focuses/*", failSave);
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(page.getByRole("alert")).toHaveText("Temporarily unavailable.");
      await page.getByRole("button", { name: "Hide writing help", exact: true }).click();
      await page.getByRole("button", { name: "Show writing help", exact: true }).click();
      await expect(page.getByLabel("Objective", { exact: true })).toHaveValue(objective);
      await page.unroute("**/api/focuses/*", failSave);
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await expect(page.locator(".read-objective")).toContainText(objective);
      await page.getByRole("button", { name: "+ Add SMART goal", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Make progress observable." })).toBeVisible();
      const goal = "By 30 November, test the recovery notes with two engineers and record whether each can identify the next action without help.";
      await page.getByLabel("SMART goal", { exact: true }).fill(goal);
      await page.getByRole("button", { name: "Hide writing help", exact: true }).click();
      await page.getByRole("button", { name: "Show writing help", exact: true }).click();
      await expect(page.getByLabel("SMART goal", { exact: true })).toHaveValue(goal);
      assert.equal(await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
      await page.getByRole("button", { name: "Save changes", exact: true }).click();
      await page.reload();
      await expect(page.locator(".read-goal")).toContainText(goal);
      const focuses = await (await page.request.get(origin + "/api/focuses")).json();
      const saved = await (await page.request.get(origin + "/api/focuses/" + focuses[0].id)).json();
      assert.equal(saved.sections[0].kind, "normal");
      assert.equal(saved.sections[0].objective, objective);
      assert.deepEqual(saved.sections[0].goals, [goal]);
    });

    await t.test("guide navigation and writing actions fit portrait, landscape, tablet and desktop layouts", async () => {
      const focuses = await (await page.request.get(origin + "/api/focuses")).json();
      for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
        const review = await browser!.newPage({ viewport, hasTouch: true });
        review.setDefaultTimeout(5000);
        review.on("pageerror", error => errors.push(error.message));
        try {
          await review.goto(origin + "/?page=guide");
          await expect(review.getByRole("heading", { name: "A draft, a conversation, an agreed focus." })).toBeVisible();
          const process = review.getByRole("figure", { name: "A typical position focus process" });
          await expect(process.getByText("Refine before confirming", { exact: true })).toBeVisible();
          await expect(process.getByText("Once agreed", { exact: true })).toBeVisible();
          const diagram = await process.boundingBox();
          assert.ok(diagram && diagram.x >= 0 && diagram.x + diagram.width <= viewport.width);
          const stages = await process.getByRole("listitem").all();
          const boxes = await Promise.all(stages.map(stage => stage.boundingBox()));
          for (const box of boxes) assert.ok(box && diagram && box.x >= diagram.x && box.x + box.width <= diagram.x + diagram.width);
          if (viewport.width <= 390) assert.ok(boxes[0] && boxes[1] && boxes[2] && boxes[0].y < boxes[1].y && boxes[1].y < boxes[2].y);
          if (viewport.width === 1440) assert.ok(boxes[0] && boxes[1] && boxes[2] && boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x);
          assert.equal(await review.evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Start here at ${viewport.width}×${viewport.height}`);
          await review.getByRole("button", { name: "Explore objectives →", exact: true }).click();
          if (viewport.width <= 620 || viewport.height <= 500) {
            await review.getByRole("button", { name: "← Previous", exact: true }).click();
            await expect(review.getByRole("button", { name: "Start here", exact: true })).toHaveAttribute("aria-pressed", "true");
          }
          await review.getByRole("button", { name: "Example", exact: true }).click();
          await review.getByRole("button", { name: "Engineering Example", exact: true }).click();
          await expect(review.getByRole("heading", { name: "Objective 1", exact: true })).toBeVisible();
          assert.equal(await review.evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Guide at ${viewport.width}×${viewport.height}`);
          await review.goto(origin + "/?focus=" + focuses[0].id);
          await review.getByRole("button", { name: "Edit objective", exact: true }).click();
          const textbox = await review.getByLabel("Objective", { exact: true }).boundingBox();
          const actions = await review.locator(".dialog-actions").boundingBox();
          assert.ok(textbox && actions && textbox.y + Math.min(120, textbox.height) <= actions.y,
            `The writing field has useful visible space at ${viewport.width}×${viewport.height}`);
          const unsaved = "Draft for discussion. ".repeat(60);
          await review.getByLabel("Objective", { exact: true }).fill(unsaved);
          await review.getByRole("button", { name: "Hide writing help", exact: true }).click();
          await review.getByRole("button", { name: "Show writing help", exact: true }).click();
          await expect(review.getByLabel("Objective", { exact: true })).toHaveValue(unsaved);
          await expect(review.getByRole("button", { name: "Save changes", exact: true })).toBeInViewport();
          await expect(review.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
          assert.equal(await review.evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `Writer at ${viewport.width}×${viewport.height}`);
          await review.getByRole("button", { name: "Cancel", exact: true }).click();
          await expect(review.locator(".read-objective")).not.toContainText(unsaved);
        } finally { await review.close(); }
      }
    });

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await vite?.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
