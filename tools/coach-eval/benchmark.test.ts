import assert from "node:assert/strict";
import { test } from "node:test";
import { applyGate, benchmarkScenarios, compare, countMissingRuns, evaluate, gate, majority, mergeResults, renderBenchmark, summarize, type BenchmarkResult } from "./benchmark.js";
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
  assert.match(renderBenchmark(result).markdown, /bench-vague-gospel-video \| 2\/3 pass/);
});

test("every benchmark scenario has a category, a contract and a unique id", () => {
  assert.equal(new Set(benchmarkScenarios.map(s => s.id)).size, benchmarkScenarios.length);
  for (const category of ["vague", "rewording", "proficient", "adversarial"])
    assert.ok(benchmarkScenarios.filter(s => s.category === category).length >= 3, category);
  for (const s of benchmarkScenarios) assert.ok(s.contract.verdict || s.contract.includes?.length || s.contract.improvedOrExplained?.length, s.id);
});

test("the uncertain existing objective must either use the answer or explain the unchanged wording", () => {
  const scenario = benchmarkScenarios.find(s => s.id === "bench-vague-existing-testing")!;
  const notMet = { status: "needs_attention" as const, note: "Describe the work." };
  const check = (objective: string, concern: string) => {
    const t = run({ objective, concern, assessment: { purpose: notMet, people: notMet, alignment: notMet } }, []);
    const second = t.turns[2]!;
    if (second.type === "coach") second.context = { ...second.context, answers: [{ question: "Who?", answer: "People who don't yet know Jesus." }] };
    return evaluate({ ...t, scenario: scenario.id }, scenario).assertions.filter(a => !a.passed).map(a => a.name);
  };
  assert.deepEqual(check("Test the app.", ""), []);
  assert.deepEqual(check("stuff", "The coach could not improve this objective yet."), []);
  assert.ok(check("stuff", "Who benefits?").some(name => name.includes("or explains no improvement")));
  assert.ok(check("Test the website.", "The coach could not improve this objective yet.").some(name => name.includes("or explains no improvement")));
});

test("the existing-objective scenario requires the member's answer to reach the coach", () => {
  const scenario = benchmarkScenarios.find(s => s.id === "bench-vague-existing-testing")!;
  const t = run({ objective: "stuff", concern: "The coach could not improve this objective yet.", assessment: { purpose: { status: "needs_attention", note: "Work?" }, people: { status: "needs_attention", note: "Who?" }, alignment: { status: "uncertain", note: "Why?" } } }, []);
  const fails = evaluate(t, scenario).assertions.filter(a => !a.passed).map(a => a.name);
  assert.ok(fails.includes("member answer sent to coach"));
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

/** Three runs per scenario; `passes` overrides the default of 3 for the named scenarios. */
function sample(passes: Record<string, number> = {}, omit: string[] = []): BenchmarkResult {
  return {
    commit: "x", target: "qwen", createdAt: "",
    scenarios: benchmarkScenarios.filter(s => !omit.includes(s.id)).map(s => ({ id: s.id, category: s.category, runs: 3, passes: passes[s.id] ?? 3, failures: {} })),
  };
}
const failedGate = (result: BenchmarkResult, baseline?: BenchmarkResult) => applyGate(result, gate, baseline).checks.filter(c => !c.passed).map(c => c.name);

test("the committed gate allows Qwen's usual variation but not a lost kind of member", () => {
  assert.ok(gate.minRunPassRate >= 0.7 && gate.minRunPassRate < 1);
  assert.ok(gate.maxDropFromBaseline > 0 && gate.maxDropFromBaseline <= 0.2);
  const baseline = sample({ "bench-vague-gospel-video": 2, "bench-qa-holiday-spanish": 2 });
  // Scattered single-run failures and one scenario losing its majority stay within the gate.
  const noisy = sample({ "bench-vague-gospel-video": 1, "bench-rewording-subtitles": 2, "bench-qa-injection": 2 });
  assert.deepEqual(failedGate(noisy, baseline), []);
  assert.equal(applyGate(noisy, gate, baseline).passed, true);
  // Losing one whole category fails, even if the overall rate would be acceptable.
  const adversarial = Object.fromEntries(benchmarkScenarios.filter(s => s.category === "adversarial").map(s => [s.id, 1]));
  assert.ok(failedGate(sample(adversarial)).includes("adversarial runs"));
  // A missing scenario counts as failed rather than shrinking the sample.
  assert.ok(failedGate(sample({}, ["bench-qa-gibberish"])).includes("every scenario ran"));
});

test("the gate measures drops from the baseline as well as the absolute floor", () => {
  const perfect = sample();
  const threeFailures = sample(Object.fromEntries(benchmarkScenarios.slice(0, 3).map(s => [s.id, 2])));
  // Three scattered failures clear the floor and stay within the allowed drop.
  assert.deepEqual(failedGate(threeFailures, perfect), []);
  const lower = sample(Object.fromEntries(benchmarkScenarios.slice(0, 11).map(s => [s.id, 2])));
  // Eleven scattered failures leave every scenario with a majority, but cross both thresholds.
  assert.deepEqual(failedGate(lower, perfect).sort(), ["drop from baseline", "overall runs"]);
  assert.ok(!failedGate(lower).includes("drop from baseline"), "without a baseline only the floor applies");
  const md = renderBenchmark(lower, perfect).markdown;
  assert.match(md, /Gate: FAIL/);
  assert.match(md, /tools\/coach-eval\/gate\.json/);
  assert.equal(renderBenchmark(lower, perfect).passed, false);
});

test("the baseline drop compares only scenarios present in both results", () => {
  const current = sample();
  const added = current.scenarios[0]!.id;
  const baseline = sample({}, [added]);
  const reduced = { ...current, scenarios: current.scenarios.map(s => s.id === added ? { ...s, passes: 0 } : { ...s, passes: 2 }) };
  const drop = applyGate(reduced, gate, baseline).checks.find(c => c.name === "drop from baseline")!;
  assert.match(drop.actual, /^67% vs baseline 100%/);
  assert.equal(drop.passed, false);
});

test("runs the harness could not record count as failures, so a partial sample cannot pass", () => {
  // One scenario kept a single passing run of three; another recorded nothing.
  const partial = sample({}, ["bench-qa-gibberish"]);
  partial.scenarios[0] = { ...partial.scenarios[0]!, runs: 1, passes: 1 };
  const counted = countMissingRuns(partial, benchmarkScenarios.map(s => s.id), 3);
  const first = counted.scenarios.find(s => s.id === partial.scenarios[0]!.id)!;
  assert.deepEqual([first.passes, first.runs, majority(first)], [1, 3, false]);
  assert.equal(first.failures["run recorded"], 2);
  const gibberish = counted.scenarios.find(s => s.id === "bench-qa-gibberish")!;
  assert.deepEqual([gibberish.passes, gibberish.runs, gibberish.category], [0, 3, "adversarial"]);
  assert.equal(counted.scenarios.length, benchmarkScenarios.length);
  const below = applyGate(counted).checks.find(c => c.name === "scenarios below majority")!;
  assert.equal(below.actual, "2");
  // A scenario with nothing recorded fails the gate outright, even when the rest is perfect.
  const oneMissing = countMissingRuns(sample({}, ["bench-qa-injection"]), benchmarkScenarios.map(s => s.id), 3);
  assert.equal(applyGate(oneMissing).passed, false);
  assert.deepEqual(failedGate(oneMissing), ["every scenario ran"]);
});

test("the goal-evidence scenario checks the drafted goal keeps the member's action and adds no agreement", () => {
  const evidence = benchmarkScenarios.find(s => s.id === "bench-vague-goal-evidence")!;
  const objective = "Cut short versions of new gospel films for social media so young people who haven't heard the gospel watch them.";
  const score = (goal: string) => evaluate({ ...run({ objective }, [goal]), scenario: evidence.id }, evidence).assertions.filter(a => !a.passed).map(a => a.name);
  assert.deepEqual(score("By 30 April 2027, Cut short versions of new films for social media"), []);
  assert.ok(score("By 30 April 2027, Cut short versions and share them with the career lead for feedback").includes("no invented reviewer or agreement"));
  assert.ok(score("By 30 April 2027, Publish a newsletter").includes("goal includes the member's action"));
});

test("every run's goals keep the chosen action, add no outcome, and feedback names no new people", () => {
  const plan = (action: string, goal: string, concerns: string[] = []) => ({ actions: [action], action, date: "2027-04-30", goal, concerns });
  const score = (plans: ReturnType<typeof plan>[], concern = "") => {
    const t = run({ concern }, plans.map(p => p.goal));
    t.outcome.plans = plans;
    return evaluate(t, gospel).assertions.filter(a => !a.passed).map(a => a.name);
  };
  const action = "Publish a first video and ask three seekers for feedback";
  assert.deepEqual(score([plan(action, "By 30 April 2027, publish a first video and ask three seekers for feedback.")]), []);
  assert.ok(score([plan(action, "By 30 April 2027, write a blog post.")]).includes("goals keep the chosen action"), "expected failure: goals keep the chosen action");
  assert.ok(score([plan(action, "By 30 April 2027, publish a first video and ask three seekers for feedback, so that the app is ready for launch.")]).includes("goals add no outcome"), "expected failure: goals add no outcome");
  // An outcome the member chose is theirs.
  assert.deepEqual(score([plan(action + " so that seekers can respond", "By 30 April 2027, publish a first video and ask three seekers for feedback so that seekers can respond.")]), []);
  assert.ok(score([plan(action, "By 30 April 2027, publish a first video and ask three seekers for feedback.", ["Who will you confirm this with, such as your career lead?"])]).includes("feedback names no new people"), "expected failure: feedback names no new people");
  assert.ok(score([], "Check with your manager first.").includes("feedback names no new people"), "expected failure: feedback names no new people");
});

test("the gospel audience may be phrased as people who have not yet met Jesus", () => {
  assert.deepEqual(failed(run({ objective: "Build an application that generates gospel videos for people who have not yet met Jesus." })), []);
});

test("a goal that rewords the chosen action still keeps it", () => {
  const t = run({});
  const action = "Investigate partner support logs to identify common film search failures.";
  const goal = "By 30 April 2027, Review partner support logs to identify patterns in requests related to not finding Spanish films.";
  t.outcome.goals = [goal];
  t.outcome.plans = [{ actions: [action], action, date: "2027-04-30", goal, concerns: ["Consider asking an internal stakeholder which films are hardest to find."] }];
  const names = evaluate(t, gospel).assertions.filter(a => !a.passed).map(a => a.name);
  assert.ok(!names.includes("goals keep the chosen action"), "a reworded action is kept");
  assert.ok(!names.includes("feedback names no new people"), "a generic stakeholder example names no one");
});
