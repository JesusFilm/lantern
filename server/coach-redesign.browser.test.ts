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
  page.setDefaultTimeout(5000);
  const focus = await (await f.request("member", "/api/focuses", "POST", {
    title: "Trainer focus", start: "2026-11-01", end: "2027-04-30", sections: [],
  })).json();
  await page.goto(f.origin + "/?focus=" + focus.id);
  await page.getByRole("button", { name: "Add objective", exact: true }).click();
  await page.getByRole("button", { name: "Guide with AI", exact: true }).click();
  return { ...f, calls, page, focus, async close() { await browser.close(); await vite.close(); await f.close(); } };
}

test("member can continue editing their own wording when the coach keeps asking questions", async () => {
  const f = await world((_stage, context) => context.answers.length < 2
    ? { question: `What would help your training work? ${context.answers.length + 1}`, concern: "Connect this learning to your work.", ready: false, ...(context.answers.length ? { objective: "A draft that is not ready" } : {}) }
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
    for (let i = 0; i < 1; i++) {
      await expect(page.getByRole("heading", { name: `What would help your training work? ${i + 1}`, exact: true })).toBeVisible();
      await expect(page.getByText("Connect this learning to your work.", { exact: true })).toBeVisible();
      await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
      await page.getByLabel("Your answer", { exact: true }).fill(`Practice ${i + 1} with the trainers I already support.`);
      await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("I train Spanish-speaking colleagues and want to learn Spanish.");
    await expect(page.getByText(/What would help your training work\? 2/)).toBeVisible();
    assert.deepEqual(f.calls.map(c => c.stage).filter(stage => stage !== "review"), ["clarify", "clarify", "objective"]);
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Objective", { exact: true }).fill("My edited objective");
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("My edited objective");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Return to draft", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("My edited objective");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByLabel("Your answer", { exact: true }).fill("I support the current workshop.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("My edited objective");
    await expect(page.getByRole("radio", { name: "Contribution", exact: true })).toBeChecked();
    await page.getByRole("radio", { name: "Personal development", exact: true }).check();
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

test("goal ideas preserve the selected action and date, and the final check needs no model call", async () => {
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
    const callsBeforeFinalCheck = f.calls.length;
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check objective", exact: true })).toBeVisible();
    assert.equal(f.calls.length, callsBeforeFinalCheck);
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
    await expect(page.getByLabel("What would you like to improve about this objective?")).toHaveCount(0);
    await page.getByRole("button", { name: "Improve objective", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Switch to Write myself", exact: true }).click();
    await page.getByLabel("Objective", { exact: true }).fill("Help trainers explain workshop exercises clearly");
    await page.getByRole("button", { name: "Switch to Guide with AI", exact: true }).click();
    await expect(page.getByText("The coach will use the Guide to suggest a clearer objective.")).toBeVisible();
    await expect(page.getByText("Help trainers explain workshop exercises clearly", { exact: true })).toBeVisible();
    assert.equal(f.calls.length, 1);
    await page.getByRole("button", { name: "Improve objective", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
    assert.equal(f.calls.at(-1)?.stage, "objective");
    assert.equal(f.calls.at(-1)?.context.objective, "Help trainers explain workshop exercises clearly");
  } finally { await f.close(); }
});

test("member can return to an edited draft or ask for another suggestion from their original input", async () => {
  let count = 0;
  const f = await world(stage => stage === "review" ? { review: "No assessment." } : ({ objective: ++count === 1 ? "Help trainers deliver accessible workshops." : "Help trainers run accessible workshops.", initiativeIds: [] }));
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I help trainers make workshops accessible.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Help trainers deliver accessible workshops.");
    await expect(page.getByRole("button", { name: "Improve objective with AI", exact: true })).toHaveCount(0);
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Objective", { exact: true }).fill("My edited draft");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Your work", { exact: true })).toHaveValue("I help trainers make workshops accessible.");
    await page.getByRole("button", { name: "Return to draft", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("My edited draft");
    assert.equal(f.calls.filter(c => c.stage === "clarify").length, 1);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Help trainers run accessible workshops.");
    assert.equal(f.calls.filter(c => c.stage === "clarify").length, 2);
    assert.equal(f.calls.filter(c => c.stage === "clarify").at(-1)?.context.work, "I help trainers make workshops accessible.");
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByLabel("Your work", { exact: true }).fill("I help new trainers make workshops accessible.");
    await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toBeVisible();
    assert.equal(f.calls.filter(c => c.stage === "clarify").length, 3);
    assert.equal(f.calls.filter(c => c.stage === "clarify").at(-1)?.context.work, "I help new trainers make workshops accessible.");
  } finally { await f.close(); }
});

test("a concern without a draft still lets the member edit their own words", async () => {
  const f = await world(() => ({ concern: "Describe how this learning supports your work." }));
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Personal development", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I want to learn Spanish.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("I want to learn Spanish.");
    await expect(page.getByText("Describe how this learning supports your work.", { exact: true })).toBeVisible();
  } finally { await f.close(); }
});

test("coach feedback is identifiable and distinct from the missing-goals warning", async () => {
  const f = await world(() => ({ objective: "Help trainers run accessible workshops.", concern: "Check how the workshop helps participants.", initiativeIds: [] }));
  try {
    const { page } = f;
    await page.evaluate("document.documentElement.setAttribute('data-theme', 'dark')");
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I help trainers make workshops accessible.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("region", { name: "AI coach feedback" })).toContainText("Check how the workshop helps participants.");
    await expect(page.getByRole("button", { name: "Improve objective with AI", exact: true })).toHaveCount(0);
    await expect(page.getByText(/No SMART goals yet/)).toBeVisible();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("region", { name: "AI coach feedback" })).toHaveCount(0);
    await page.getByRole("button", { name: "Return to draft", exact: true }).click();
    await expect(page.getByRole("region", { name: "AI coach feedback" })).toContainText("Check how the workshop helps participants.");
  } finally { await f.close(); }
});

test("objective feedback shows the coach's three checks and a clear ready state", async () => {
  const f = await world((_stage, context) => context.entry === "objective"
    ? { objective: "Create gospel videos for seekers to encounter Jesus.", assessment: { purpose: { status: "met", note: "The contribution is clear." }, people: { status: "met", note: "Seekers and the intended benefit are clear." }, alignment: { status: "met", note: "This supports the mission." } } }
    : { objective: "Create gospel videos.", assessment: { purpose: { status: "met", note: "The contribution is clear." }, people: { status: "needs_attention", note: "Who will the videos help?" }, alignment: { status: "uncertain", note: "The department mission is unavailable." } } });
  try {
    const direction = await (await f.request("lead", "/api/department/direction")).json();
    assert.equal((await f.request("lead", "/api/department/direction", "PUT", { ...direction, mission: "Help seekers encounter Jesus." })).status, 200);
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("Create gospel videos.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const feedback = page.getByRole("region", { name: "AI coach feedback" });
    await expect(feedback).toContainText("Who will the videos help?");
    await expect(feedback).toContainText("The department mission is unavailable.");
    await expect(feedback).toContainText("Needs attention");
    await expect(feedback).toContainText("Not sure");
    await page.getByRole("button", { name: "Help me address this", exact: true }).click();
    await page.getByLabel("Details for the coach", { exact: true }).fill("They help online seekers encounter Jesus.");
    await page.getByRole("button", { name: "Update objective", exact: true }).click();
    await expect(feedback).toContainText("The main elements are in place");
    await expect(feedback.getByText("Met", { exact: true })).toHaveCount(3);
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("radio", { name: "Leadership", exact: true }).check();
    await expect(feedback).toContainText("changed since the coach checked it");
    await page.getByRole("button", { name: "Check this objective", exact: true }).click();
    await expect(feedback).toContainText("Connection to your work");
    assert.equal(f.calls.at(-1)?.context.kind, "leadership");
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Objective", { exact: true }).fill("A substantially different objective");
    await expect(feedback).not.toContainText("The main elements are in place");
    await expect(feedback).toContainText("changed since the coach checked it");
    await page.getByRole("button", { name: "Check this objective", exact: true }).click();
    await expect(feedback).toContainText("The main elements are in place");
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("A substantially different objective");
    assert.equal(f.calls.at(-1)?.stage, "review");
  } finally { await f.close(); }
});

test("member can give the coach a missing detail and revise the current objective", async () => {
  const f = await world((stage, context) => stage === "clarify"
    ? { objective: "Build a video application.", concern: "Who will use the application?", initiativeIds: [] }
    : { objective: `Build a video application for ${context.answers.at(-1)?.answer}.`, initiativeIds: [] });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I want to build a video app.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a video application.");
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Objective", { exact: true }).fill("Build a gospel video application.");
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a gospel video application.");
    await page.getByRole("button", { name: "Help me address this", exact: true }).click();
    await page.getByLabel("Details for the coach", { exact: true }).fill("online seekers");
    await page.getByRole("button", { name: "Update objective", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a video application for online seekers.");
    assert.equal(f.calls.filter(c => c.stage === "objective").at(-1)?.stage, "objective");
    assert.equal(f.calls.filter(c => c.stage === "objective").at(-1)?.context.objective, "Build a gospel video application.");
    assert.deepEqual(f.calls.filter(c => c.stage === "objective").at(-1)?.context.answers.at(-1), { question: "Who will use the application?", answer: "online seekers" });
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Your work", { exact: true })).toHaveValue("I want to build a video app.");
    await page.getByRole("button", { name: "Return to draft", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a video application for online seekers.");
  } finally { await f.close(); }
});

test("a failed feedback revision keeps the member's draft and details", async () => {
  let revisions = 0;
  const f = await world(stage => {
    if (stage === "clarify") return { objective: "Build a video application.", concern: "Who will use the application?" };
    if (stage === "review") return { review: "No assessment." };
    if (++revisions === 1) throw Error("unavailable");
    return { objective: "Build a video application for online seekers." };
  });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("Build a video app.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Help me address this", exact: true }).click();
    await page.getByLabel("Details for the coach", { exact: true }).fill("online seekers");
    await page.getByRole("button", { name: "Update objective", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a video application.");
    await expect(page.getByLabel("Details for the coach", { exact: true })).toHaveValue("online seekers");
    await page.getByRole("button", { name: "Update objective", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a video application for online seekers.");
  } finally { await f.close(); }
});

test("a follow-up question after feedback appears as feedback beside the unchanged draft", async () => {
  const f = await world(stage => stage === "clarify"
    ? { objective: "Build a video application.", concern: "Who will use it?" }
    : stage === "review" ? { review: "No checks." }
    : { question: "How will they find the videos?" });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("Build a video app.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Help me address this", exact: true }).click();
    await page.getByLabel("Details for the coach", { exact: true }).fill("online seekers");
    await page.getByRole("button", { name: "Update objective", exact: true }).click();
    await expect(page.getByRole("region", { name: "AI coach feedback" })).toContainText("How will they find the videos?");
    await expect(page.getByLabel("Your answer", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a video application.");
  } finally { await f.close(); }
});

test("retry from a follow-up uses the saved answer and makes a fresh suggestion", async () => {
  let drafts = 0;
  const f = await world((stage, context) => stage === "review" ? { review: "No assessment." } : context.answers.length
    ? { objective: ++drafts === 1 ? "Help trainers deliver accessible workshops." : "Help trainers run accessible workshops." }
    : { ready: false, question: "Who benefits?" });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I improve workshops.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Your answer", { exact: true }).fill("Volunteer trainers");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Help trainers deliver accessible workshops.");
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue("Volunteer trainers");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Help trainers run accessible workshops.");
    assert.equal(f.calls.filter(c => c.stage === "clarify").length, 3);
    assert.equal(f.calls.filter(c => c.stage === "clarify").at(-1)?.context.answers[0]?.answer, "Volunteer trainers");
  } finally { await f.close(); }
});

test("a failed retry keeps the edited draft available", async () => {
  let calls = 0;
  const f = await world(stage => { if (stage === "review") return { review: "No assessment." }; if (++calls === 2) throw Error("unavailable"); return { objective: "Help trainers deliver accessible workshops." }; });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I help trainers make workshops accessible.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Help trainers deliver accessible workshops.");
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Objective", { exact: true }).fill("My edited objective");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "Return to draft", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("My edited objective");
    assert.equal(f.calls.filter(c => c.stage === "clarify").length, 2);
  } finally { await f.close(); }
});

test("a missing assessment is not approval and can be checked without rewriting a development objective", async () => {
  let checks = 0;
  // The automatic check and its retry both fail; the member checks manually.
  const f = await world(stage => stage === "review" ? (++checks <= 2 ? (() => { throw Error("unavailable"); })() : { assessment: {
    purpose: { status: "met", note: "The learning is clear." },
    people: { status: "met", note: "The trainers benefit." },
    alignment: { status: "met", note: "This supports the member's work." },
  } }) : { objective: "Learn Spanish to support the trainers I work with." });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Personal development", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("Learn Spanish to support my trainers.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const feedback = page.getByRole("region", { name: "AI coach feedback" });
    await expect(feedback).toContainText("did not provide an assessment");
    await expect(feedback).not.toContainText("The main elements are in place");
    await expect(feedback.getByRole("button", { name: "Help me address this", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Check this objective", exact: true }).click();
    await expect(feedback).toContainText("Connection to your work");
    await expect(feedback).toContainText("The main elements are in place");
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Learn Spanish to support the trainers I work with.");
  } finally { await f.close(); }
});

test("a draft receives automatic checks after an audience follow-up without another click", async () => {
  const f = await world((stage, context) => {
    if (stage === "review") return { assessment: {
      purpose: { status: "met", note: "A video app is the contribution." },
      people: { status: "met", note: "Online seekers are the audience." },
      alignment: { status: "met", note: "Supports the mission." },
    } };
    if (!context.answers.length) return { ready: false, question: "Who is the audience?" };
    return { objective: "Build a gospel video app for online seekers." };
  });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("Build a gospel video app.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Your answer", { exact: true })).toBeVisible();
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByLabel("Your answer", { exact: true }).fill("Online seekers");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a gospel video app for online seekers.");
    const feedback = page.getByRole("region", { name: "AI coach feedback" });
    await expect(feedback).toContainText("Online seekers are the audience.");
    await expect(feedback).toContainText("Your career lead has not configured a mission yet.");
    await expect(feedback).not.toContainText("did not provide an assessment");
    assert.deepEqual(f.calls.map(call => call.stage), ["clarify", "clarify", "review"]);
  } finally { await f.close(); }
});

test("feedback without new wording updates the checks for the wording on screen", async () => {
  const checks = (note: string) => ({
    purpose: { status: "met" as const, note: "The app is the contribution." },
    people: { status: "needs_attention" as const, note },
    alignment: { status: "met" as const, note: "Supports the mission." },
  });
  let reviews = 0;
  const f = await world((stage) => stage === "objective"
    ? { concern: "Name the group the videos are for." }
    : stage === "review" ? { assessment: checks(++reviews === 1 ? "Still no audience in the wording." : "unexpected") }
    : { objective: "Build a gospel video app.", assessment: checks("Who will watch the videos?") });
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("Build a gospel video app.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const feedback = page.getByRole("region", { name: "AI coach feedback" });
    await expect(feedback).toContainText("Who will watch the videos?");
    await expect(page.locator(".cp-coach-wait")).not.toBeVisible();
    await page.getByRole("button", { name: "Help me address this", exact: true }).click();
    await page.getByLabel("Details for the coach", { exact: true }).fill("not sure yet");
    await page.getByRole("button", { name: "Update objective", exact: true }).click();
    await expect(feedback).toContainText("Still no audience in the wording.");
    await expect(feedback).toContainText("Name the group the videos are for.");
    await expect(feedback).not.toContainText("changed since the coach checked it");
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue("Build a gospel video app.");
  } finally { await f.close(); }
});

test("with Not sure chosen, the alignment check is labelled for the type the coach recommended", async () => {
  const assessment = { purpose: { status: "met", note: "The contribution is clear." }, people: { status: "met", note: "Two new engineers benefit." }, alignment: { status: "met", note: "Mentoring supports the team's work." } } as const;
  const f = await world(() => ({ objective: "Mentor two new engineers weekly so they can ship work on their own.", recommendedKind: "leadership", initiativeIds: [], assessment }));
  try {
    const { page } = f;
    await page.getByRole("radio", { name: "Not sure", exact: true }).check();
    await page.getByLabel("Your work", { exact: true }).fill("I want to mentor the two new engineers weekly.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const feedback = page.getByRole("region", { name: "AI coach feedback" });
    await expect(feedback).toContainText("Connection to your work");
    await expect(feedback).not.toContainText("Connection to the mission");
    assert.equal(f.calls.at(-1)?.context.kind, undefined);
  } finally { await f.close(); }
});
