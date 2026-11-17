import assert from "node:assert/strict";
import { test } from "node:test";
import { coachingFixture, checkpoint } from "./coach-test-support.js";
import { resolveFeatureConfig } from "./features.js";
import type { CoachProvider } from "./coach-provider.js";

test("redesigned coaching can clarify a goal after three answers without inventing a commitment", async () => {
  const reply = { question: "How would Spanish help your work?", concern: "The professional connection is unclear.", goal: "", options: [] };
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate(reply); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", {
      stage: "goal", context: { ...checkpoint, action: "Learn Spanish", answers: Array.from({ length: 4 }, (_, i) => ({ question: `Question ${i}`, answer: "I am still unsure." })) },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { question: reply.question, concern: reply.concern, options: [] });
  } finally { await f.close(); }
});

test("redesigned review uses department context without example leakage and is hidden when disabled", async () => {
  let system = "";
  const coach: CoachProvider = { async suggest(prompt, _context, validate) { system = prompt; return validate({ review: "Add a goal showing how you will apply this learning.", concern: "" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=preview", LANTERN_PREVIEW_EMAILS: "member@example.test" }, "local"));
  try {
    const direction = await (await f.request("lead", "/api/department/direction")).json();
    assert.equal((await f.request("lead", "/api/department/direction", "PUT", { ...direction, mission: "Support local trainers in their own language." })).status, 200);
    assert.equal((await f.request("peer", "/api/coach/suggest", "POST", { stage: "review", context: checkpoint })).status, 404);
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "review", context: checkpoint });
    assert.equal(response.status, 200);
    assert.match(system, /Support local trainers in their own language/);
    assert.doesNotMatch(system, /coach for engineers|video devotional/);
    assert.match(system, /Personal development/);
    assert.deepEqual(await response.json(), { review: "Add a goal showing how you will apply this learning." });
  } finally { await f.close(); }
});

test("redesigned date validation rejects out-of-period goals before inference and preserves access isolation", async () => {
  let calls = 0;
  const coach: CoachProvider = { async suggest(_s, _c, validate) { calls++; return validate({ goal: "By 30 November 2026, review failure reports." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    for (const date of ["2026-09-30", "2027-04-01", ""]) {
      assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...checkpoint, date } })).status, 400);
    }
    assert.equal(calls, 0);
    const focus = await (await f.request("member", "/api/focuses", "POST", { title: "Private", start: checkpoint.start, end: checkpoint.end, sections: [] })).json();
    assert.equal((await f.request("peer", "/api/coach/suggest", "POST", { stage: "review", context: checkpoint, focusId: focus.id, version: focus.version })).status, 404);
    assert.equal(calls, 0);
    assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: checkpoint })).status, 200);
  } finally { await f.close(); }
});

test("complete long goal context can be reviewed, with an explicit upper bound and no silent truncation", async () => {
  let received = "";
  const coach: CoachProvider = { async suggest(_s, context, validate) { received = context; return validate({ review: "Review the scope with your career lead." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const siblings = Array.from({ length: 4 }, (_, i) => "Goal " + i + " ".repeat(7990) + "End");
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "review", context: { ...checkpoint, siblings } });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(received).context.siblings, siblings);
    received = "";
    const tooLong = await f.request("member", "/api/coach/suggest", "POST", { stage: "review", context: { ...checkpoint, siblings: Array(14).fill("a".repeat(10000)) } });
    assert.equal(tooLong.status, 400);
    assert.match((await tooLong.json()).error, /too long.*manually/);
    assert.equal(received, "");
  } finally { await f.close(); }
});

test("a not-ready draft without a usable question or concern is rejected", async () => {
  const coach: CoachProvider = { async suggest(_s, _c, validate) { return validate({ ready: false, objective: "Unusable draft" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: checkpoint })).status, 503);
  } finally { await f.close(); }
});

test("Lantern owns provisional and selected dates even when the coach supplies different dates", async () => {
  let suppliedGoal = "";
  const coach: CoachProvider = { async suggest(_s, context, validate) {
    return validate(JSON.parse(context).stage === "actions"
      ? { actions: ["Review failure reports"], suggestedDate: "2020-01-01" }
      : { goal: suppliedGoal });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const actions = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "actions", context: checkpoint })).json();
    assert.equal(actions.suggestedDate, checkpoint.end);
    for (const prefix of ["", "By 1 January 2027, ", "By January 1, 2027, ", "By 2027-01-01, ", "By 1st January 2027, ", "By January 1st, 2027, "]) {
      suppliedGoal = prefix + "review failure reports.";
      const goal = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: checkpoint })).json();
      assert.equal(goal.goal, "By 30 November 2026, review failure reports.");
    }
    suppliedGoal = "By reviewing reports from January 2026, identify recurring failures.";
    const goal = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: checkpoint })).json();
    assert.equal(goal.goal, "By 30 November 2026, " + suppliedGoal);
  } finally { await f.close(); }
});
