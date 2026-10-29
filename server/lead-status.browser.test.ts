import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, draft } from "./coach-test-support.js";

test("career lead sees review status in the list and detail", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: { server: f.server }, hmr: { server: f.server } },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const created = await f.request("member", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const focus = await created.json();
    const path = `/api/coach/focuses/${focus.id}`;
    assert.equal(
      (await f.request("member", path + "/request", "POST", { version: focus.version })).status,
      200,
    );
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "lead", url: f.origin }]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?page=reviews");
    await expect(page.locator(".review-status").getByText("Review requested", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Review focus", exact: true }).click();
    await expect(page.locator(".review-status").getByText("Review requested", { exact: true })).toBeVisible();
    await expect(page.locator(".review-status").getByText("Newer changes not sent", { exact: true })).toHaveCount(0);

    assert.equal((await f.request("member", path + "/notes", "POST", { version: focus.version, body: "Please discuss this." })).status, 200);
    const changed = await f.request("member", `/api/focuses/${focus.id}`, "PUT", {
      ...draft, title: "A newer saved focus", version: focus.version,
    });
    assert.equal(changed.status, 200);
    const newer = await changed.json();
    await page.goto(f.origin + "/?page=reviews");
    await expect(page.getByRole("heading", { name: `member · ${draft.title}`, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "member · A newer saved focus", exact: true })).toHaveCount(0);
    await expect(page.locator(".review-status").getByText("New notes", { exact: true })).toBeVisible();
    await expect(page.locator(".review-status").getByText("Newer changes not sent", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Review focus", exact: true }).click();
    await expect(page.locator(".review-status").getByText("Newer changes not sent", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm focus", exact: true })).toBeDisabled();
    await page.goto(f.origin + "/?page=reviews");
    await expect(page.locator(".review-status").getByText("New notes", { exact: true })).toHaveCount(0);

    assert.equal((await f.request("member", path + "/request", "POST", { version: newer.version })).status, 200);
    await page.reload();
    await expect(page.getByRole("heading", { name: "member · A newer saved focus", exact: true })).toBeVisible();
    await expect(page.locator(".review-status").getByText("Newer changes not sent", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Review focus", exact: true }).click();
    await page.getByLabel("We have discussed and agreed this focus.").check();
    await page.getByRole("button", { name: "Confirm focus", exact: true }).click();
    await expect(page.locator(".review-status").getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(page.getByText(`Requested version ${newer.version}`, { exact: true })).toBeVisible();
    await expect(page.getByText(`Draft ${newer.version}`, { exact: true })).toHaveCount(0);
    await expect(page.locator(".review-status").getByText("Newer changes not sent", { exact: true })).toHaveCount(0);
    await page.goto(f.origin + "/?page=reviews");
    await expect(page.locator(".review-status").getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(page.locator(".review-status").getByText("Review requested", { exact: true })).toHaveCount(0);
    await expect(page.locator(".review-status").getByText("Newer changes not sent", { exact: true })).toHaveCount(0);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
