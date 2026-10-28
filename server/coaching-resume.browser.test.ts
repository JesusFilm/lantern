import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, checkpoint, draft } from "./coach-test-support.js";

async function browserFixture() {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
  const page = await context.newPage();
  return { ...f, page, async close() {
    await browser.close();
    await vite.close();
    await f.close();
  }};
}

test("resuming help after browser navigation uses the pending editor's focus checkpoint", async () => {
  const f = await browserFixture();
  try {
    const a = await (await f.request("member", "/api/coach/save", "POST", {
      draft, checkpoint: { ...checkpoint, step: 2, objective: "Source A suggestion" },
    })).json();
    const b = await (await f.request("member", "/api/coach/save", "POST", {
      draft: { ...draft, title: "Other focus" },
      checkpoint: { ...checkpoint, step: 2, objective: "Unrelated B suggestion" },
    })).json();
    await f.page.goto(f.origin + "/?focus=" + b.focus.id);
    await f.page.getByRole("button", { name: "← Position focuses", exact: true }).first().click();
    await f.page.getByRole("button", { name: draft.title, exact: true }).click();
    await f.page.getByRole("button", { name: "Edit objective", exact: true }).click();
    await expect(f.page.getByRole("button", { name: "Resume saved help here" })).toBeVisible();
    await f.page.goBack();
    await f.page.goBack();
    await expect(f.page.getByRole("heading", { name: "Other focus", exact: true })).toBeVisible();
    f.page.once("dialog", d => void d.accept());
    await f.page.getByRole("button", { name: "Resume saved help here" }).click();
    await expect(f.page.getByLabel("Objective", { exact: true })).toHaveValue("Source A suggestion");
    await f.page.getByRole("button", { name: "Use suggestion" }).click();
    await f.page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(f.page.getByRole("dialog")).toHaveCount(0);
    const savedA = await (await f.request("member", "/api/focuses/" + a.focus.id)).json();
    assert.equal(savedA.sections[0].objective, "Source A suggestion");
    assert.deepEqual(await (await f.request("member", "/api/focuses/" + b.focus.id)).json(), b.focus);
  } finally { await f.close(); }
});

test("an empty legacy step-seven checkpoint resumes as an objective without crashing", async () => {
  const f = await browserFixture();
  try {
    const saved = await (await f.request("member", "/api/coach/save", "POST", {
      draft: { ...draft, sections: [] },
      checkpoint: { ...checkpoint, objective: "", goal: "" },
    })).json();
    const errors: string[] = [];
    f.page.on("pageerror", e => errors.push(e.message));
    await f.page.goto(f.origin + "/?focus=" + saved.focus.id);
    await f.page.getByRole("button", { name: "Resume coaching", exact: true }).click();
    await expect(f.page.getByLabel("Objective", { exact: true })).toBeVisible();
    assert.deepEqual(errors, []);
    await f.page.getByLabel("Objective", { exact: true }).fill("Help new engineers");
    await f.page.getByRole("button", { name: "Use suggestion" }).click();
    await expect(f.page.getByRole("dialog", { name: "Add objective", exact: true })).toBeVisible();
    await f.page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(f.page.getByRole("dialog")).toHaveCount(0);
    const result = await (await f.request("member", "/api/focuses/" + saved.focus.id)).json();
    assert.equal(result.sections[0].objective, "Help new engineers");
    assert.deepEqual(result.sections[0].goals, []);
  } finally { await f.close(); }
});

test("retargeting stale progress preserves the unfinished clarification and persists it on pause", async () => {
  const f = await browserFixture();
  try {
    const partial = {
      ...checkpoint, entry: "work", step: 1,
      question: "Who benefits from this work?",
      options: ["New engineers", "Facilitators"],
      answer: "New engineers who are still",
      answers: [{ question: "What changes?", answer: "Clearer build failures" }],
    };
    const saved = await (await f.request("member", "/api/coach/save", "POST", {
      draft, checkpoint: partial,
    })).json();
    const updated = await (await f.request("member", "/api/focuses/" + saved.focus.id, "PUT", {
      ...draft, title: "Renamed focus", version: saved.focus.version,
    })).json();
    await f.page.goto(f.origin + "/?focus=" + saved.focus.id);
    await f.page.getByRole("button", { name: "Edit objective", exact: true }).click();
    f.page.once("dialog", d => void d.accept());
    await f.page.getByRole("button", { name: "Resume saved help here" }).click();
    await expect(f.page.getByRole("heading", { name: partial.question })).toBeVisible();
    await expect(f.page.getByLabel("Your answer")).toHaveValue(partial.answer);
    await expect(f.page.getByRole("button", { name: "Facilitators", exact: true })).toBeVisible();
    await f.page.getByLabel("Your answer").fill("New engineers who are still learning");
    await f.page.getByRole("button", { name: "Save progress & close" }).click();
    await expect(f.page.getByRole("region", { name: "Optional coaching" })).toHaveCount(0);
    const result = await (await f.request("member", "/api/coach/focuses/" + saved.focus.id)).json();
    assert.deepEqual(result.focus, updated);
    assert.equal(result.checkpoint.sourceVersion, updated.version);
    assert.equal(result.checkpoint.step, 1);
    assert.equal(result.checkpoint.question, partial.question);
    assert.equal(result.checkpoint.answer, "New engineers who are still learning");
    assert.deepEqual(result.checkpoint.options, partial.options);
    assert.deepEqual(result.checkpoint.answers, partial.answers);
    await f.page.reload();
    await f.page.getByRole("button", { name: "Resume coaching", exact: true }).click();
    await expect(f.page.getByLabel("Your answer")).toHaveValue("New engineers who are still learning");
  } finally { await f.close(); }
});
