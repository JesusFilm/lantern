import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import type { FocusDraft, PositionFocus } from "../shared/focus.js";
import { coachingFixture, checkpoint } from "./coach-test-support.js";

test("review navigation preserves dirty notes when discard is declined", async () => {
  const f = await coachingFixture({
    async suggest() {
      throw new Error("Navigation must not request coaching suggestions");
    },
  });
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const created = await f.request("member", "/api/focuses", "POST", {
      title: "Dirty review note",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [{
        kind: "normal",
        objective: "Support engineers",
        goals: ["Review build failures"],
        alignment: { initiatives: [], other: true },
      }],
    });
    assert.equal(created.status, 201);
    const source = (await created.json()) as PositionFocus;
    const requested = await f.request("member", "/api/coach/focuses/" + source.id + "/request", "POST", {
      version: source.version,
    });
    assert.equal(requested.status, 200);
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?focus=" + source.id);
    await page.getByRole("button", { name: "Review whole focus" }).click();
    const note = page.getByLabel("Note to career lead · optional");
    await note.fill("Keep my unfinished review note");
    let prompts = 0;
    page.on("dialog", async dialog => {
      prompts++;
      await dialog.dismiss();
    });
    const exits = [
      page.getByRole("button", { name: "Edit objective", exact: true }),
      page.getByRole("button", { name: "Edit goal", exact: true }),
      page.getByRole("button", { name: "Coach", exact: true }).nth(0),
      page.getByRole("button", { name: "Coach", exact: true }).nth(1),
      page.getByRole("button", { name: "Back to draft", exact: true }),
      page.getByRole("button", { name: "Back to authoring", exact: true }),
      page.getByRole("button", { name: "Review discussion", exact: true }),
    ];
    for (const exit of exits) {
      const before = prompts;
      await exit.click();
      await expect(note).toHaveValue("Keep my unfinished review note");
      assert.equal(prompts, before + 1, "Leaving a dirty note must ask before discarding it");
    }
    // Accepting discard still navigates; discussion's own dirty note is guarded too.
    page.removeAllListeners("dialog");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Review discussion", exact: true }).click();
    await page.getByRole("button", { name: "+ Add note", exact: true }).click();
    const discussionNote = page.getByLabel("Add a note", { exact: true });
    await discussionNote.fill("Keep my unfinished discussion note");
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: "Edit draft", exact: true }).click();
    await expect(discussionNote).toHaveValue("Keep my unfinished discussion note");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Edit draft", exact: true }).click();
    await expect(page.getByRole("button", { name: "Review whole focus" })).toBeVisible();
    const record = await (await f.request("member", "/api/coach/focuses/" + source.id)).json();
    assert.equal(record.notes.length, 0);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("editing an independently refreshed review uses the displayed source and preserves its siblings", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const draft: FocusDraft = {
      title: "Review source",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [
        {
          kind: "normal",
          objective: "Original objective",
          goals: ["Original goal"],
          alignment: { initiatives: [], other: true },
        },
      ],
    };
    const created = await f.request("member", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const source = (await created.json()) as PositionFocus;
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?focus=" + source.id);
    await page.getByRole("button", { name: "Review whole focus" }).click();
    await expect(page.getByRole("heading", { name: "Review your whole focus" })).toBeVisible();
    await expect(page.locator(".cp-document")).toContainText("Original objective");

    // Another client inserts an objective while the authoring view retains v1.
    const changed = await f.request("member", "/api/focuses/" + source.id, "PUT", {
      ...draft,
      version: source.version,
      sections: [
        {
          kind: "leadership",
          objective: "New leading objective",
          goals: ["Keep the new sibling goal"],
        },
        ...draft.sections,
      ],
    });
    assert.equal(changed.status, 200);
    const refreshed = (await changed.json()) as PositionFocus;
    // Exercise the review's ordinary focus-event refresh against real HTTP/PG.
    await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await expect(page.locator(".cp-document")).toContainText("New leading objective");
    await page.getByRole("button", { name: "Edit objective", exact: true }).nth(1).click();
    await expect(page.getByRole("dialog").getByLabel("Objective", { exact: true })).toHaveValue("Original objective");
    await page.getByRole("dialog").getByLabel("Objective", { exact: true }).fill("Edited from refreshed review");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved = (await (await f.request("member", "/api/focuses/" + source.id)).json()) as PositionFocus;
    assert.equal(saved.version, refreshed.version + 1);
    assert.deepEqual(saved.sections, [
      refreshed.sections[0],
      { ...refreshed.sections[1], objective: "Edited from refreshed review" },
    ]);
    await page.reload();
    await expect(page.locator("main")).toContainText("Edited from refreshed review");
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("cancelling an applied suggestion keeps its saved progress through a later metadata save", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const created = await f.request("member", "/api/focuses", "POST", {
      title: "Keep cancelled coaching",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [{
        kind: "normal",
        objective: "Original saved objective",
        goals: ["Original saved goal"],
        alignment: { initiatives: [], other: true },
      }],
    });
    assert.equal(created.status, 201);
    const source = (await created.json()) as PositionFocus;
    const progress = await f.request("member", "/api/coach/focuses/" + source.id + "/progress", "PUT", {
      version: source.version,
      checkpointRevision: 0,
      checkpoint: {
        ...checkpoint,
        entry: "objective",
        step: 2,
        kind: "normal",
        other: true,
        objective: "Suggestion that will be cancelled",
      },
    });
    assert.equal(progress.status, 200);
    const savedProgress = (await progress.json()).checkpoint;
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?focus=" + source.id);
    await page.getByRole("button", { name: "Resume coaching", exact: true }).click();
    await page.getByRole("button", { name: "Use suggestion", exact: true }).click();
    await expect(page.getByRole("dialog").getByLabel("Objective", { exact: true })).toHaveValue("Suggestion that will be cancelled");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Edit title & dates", exact: true }).click();
    await page.getByLabel("Document title", { exact: true }).fill("Renamed without consuming coaching");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Renamed without consuming coaching", exact: true })).toBeVisible();
    const record = await (await f.request("member", "/api/coach/focuses/" + source.id)).json();
    assert.equal(record.focus.version, source.version + 1);
    assert.deepEqual(record.focus.sections, source.sections);
    assert.deepEqual(record.checkpoint, savedProgress);
    await expect(page.getByRole("button", { name: "Resume coaching", exact: true })).toBeVisible();
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
