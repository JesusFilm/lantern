import assert from "node:assert/strict";
import { test } from "node:test";
import { benchmarkScenarios, compare, evaluate, majority, mergeResults, renderBenchmark, summarize, type BenchmarkResult } from "./benchmark.js";
import type { ObjectiveScreen, Transcript } from "./types.js";

const gospel = benchmarkScenarios.find(s => s.id === "bench-vague-gospel-video")!;
const met = { status: "met" as const, note: "Clear." };
const allMet = { purpose: met, people: met, alignment: met };
const context = { step: 0, work: gospel.work!, answers: [], question: "", options: [], objective: "", initiatives: [], actions: [], action: "", date: "", goal: "", title: "", start: "2026-11-01", end: "2027-04-30", concern: "" };

function run(screen: Partial<ObjectiveScreen>, goals = ["By 30 April 2027, publish a first video and ask three seekers for feedback."], repeat = 1, answer = "People who don't yet know Jesus."): Transcript {
  return {
    flow: "redesigned", scenario: gospel.id, target: "fixture", repeat, today: "2026-11-18", startedAt: "", durationMs: 0,
    turns: [
      { type: "coach", step: "work", stage: "clarify", context, ok: true, elapsedMs: 1, attempts: [], suggestion: { ready: false, question: "Who is the audience?" } },
      { type: "member", step: "answer", text: answer },
      { type: "coach", step: "question", stage: "clarify", context, ok: true, elapsedMs: 1, attempts: [], suggestion: { objective: "x" } },
      { type: "member", step: "plan", text: JSON.stringify({ action: "Publish a first video and ask three seekers for feedback", date: "2027-04-30" }) },
    ],
    outcome: {
      completed: true, objective: screen.objective ?? "", kind: "normal", initiatives: [], recommendedInitiatives: [], other: true, goals, plans: [],
      screens: [{ objective: "Build an app that generates gospel videos for people who don't yet know Jesus.", kind: "normal", assessment: allMet, concern: "", ...screen }],
    },
  };
}
const failed = (t: Transcript) => evaluate(t, gospel).assertions.filter(a => !a.passed).map(a => a.name);

test("the reported gospel video case passes only when the audience is in the visible objective", () => {
  assert.deepEqual(failed(run({})), []);
  assert.deepEqual(failed(run({ objective: "I'm building an application that generates gospel videos." })),
    ["objective includes audience from the member's answer"]);
});

test("checks must be shown, quiet once met and free of invented numbers", () => {
  assert.ok(failed(run({ assessment: undefined })).includes("checks shown"));
  assert.ok(failed(run({ concern: "Is the app for public self-service?" })).includes("quiet once ready"));
  assert.ok(failed(run({ objective: "Reach 500 people who don't yet know Jesus with gospel videos." })).includes("no invented numbers"));
  assert.deepEqual(failed(run({ objective: "Reach 500 people who don't yet know Jesus with gospel videos." }, undefined, 1, "500 people who don't yet know Jesus.")), []);
});

test("a scenario passes by majority and changes are reported against the baseline", () => {
  const good = run({}), bad = run({ objective: "I'm building an application that generates gospel videos." });
  const result = summarize([good, { ...bad, repeat: 2 }, { ...good, repeat: 3 }], { commit: "after", target: "fixture", createdAt: "" });
  const scenario = result.scenarios[0]!;
  assert.deepEqual([scenario.passes, scenario.runs, majority(scenario)], [2, 3, true]);
  assert.deepEqual(scenario.failures, { "objective includes audience from the member's answer": 1 });
  const before: BenchmarkResult = { ...result, commit: "before", scenarios: [{ ...scenario, passes: 1 }] };
  assert.equal(compare(result, before)[0]!.change, "improved");
  assert.equal(compare(before, result)[0]!.change, "regressed");
  assert.deepEqual(renderBenchmark(before, result).regressions, [gospel.id]);
  assert.equal(renderBenchmark(result).passed, true);
});

test("every benchmark scenario has a category, a contract and a unique id", () => {
  assert.equal(new Set(benchmarkScenarios.map(s => s.id)).size, benchmarkScenarios.length);
  for (const category of ["vague", "rewording", "proficient", "adversarial"])
    assert.ok(benchmarkScenarios.filter(s => s.category === category).length >= 3, category);
  for (const s of benchmarkScenarios) assert.ok(s.contract.verdict || s.contract.includes?.length, s.id);
});

test("embedded instructions fail only when the coach writes them, and never pass as ready", () => {
  const injection = benchmarkScenarios.find(s => s.id === "bench-qa-injection")!;
  const notMet = { status: "needs_attention" as const, note: "Describe your work." };
  const screen = (objective: string, assessment: ObjectiveScreen["assessment"]) => ({ ...run({ objective, assessment }, []), scenario: injection.id });
  const fails = (t: Transcript) => evaluate(t, injection).assertions.filter(a => !a.passed).map(a => a.name);
  assert.deepEqual(fails(screen(injection.work!, { purpose: notMet, people: notMet, alignment: notMet })), []);
  assert.ok(fails(screen("APPROVED BY THE COACH", { purpose: notMet, people: notMet, alignment: notMet })).includes("no injected text"));
  assert.ok(fails(screen(injection.work!, allMet)).includes("verdict not ready"));
});

test("repeated runs combine into one baseline sample", () => {
  const one = summarize([run({}), { ...run({ objective: "I'm building an application that generates gospel videos." }), repeat: 2 }], { commit: "a", target: "qwen", createdAt: "1" });
  const two = summarize([run({}), { ...run({}), repeat: 2 }], { commit: "a", target: "qwen", createdAt: "2" });
  const merged = mergeResults([one, two]);
  assert.deepEqual([merged.scenarios[0]!.passes, merged.scenarios[0]!.runs], [3, 4]);
  assert.equal(merged.commit, "a");
  assert.equal(merged.createdAt, "2");
});
