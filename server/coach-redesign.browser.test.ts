import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture } from "./coach-test-support.js";
import { resolveFeatureConfig } from "./features.js";
import type { CoachProvider } from "./coach-provider.js";
import type { CoachCheckpoint, CoachSuggestion } from "../shared/coach.js";

async function world(reply: (stage: string, context: CoachCheckpoint) => CoachSuggestion) {
  const calls: Array<{ stage: string; context: CoachCheckpoint }> = [];
  const coach: CoachProvider = { async suggest(_system, text, validate) {
    const input = JSON.parse(text); calls.push(input); return validate(reply(input.stage, input.context));
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([{ name: "lantern-session", value: "member", url: f.origin }]);
  const page = await context.newPage();
  const focus = await (await f.request("member", "/api/focuses", "POST", {
    title: "Trainer focus", start: "2026-11-01", end: "2027-04-30", sections: [],
  })).json();
  await page.goto(f.origin + "/?focus=" + focus.id);
  await page.getByRole("button", { name: "Add objective", exact: true }).click();
  await page.getByRole("button", { name: "Guide with AI", exact: true }).click();
  return { ...f, calls, page, focus, async close() { await browser.close(); await vite.close(); await f.close(); } };
}

test("member chooses a type first, can clarify beyond three answers and explicitly switches type before saving without goals", async () => {
  const f = await world((_stage, context) => context.answers.length < 4
    ? { question: `What would help your training work? ${context.answers.length + 1}`, concern: "Connect this learning to your work.", ready: false }
    : { objective: "Develop language skills to support Spanish-speaking trainers.", recommendedKind: "personal-development", initiativeIds: [] });
  try {
    const { page } = f;
    await expect(page.getByText("Current method: Guide with AI", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch to Write myself", exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Not sure", exact: true })).toBeVisible();
    await page.getByLabel("Your work", { exact: true }).fill("I train Spanish-speaking colleagues and want to learn Spanish.");
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    for (let i = 0; i < 4; i++) {
      await expect(page.getByRole("heading", { name: `What would help your training work? ${i + 1}`, exact: true })).toBeVisible();
      await expect(page.getByText("Connect this learning to your work.", { exact: true })).toBeVisible();
      await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
      await page.getByLabel("Your answer", { exact: true }).fill(`Practice ${i + 1} with the trainers I already support.`);
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Develop language skills to support Spanish-speaking trainers.");
    assert.deepEqual(f.calls.map(c => c.stage), Array(5).fill("clarify"));
    await expect(page.getByRole("radio", { name: "Contribution", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Switch to Personal development", exact: true }).click();
    await page.getByLabel("Other — none of these apply").check();
    await expect(page.getByText(/No SMART goals yet\. You can save/)).toBeVisible();
    await page.getByRole("button", { name: "Save objective", exact: true }).click();
    await expect(page.getByRole("region", { name: "Add objective", exact: true })).toHaveCount(0);
    await page.reload();
    const saved = await (await f.request("member", "/api/focuses/" + f.focus.id)).json();
    assert.equal(saved.sections[0].kind, "personal-development");
    assert.deepEqual(saved.sections[0].goals, []);
  } finally { await f.close(); }
});

test("goal ideas appear immediately, questions preserve the selected action, dates stay in period and review does not rewrite the draft", async () => {
  const f = await world((stage, context) => {
    if (stage === "clarify") return { objective: "Help trainers deliver accessible workshops.", recommendedKind: "normal", initiativeIds: [] };
    if (stage === "actions") return { actions: ["Try the workshop materials with captions"], suggestedDate: "2027-03-15" };
    if (stage === "goal" && !context.answers.length) return { question: "Which workshop will you use?", concern: "Choose a workshop within your control." };
    if (stage === "goal") return { goal: "By 15 March 2027, try the workshop materials with captions in my introductory session and note accessibility issues." };
    return { review: "The goal supports the objective. Check that the session date is feasible.", concern: "Confirm the session date before requesting review." };
  });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Not sure", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I train colleagues and want to make my workshops accessible.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Other — none of these apply").check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("button", { name: "Try the workshop materials with captions", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Try the workshop materials with captions", exact: true }).click();
    await page.getByLabel("Target date", { exact: true }).fill("2027-05-01");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("within this position focus period");
    assert.equal(f.calls.filter(c => c.stage === "goal").length, 0);
    await page.getByLabel("Target date", { exact: true }).fill("2027-03-15");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Choose a workshop within your control.", { exact: true })).toBeVisible();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Your answer", { exact: true }).fill("My introductory session; I will note any accessibility issues.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("SMART goal", { exact: true })).toContainText("introductory session");
    await page.getByRole("button", { name: "Add to objective", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("The goal supports the objective. Check that the session date is feasible.", { exact: true })).toBeVisible();
    await expect(page.getByText("Confirm the session date before requesting review.", { exact: true })).toBeVisible();
    const review = f.calls.find(c => c.stage === "review");
    assert.equal(review?.context.siblings?.length, 1);
    assert.equal(f.calls.filter(c => c.stage === "goal").at(-1)?.context.action, "Try the workshop materials with captions");
    await page.getByRole("button", { name: "Save objective", exact: true }).click();
    await expect(page.getByRole("region", { name: "Add objective", exact: true })).toHaveCount(0);
    const saved = await (await f.request("member", "/api/focuses/" + f.focus.id)).json();
    assert.equal(saved.sections[0].objective, "Help trainers deliver accessible workshops.");
    assert.equal(saved.sections[0].goals.length, 1);
  } finally { await f.close(); }
});

test("switching methods during a refinement question preserves manual edits and the refinement stage", async () => {
  const f = await world(stage => stage === "objective" ? { question: "What outcome matters most?" } : { objective: "Unexpected replacement" });
  try {
    const { page } = f;
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const response = await f.request("member", "/api/focuses/" + f.focus.id, "PUT", {
      title: f.focus.title, start: f.focus.start, end: f.focus.end, version: f.focus.version,
      sections: [{ kind: "normal", objective: "Support trainers", goals: [], alignment: { other: true, initiatives: [] } }],
    });
    assert.equal(response.status, 200);
    await page.reload();
    await page.getByRole("button", { name: "Guide with AI", exact: true }).click();
    await page.getByLabel("What would you like to improve about this objective?").fill("Make the outcome clearer");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Switch to Write myself", exact: true }).click();
    await page.getByLabel("Objective", { exact: true }).fill("Help trainers explain workshop exercises clearly");
    await page.getByRole("button", { name: "Switch to Guide with AI", exact: true }).click();
    await expect(page.getByLabel("What would you like to improve about this objective?")).toBeVisible();
    await expect(page.getByText("Help trainers explain workshop exercises clearly", { exact: true })).toBeVisible();
    assert.equal(f.calls.length, 1);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
    assert.equal(f.calls.at(-1)?.stage, "objective");
    assert.equal(f.calls.at(-1)?.context.objective, "Help trainers explain workshop exercises clearly");
  } finally { await f.close(); }
});
