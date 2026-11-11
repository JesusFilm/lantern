import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, draft } from "./coach-test-support.js";

test("confirmation names another member but directs the lead's own focus to their senior or manager", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    // Identical display names must not turn another member into the signed-in lead.
    for (const actor of ["lead", "member"]) {
      assert.equal((await f.request(actor, "/api/account", "PATCH", { name: "Morgan Lee" })).status, 200);
    }
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    for (const actor of ["lead", "member"] as const) {
      const response = await f.request(actor, "/api/focuses", "POST", { ...draft, title: `${actor}'s agreement` });
      assert.equal(response.status, 201);
      const focus = await response.json();
      const paths = [`/?page=department&member=${f.ids[actor]}&memberFocus=${focus.id}`];
      if (actor === "lead") paths.unshift(`/?focus=${focus.id}`);
      for (const path of paths) {
        await page.goto(f.origin + path);
        await page.getByRole("button", { name: "Confirm and lock", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByText(actor === "lead"
          ? "Confirm after your discussion with your senior or manager."
          : "Confirm after your discussion with Morgan Lee.", { exact: true })).toBeVisible();
        await expect(dialog.getByText("Morgan Lee", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal((await (await f.request(actor, `/api/focuses/${focus.id}`)).json()).status, "draft");
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
