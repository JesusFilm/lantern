import assert from "node:assert/strict";
import { test } from "node:test";
import { renderTranscript } from "./judge.js";
import { scenarios } from "./scenarios.js";
import type { Transcript } from "./types.js";

const context = { step: 0, work: "Testing", answers: [], question: "", options: [], objective: "", initiatives: [], actions: [], action: "", date: "", goal: "", title: "", start: "2026-11-01", end: "2027-04-30", concern: "" };
const transcript: Transcript = {
  scenario: scenarios[0]!.id, target: "fixture", repeat: 1, today: "2026-11-17", startedAt: "", durationMs: 0,
  turns: [{ type: "coach", step: "actions", stage: "actions", context, ok: true, elapsedMs: 1, attempts: [], suggestion: { question: "Hidden question?", ready: false, actions: ["Check needs", "Review evidence"], suggestedDate: "2027-02-01" } }],
  outcome: { completed: true, objective: "Help staff", kind: "normal", initiatives: [], recommendedInitiatives: [], other: true, goals: [], plans: [] },
};

test("judge sees what each editor actually displayed when a reply contains a question and a draft", () => {
  const legacy = renderTranscript(transcript, scenarios[0]!);
  assert.match(legacy, /Coach goal ideas/);
  assert.doesNotMatch(legacy, /Hidden question/);
  const redesigned = renderTranscript({ ...transcript, flow: "redesigned" }, scenarios[0]!);
  assert.match(redesigned, /Coach question/);
  assert.match(redesigned, /Hidden question/);
  assert.doesNotMatch(redesigned, /Coach goal ideas/);
});

test("judge sees the saved alignment and goals that the coach received during refinement", () => {
  const existing = scenarios.find(s => s.id === "already-useful")!;
  const turns = transcript.turns.map(t => t.type === "coach" ? { ...t, context: { ...t.context, other: true, siblings: ["Keep the supplied goal"] } } : t);
  const rendered = renderTranscript({ ...transcript, scenario: existing.id, turns }, existing);
  assert.match(rendered, /Member, saved alignment.*Other \(none apply\)/);
  assert.match(rendered, /Member, existing goals.*Keep the supplied goal/);
});


test("redesigned existing-objective transcript does not invent an improvement request", () => {
  const scenario = scenarios.find(s => s.id === "already-useful")!;
  const rendered = renderTranscript({ ...transcript, flow: "redesigned", scenario: scenario.id }, scenario);
  assert.doesNotMatch(rendered, /Member, what to improve/);
});
