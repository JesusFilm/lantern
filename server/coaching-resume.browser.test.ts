import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, checkpoint, draft } from "./coach-test-support.js";

async function browserFixture() {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([
    { name: "lantern-session", value: "member", url: f.origin },
  ]);
  const page = await context.newPage();
  return {
    ...f,
    page,
    async close() {
      await browser.close();
      await vite.close();
      await f.close();
    },
  };
}

test("legacy notes remain private and intact while objectives are edited", async () => {
  const f = await browserFixture();
  try {
    const saved = await (await f.request("member", "/api/coach/save", "POST", {
      draft, checkpoint: { ...checkpoint, answer: "Unfinished private answer" },
    })).json();
    await f.page.goto(f.origin + "/?focus=" + saved.focus.id);
    await expect(f.page.getByText("Earlier working notes", { exact: true })).toHaveCount(0);
    await expect(f.page.getByText("Unfinished private answer", { exact: true })).toHaveCount(0);
    await f.page.getByRole("button", { name: "+ Add objective", exact: true }).click();
    await f.page.getByLabel("Objective", { exact: true }).fill("Help new engineers");
    await f.page.getByLabel("Other — none of these apply").check();
    await f.page.getByRole("button", { name: "Save objective", exact: true }).click();
    await expect(f.page.locator(".objective-editor")).toHaveCount(0);
    const actual = await (await f.request("member", "/api/coach/focuses/" + saved.focus.id)).json();
    assert.equal(actual.focus.sections.at(-1).objective, "Help new engineers");
    assert.deepEqual(actual.checkpoint, saved.checkpoint);
    await f.page.reload();
    await expect(f.page.getByText("Earlier working notes", { exact: true })).toHaveCount(0);
  } finally { await f.close(); }
});
