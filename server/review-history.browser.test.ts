import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect, type Dialog } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, draft } from "./coach-test-support.js";

for (const [crossPage, legacy] of [[false, false], [true, false], [true, true]]) {
  test(`review notes survive declined browser Back${crossPage ? " across Guide" : " to the focus list"}${legacy ? " with unindexed entries" : ""} and allow accepted history traversal`, async () => {
    const f = await coachingFixture();
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa",
    });
    f.app.use(vite.middlewares);
    const browser = await chromium.launch();
    try {
      const created = await f.request("member", "/api/focuses", "POST", draft);
      assert.equal(created.status, 201);
      const focus = await created.json();
      const context = await browser.newContext();
      await context.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(f.origin);
      if (legacy) await page.evaluate('history.replaceState(null, "")');
      await page.getByRole("button", { name: focus.title, exact: true }).click();
      if (crossPage) {
        await page.getByRole("button", { name: "Guide", exact: true }).click();
        await expect(page.locator(".guide-header")).toBeVisible();
        if (legacy) await page.evaluate('history.replaceState(null, "")');
        await page.getByRole("button", { name: "Position focuses", exact: true }).click();
      }
      await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      const note = page.getByLabel("Note to career lead · optional");
      await note.fill("Keep my unfinished history note");
      const sourceUrl = page.url();
      let prompts = 0;
      let accept = false;
      const handleDialog = async (dialog: Dialog) => {
        assert.equal(dialog.type(), "confirm");
        prompts++;
        await (accept ? dialog.accept() : dialog.dismiss());
      };
      page.on("dialog", handleDialog);
      for (let attempt = 1; attempt <= 2; attempt++) {
        await page.goBack();
        await expect.poll(() => prompts).toBe(attempt);
        await expect(page).toHaveURL(sourceUrl);
        await expect(note).toHaveValue("Keep my unfinished history note");
      }
      accept = true;
      await page.goBack();
      await expect.poll(() => prompts).toBe(3);
      if (crossPage) await expect(page.locator(".guide-header")).toBeVisible();
      else await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
      await expect(note).toHaveCount(0);
      await page.goForward();
      await expect(page).toHaveURL(sourceUrl);
      await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      await expect(note).toHaveValue("");

      // Keep a Forward destination while returning to review through history.
      await page.getByRole("button", { name: "Guide", exact: true }).click();
      await expect(page.locator(".guide-header")).toBeVisible();
      if (legacy) await page.evaluate('history.replaceState(null, "")');
      await page.goBack();
      await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      await note.fill("Keep my unfinished forward note");
      accept = false;
      await page.goForward();
      await expect.poll(() => prompts).toBe(4);
      await expect(page).toHaveURL(sourceUrl);
      await expect(note).toHaveValue("Keep my unfinished forward note");
      accept = true;
      await page.goForward();
      await expect(page.locator(".guide-header")).toBeVisible();
      assert.equal(prompts, 5);
      await page.goBack();
      await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      await expect(note).toHaveValue("");
      await note.fill("Menu navigation prompts once");
      await page.getByRole("button", { name: "Guide", exact: true }).click();
      await expect(page.locator(".guide-header")).toBeVisible();
      assert.equal(prompts, 6);
      const record = await (await f.request("member", "/api/coach/focuses/" + focus.id)).json();
      assert.equal(record.notes.length, 0);
      assert.equal(record.requests.length, 0);
      await context.close();
    } finally {
      await browser.close();
      await vite.close();
      await f.close();
    }
  });
}
