import assert from "node:assert/strict";
import { test } from "node:test";
import { checkTranscript, goalDate, schemaCause, similarQuestions } from "./checks.js";
import { scenarios } from "./scenarios.js";
import type { Transcript } from "./types.js";

test("goal dates are read from the required By prefix", () => {
  assert.equal(goalDate("By 6 May 2026, log failures."), "2026-05-06");
  assert.equal(goalDate("By 30 April 2027, ship."), "2027-04-30");
  assert.equal(goalDate("Ship by Friday."), undefined);
});

test("questions sharing most words count as repeated", () => {
  assert.equal(similarQuestions("Who benefits most from your testing work?", "Who benefits from your testing work most?"), true);
  assert.equal(similarQuestions("Who benefits from your testing?", "What evidence would show progress?"), false);
});

test("rejected replies are explained by the contract rule they break", () => {
  assert.equal(schemaCause("goal", '{"concern":"This action does not support the objective."}'), "concern without goal");
  assert.equal(schemaCause("goal", '{"ready":false,"question":"Which action should I use?"}'), "question where a draft is required");
  assert.equal(schemaCause("objective", '{"ready":true,"objective":"Find out who benefits.","recommendedKind":"discovery"}'), "unknown objective type");
  assert.equal(schemaCause("actions", '{"actions":["Plan","Test"],"suggestedDate":"2027-01-15","concern":""}'), "empty or null optional field");
  assert.equal(schemaCause("clarify", '{"ready":false,"question":"Who benefits?","options":["a","b","c","d"]}'), "more than three items");
  assert.equal(schemaCause("clarify", "Who benefits?"), "invalid JSON");
});

test("dates outside the focus period and goals with a changed date are reported", () => {
  const scenario = scenarios.find((s) => s.id === "goal-dates-outside-period")!;
  const transcript: Transcript = {
    scenario: scenario.id, target: "fixture", repeat: 1, today: "2026-11-17", startedAt: "", durationMs: 0, turns: [],
    outcome: {
      completed: true, objective: "o", kind: "normal", initiatives: [], recommendedInitiatives: [], other: true, goals: [],
      plans: [
        { actions: [], suggestedDate: "2027-06-01", action: "a", date: "2026-05-06", goal: "By 6 May 2026, a.", concerns: [] },
        { actions: [], suggestedDate: "2027-01-15", action: "b", date: "2027-01-15", goal: "By 20 January 2027, b.", concerns: ["Check access"] },
      ],
    },
  };
  const checks = checkTranscript(transcript, scenario);
  assert.deepEqual(checks.dateIssues, ["suggested 2027-06-01 outside 2026-11-17..2027-04-30", "goal dated 2027-01-20 instead of 2027-01-15"]);
  assert.equal(checks.concernExpected, true);
  assert.equal(checks.concernRaised, true);
});
