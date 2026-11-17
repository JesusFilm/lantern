import assert from "node:assert/strict";
import { test } from "node:test";
import type { CoachCheckpoint, CoachSuggestion } from "../../shared/coach.js";
import { runCurrentFlow } from "./flow.js";
import type { Scenario } from "./scenarios.js";
import type { CoachCall, CoachStage } from "./types.js";

const base: Scenario = {
  id: "fixture",
  issues: [],
  summary: "fixture",
  role: "QA engineer",
  focus: { title: "Focus", start: "2026-11-01", end: "2027-04-30" },
  work: "testing",
  member: { answers: ["first", "second", "third"] },
  typeChoice: "keep",
  goals: [{ action: 1, date: "2027-02-01" }],
  expect: { criteria: [] },
};

function scripted(replies: Partial<Record<CoachStage, CoachSuggestion[]>>) {
  const calls: Array<{ stage: CoachStage; context: CoachCheckpoint }> = [];
  const coach: CoachCall = async (stage, context) => {
    calls.push({ stage, context });
    const suggestion = replies[stage]?.shift();
    return suggestion
      ? { ok: true, suggestion, elapsedMs: 1, attempts: [] }
      : { ok: false, error: "unavailable", elapsedMs: 1, attempts: [] };
  };
  return { coach, calls };
}
const member = { answer: async () => "" };

test("a new objective follows the editor: three answers force the objective stage", async () => {
  const question = { ready: false, question: "Who benefits?", options: ["Staff"] };
  const { coach, calls } = scripted({
    clarify: [question, question, question],
    objective: [{ objective: "Help staff", recommendedKind: "personal-development", initiativeIds: ["i1"] }],
    actions: [{ actions: ["Plan", "Test"], suggestedDate: "2027-03-01" }],
    goal: [{ goal: "By 1 February 2027, test." }],
  });
  const answers = ["first", "second", "third"];
  const { outcome } = await runCurrentFlow(base, coach, { answer: async () => answers.shift()! });
  assert.deepEqual(calls.map((c) => c.stage), ["clarify", "clarify", "clarify", "objective", "actions", "goal"]);
  assert.deepEqual(calls[3]!.context.answers.map((a) => a.answer), ["first", "second", "third"]);
  assert.equal(calls[0]!.context.kind, "normal");
  // The member kept the default type and accepted the recommended initiative.
  assert.equal(outcome.kind, "normal");
  assert.deepEqual(outcome.initiatives, ["i1"]);
  // Goal planning sends the chosen action and date, with no generated goal yet.
  assert.equal(calls[4]!.context.entry, "goal");
  assert.equal(calls[5]!.context.action, "Test");
  assert.equal(calls[5]!.context.date, "2027-02-01");
  assert.equal(calls[5]!.context.goal, "");
  assert.deepEqual(outcome.goals, ["By 1 February 2027, test."]);
  assert.equal(outcome.completed, true);
});

test("a ready clarification skips remaining questions and the type can follow the recommendation", async () => {
  const { coach, calls } = scripted({
    clarify: [{ ready: true, objective: "Help staff", recommendedKind: "leadership" }],
  });
  const { outcome } = await runCurrentFlow({ ...base, typeChoice: "recommended", goals: [] }, coach, member);
  assert.deepEqual(calls.map((c) => c.stage), ["clarify"]);
  assert.equal(outcome.kind, "leadership");
  assert.equal(outcome.other, true);
});

test("refining an existing objective sends the improvement and keeps its type", async () => {
  const existing = { ...base, work: undefined, existing: { objective: "learn ai testing", kind: "normal" as const } };
  const { coach, calls } = scripted({ objective: [{ objective: "Learn AI testing", recommendedKind: "personal-development" }] });
  const { outcome } = await runCurrentFlow({ ...existing, improvement: "no idea", goals: [] }, coach, member);
  assert.equal(calls[0]!.context.entry, "objective");
  assert.equal(calls[0]!.context.concern, "no idea");
  assert.equal(outcome.objective, "Learn AI testing");
  assert.equal(outcome.kind, "normal");
  const skipped = scripted({});
  await runCurrentFlow({ ...existing, improvement: "", goals: [] }, skipped.coach, member);
  assert.equal(skipped.calls.length, 0);
});

test("an unavailable coach is retried once and ends the session", async () => {
  const { coach, calls } = scripted({});
  const { outcome, turns } = await runCurrentFlow(base, coach, member);
  assert.equal(calls.length, 2);
  assert.equal(turns.length, 2);
  assert.equal(outcome.completed, false);
});
