import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import type { PositionFocus } from "../shared/focus.js";
import { coachingFixture, checkpoint } from "./coach-test-support.js";

test("member review status distinguishes unsent changes from confirmation", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const draft = {
      title: "Review status", start: "2026-10-01", end: "2027-03-31",
      sections: [{ kind: "normal", objective: "Support engineers", goals: ["Review failures"], alignment: { initiatives: [], other: true } }],
    };
    const created = await f.request("member", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const focus = await created.json();
    const path = "/api/coach/focuses/" + focus.id;
    assert.equal((await f.request("member", path + "/request", "POST", { version: focus.version })).status, 200);
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
    const page = await context.newPage();
    const status = page.locator(".focus-review-actions");
    await page.goto(f.origin + "/?focus=" + focus.id);
    await expect(status).toContainText("Review requested");
    const updated = await f.request("member", "/api/focuses/" + focus.id, "PUT", { ...draft, title: "Updated review status", version: focus.version });
    assert.equal(updated.status, 200);
    const next = await updated.json();
    await page.reload();
    await expect(status).toContainText("Changes not sent");
    assert.equal((await f.request("member", path + "/request", "POST", { version: next.version })).status, 200);
    assert.equal((await f.request("lead", path + "/confirm", "POST", { version: next.version })).status, 200);
    const record = await (await f.request("member", path)).json();
    assert.equal(record.focus.version, next.version + 1);
    await page.reload();
    await expect(status).toContainText("Confirmed");
    await expect(status).not.toContainText("Changes not sent");
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("member requests review alongside the saved focus", async () => {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const source = await (await f.request("member", "/api/focuses", "POST", {
      title: "Integrated review", start: "2026-10-01", end: "2027-03-31",
      sections: [{ kind: "normal", objective: "Support engineers", goals: ["Review failures"], alignment: { initiatives: [], other: true } }],
    })).json();
    const context = await browser.newContext();
    await context.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + source.id);
    const add = page.getByRole("button", { name: "+ Add objective", exact: true });
    await expect(add).toBeVisible();
    const addBox = await add.boundingBox();
    const objectiveBox = await page.getByRole("region", { name: "Objective 1" }).boundingBox();
    assert.ok(addBox && objectiveBox && addBox.y < objectiveBox.y);
    await page.getByRole("button", { name: "Review & discussion" }).click();
    await expect(page.getByRole("heading", { name: "Integrated review" })).toBeVisible();
    await expect(page.getByText("Support engineers", { exact: true })).toHaveCount(1);
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 768, height: 1024 },
      { width: 667, height: 375 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(viewport);
      for (const name of [
        "Edit title & dates", "+ Add objective", "Add objective",
        "Edit objective", "Guide with AI", "Remove", "Edit",
        "+ Add SMART goal", "Back to draft", "Close review",
      ]) {
        await expect(page.getByRole("button", { name, exact: true, includeHidden: true })).toHaveCount(0);
      }
      await expect(page.getByRole("button", { name: "← Position focuses", exact: true })).toBeVisible();
      const send = page.getByRole("button", { name: "Send request", exact: true });
      await send.scrollIntoViewIfNeeded();
      const sendBox = await send.boundingBox();
      const panelBox = await page.getByRole("region", { name: "Objective 1" }).boundingBox();
      assert.ok(sendBox && panelBox && panelBox.y - sendBox.y - sendBox.height >= 16,
        "Review actions need breathing room before the objective panel");
    }
    await page.getByLabel("Note to career lead · optional").fill("Please review this");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText("Please review this", { exact: true })).toBeVisible();
    const record = await (await f.request("member", "/api/coach/focuses/" + source.id)).json();
    assert.equal(record.requests[0].document.version, source.version);
    assert.equal(record.notes[0].body, "Please review this");
    await expect(page.getByRole("button", { name: "Edit draft", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Integrated review", exact: true }).click();
    await expect(page.getByRole("button", { name: "+ Add objective", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit objective", exact: true })).toBeVisible();
    assert.deepEqual((await (await f.request("member", "/api/focuses/" + source.id)).json()).sections, source.sections);
  } finally { await browser.close(); await vite.close(); await f.close(); }
});

test("review navigation preserves dirty notes when discard is declined", async () => {
  const f = await coachingFixture({
    async suggest() {
      throw new Error("Navigation must not request coaching suggestions");
    },
  });
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const created = await f.request("member", "/api/focuses", "POST", {
      title: "Dirty review note",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [
        {
          kind: "normal",
          objective: "Support engineers",
          goals: ["Review build failures"],
          alignment: { initiatives: [], other: true },
        },
      ],
    });
    assert.equal(created.status, 201);
    const source = (await created.json()) as PositionFocus;
    const requested = await f.request(
      "member",
      "/api/coach/focuses/" + source.id + "/request",
      "POST",
      {
        version: source.version,
      },
    );
    assert.equal(requested.status, 200);
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?focus=" + source.id);
    await page.getByRole("button", { name: "Review & discussion" }).click();
    const note = page.getByLabel("Note to career lead · optional");
    await note.fill("Keep my unfinished review note");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts++;
      await dialog.dismiss();
    });
    const exits = [
      page.getByRole("button", { name: "← Position focuses", exact: true }),
      page.getByRole("button", { name: "Review discussion", exact: true }),
    ];
    for (const exit of exits) {
      const before = prompts;
      await exit.click();
      await expect(note).toHaveValue("Keep my unfinished review note");
      assert.equal(prompts, before + 1);
    }
    page.removeAllListeners("dialog");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Review discussion", exact: true }).click();
    await page.getByRole("button", { name: "+ Add note", exact: true }).click();
    const discussionNote = page.getByLabel("Add a note", { exact: true });
    await discussionNote.fill("Keep my unfinished discussion note");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
    await expect(discussionNote).toHaveValue("Keep my unfinished discussion note");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Position focuses", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Dirty review note", exact: true }).click();
    await expect(page.getByRole("button", { name: "Review & discussion" })).toBeVisible();
    const record = await (
      await f.request("member", "/api/coach/focuses/" + source.id)
    ).json();
    assert.equal(record.notes.length, 0);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("hidden earlier notes persist through a metadata save", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const created = await f.request("member", "/api/focuses", "POST", {
      title: "Keep cancelled coaching",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [
        {
          kind: "normal",
          objective: "Original saved objective",
          goals: ["Original saved goal"],
          alignment: { initiatives: [], other: true },
        },
      ],
    });
    assert.equal(created.status, 201);
    const source = (await created.json()) as PositionFocus;
    const progress = await f.request(
      "member",
      "/api/coach/focuses/" + source.id + "/progress",
      "PUT",
      {
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
      },
    );
    assert.equal(progress.status, 200);
    const savedProgress = (await progress.json()).checkpoint;
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?focus=" + source.id);
    await expect(page.getByText("Earlier working notes", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Edit title & dates", exact: true })
      .click();
    await page
      .getByLabel("Document title", { exact: true })
      .fill("Renamed without consuming coaching");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Renamed without consuming coaching",
        exact: true,
      }),
    ).toBeVisible();
    const record = await (
      await f.request("member", "/api/coach/focuses/" + source.id)
    ).json();
    assert.equal(record.focus.version, source.version + 1);
    assert.deepEqual(record.focus.sections, source.sections);
    assert.deepEqual(record.checkpoint, savedProgress);
    await expect(
      page.getByText("Earlier working notes", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
