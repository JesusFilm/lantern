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

test("copying earlier notes stays bound to its source after browser navigation", async () => {
  const f = await browserFixture();
  try {
    const a = await (
      await f.request("member", "/api/coach/save", "POST", {
        draft,
        checkpoint: { ...checkpoint, objective: "Source A notes" },
      })
    ).json();
    const b = await (
      await f.request("member", "/api/coach/save", "POST", {
        draft: { ...draft, title: "Other focus" },
        checkpoint: { ...checkpoint, objective: "Unrelated B notes" },
      })
    ).json();
    await f.page.goto(f.origin + "/?focus=" + b.focus.id);
    await f.page
      .getByRole("button", { name: "← Position focuses", exact: true })
      .first()
      .click();
    await f.page
      .getByRole("button", { name: draft.title, exact: true })
      .click();
    await f.page.getByText("Earlier working notes", { exact: true }).click();
    await f.page
      .getByRole("button", { name: "Copy to a new objective", exact: true })
      .click();
    await f.page.goBack();
    await f.page.goBack();
    await expect(f.page.getByLabel("Objective", { exact: true })).toHaveValue(
      "Source A notes",
    );
    await f.page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(f.page.locator(".objective-editor")).toHaveCount(0);
    const actual = await (
      await f.request("member", "/api/coach/focuses/" + a.focus.id)
    ).json();
    assert.deepEqual(actual.focus.sections[0], a.focus.sections[0]);
    assert.equal(actual.focus.sections[1].objective, "Source A notes");
    assert.deepEqual(actual.checkpoint, a.checkpoint);
    assert.deepEqual(
      await (
        await f.request("member", "/api/coach/focuses/" + b.focus.id)
      ).json(),
      b,
    );
  } finally {
    await f.close();
  }
});
test("empty legacy notes can open a new objective without crashing or changing the original notes", async () => {
  const f = await browserFixture();
  try {
    const saved = await (
      await f.request("member", "/api/coach/save", "POST", {
        draft: { ...draft, sections: [] },
        checkpoint: { ...checkpoint, objective: "", goal: "" },
      })
    ).json();
    const errors: string[] = [];
    f.page.on("pageerror", (e) => errors.push(e.message));
    await f.page.goto(f.origin + "/?focus=" + saved.focus.id);
    await f.page.getByText("Earlier working notes", { exact: true }).click();
    await expect(
      f.page.getByText(checkpoint.work, { exact: true }),
    ).toBeVisible();
    await f.page
      .getByRole("button", { name: "Copy to a new objective", exact: true })
      .click();
    await f.page
      .getByLabel("Objective", { exact: true })
      .fill("Help new engineers");
    await f.page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(f.page.locator(".objective-editor")).toHaveCount(0);
    const actual = await (
      await f.request("member", "/api/coach/focuses/" + saved.focus.id)
    ).json();
    assert.deepEqual(errors, []);
    assert.equal(actual.focus.sections[0].objective, "Help new engineers");
    assert.deepEqual(actual.focus.sections[0].goals, []);
    assert.deepEqual(actual.checkpoint, saved.checkpoint);
  } finally {
    await f.close();
  }
});
test("stale earlier notes retain unfinished answers and never overwrite a current objective", async () => {
  const f = await browserFixture();
  try {
    const partial = {
      ...checkpoint,
      entry: "work",
      step: 1,
      question: "Who benefits?",
      answer: "New engineers who are still",
      answers: [{ question: "What changes?", answer: "Clearer failures" }],
    };
    const saved = await (
      await f.request("member", "/api/coach/save", "POST", {
        draft,
        checkpoint: partial,
      })
    ).json();
    const updated = await (
      await f.request("member", "/api/focuses/" + saved.focus.id, "PUT", {
        ...draft,
        title: "Renamed focus",
        version: saved.focus.version,
      })
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.focus.id);
    await f.page.getByText("Earlier working notes", { exact: true }).click();
    await expect(
      f.page.getByText(partial.answer, { exact: true }),
    ).toBeVisible();
    await expect(
      f.page.getByText("Clearer failures", { exact: true }),
    ).toBeVisible();
    await expect(
      f.page.getByRole("button", { name: /Resume|Discard saved/ }),
    ).toHaveCount(0);
    await f.page
      .getByRole("button", { name: "Copy to a new objective", exact: true })
      .click();
    await expect(f.page.getByLabel("Objective", { exact: true })).toHaveValue(
      checkpoint.objective,
    );
    f.page.once("dialog", (d) => void d.accept());
    await f.page.getByRole("button", { name: "Cancel", exact: true }).click();
    const actual = await (
      await f.request("member", "/api/coach/focuses/" + saved.focus.id)
    ).json();
    assert.deepEqual(actual.focus, updated);
    assert.deepEqual(actual.checkpoint, saved.checkpoint);
    await f.page.reload();
    await f.page.getByText("Earlier working notes", { exact: true }).click();
    await expect(
      f.page.getByText(partial.answer, { exact: true }),
    ).toBeVisible();
  } finally {
    await f.close();
  }
});
