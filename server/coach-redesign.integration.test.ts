import assert from "node:assert/strict";
import { test } from "node:test";
import { coachingFixture, checkpoint } from "./coach-test-support.js";
import { resolveFeatureConfig } from "./features.js";
import type { CoachProvider } from "./coach-provider.js";
import type { CoachCheckpoint } from "../shared/coach.js";

// The live-date guard uses the server clock; keep goal fixtures valid as the calendar advances.
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const activeCheckpoint = { ...checkpoint, start: day(-30), end: day(90), date: day(30) };
const activeDate = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(activeCheckpoint.date + "T12:00:00Z"));

test("redesigned coaching can clarify a goal after three answers without inventing a commitment", async () => {
  const reply = { question: "How would Spanish help your work?", concern: "The professional connection is unclear.", goal: "", options: [] };
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate(reply); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", {
      stage: "goal", context: { ...activeCheckpoint, action: "Learn Spanish", answers: Array.from({ length: 4 }, (_, i) => ({ question: `Question ${i}`, answer: "I am still unsure." })) },
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
    assert.match(system, /Express the useful change you intend to make, who it serves/);
    assert.match(system, /Do not force a numerical target just to make a goal look measurable/);
    assert.doesNotMatch(system, /Test 20 viewers|this viewer task/);
    assert.deepEqual(await response.json(), { review: "Add a goal showing how you will apply this learning." });
  } finally { await f.close(); }
});

test("redesigned date validation rejects out-of-period goals before inference and preserves access isolation", async () => {
  let calls = 0;
  const coach: CoachProvider = { async suggest(_s, _c, validate) { calls++; return validate({ goal: `By ${activeDate}, review failure reports.` }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    for (const date of [day(-31), day(91), ""]) {
      assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...activeCheckpoint, date } })).status, 400);
    }
    assert.equal(calls, 0);
    const focus = await (await f.request("member", "/api/focuses", "POST", { title: "Private", start: checkpoint.start, end: checkpoint.end, sections: [] })).json();
    assert.equal((await f.request("peer", "/api/coach/suggest", "POST", { stage: "review", context: checkpoint, focusId: focus.id, version: focus.version })).status, 404);
    assert.equal(calls, 0);
    assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: activeCheckpoint })).status, 200);
  } finally { await f.close(); }
});

test("the goal HTTP interface rejects past dates inside the focus before calling the coach", async () => {
  let calls = 0;
  const coach: CoachProvider = { async suggest(_s, _c, validate) { calls++; return validate({ goal: "Review reports." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const input = { ...checkpoint, start: day(-10), end: day(30) };
  try {
    const past = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...input, date: day(-1) } });
    assert.equal(past.status, 400);
    assert.equal(calls, 0);
    const today = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...input, date: day(0) } });
    assert.equal(today.status, 200);
    assert.equal(calls, 1);
  } finally { await f.close(); }
});

test("goal date validation follows the member's time zone and rejects an invalid zone", async () => {
  let calls = 0;
  const coach: CoachProvider = { async suggest(_s, _c, validate) { calls++; return validate({ goal: "Review reports." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    for (const timeZone of ["Pacific/Auckland", "America/Los_Angeles"]) {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const value = (name: string) => parts.find(part => part.type === name)!.value;
      const today = `${value("year")}-${value("month")}-${value("day")}`;
      const date = new Date(today + "T12:00:00Z");
      const day = (offset: number) => new Date(date.getTime() + offset * 86400000).toISOString().slice(0, 10);
      const context = { ...checkpoint, start: day(-10), end: day(30) };
      assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...context, date: day(-1) }, timeZone })).status, 400);
      assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...context, date: today }, timeZone })).status, 200);
    }
    assert.equal(calls, 2);
    const invalid = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: checkpoint, timeZone: "Invalid/Nowhere" });
    assert.equal(invalid.status, 400);
    assert.equal(calls, 2);
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
    const actions = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "actions", context: activeCheckpoint })).json();
    assert.equal(actions.suggestedDate, activeCheckpoint.end);
    for (const prefix of ["", "By 1 January 2027, ", "By January 1, 2027, ", "By 2027-01-01, ", "By 1st January 2027, ", "By January 1st, 2027, ",
      "By the end of March 2027, ", "By end of March 2027, ", "By March 2027, ", "By the end of Q1 2027, ", "By mid-January 2027, ",
      "By the end of 2027, ", "By mid-2027, ", "By early 2027, "]) {
      suppliedGoal = prefix + "review failure reports.";
      const goal = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: activeCheckpoint })).json();
      assert.equal(goal.goal, `By ${activeDate}, review failure reports.`);
    }
    suppliedGoal = "By reviewing reports from January 2026, identify recurring failures.";
    const goal = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: activeCheckpoint })).json();
    assert.equal(goal.goal, `By ${activeDate}, ` + suppliedGoal);
  } finally { await f.close(); }
});

test("coaching receives current initiative descriptions from the member's department", async () => {
  const prompts: string[] = [];
  const coach: CoachProvider = { async suggest(system, context, validate) { if (JSON.parse(context).stage === "clarify") prompts.push(system); return validate({ objective: "Help viewers", initiativeIds: [] }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const before = await (await f.request("lead", "/api/department/direction")).json();
    const update = await f.request("lead", "/api/department/direction", "PUT", { ...before, initiatives: [
      { name: "Product", description: "Understand external viewer needs and improve products from their feedback.", archived: false },
      { name: "Practice", description: "Improve how the internal team works with AI agents.", archived: false },
      { name: "Old", description: "Archived description must stay out.", archived: true },
    ] });
    assert.equal(update.status, 200);
    const first = await update.json();
    assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: checkpoint })).status, 200);
    assert.match(prompts[0]!, /Understand external viewer needs and improve products from their feedback/);
    assert.match(prompts[0]!, /Improve how the internal team works with AI agents/);
    assert.doesNotMatch(prompts[0]!, /Archived description must stay out/);
    const changed = await f.request("lead", "/api/department/direction", "PUT", { ...first, initiatives: first.initiatives.map((i: { name: string }) => i.name === "Product" ? { ...i, description: "Listen to ministry partners." } : i) });
    assert.equal(changed.status, 200);
    assert.equal((await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: checkpoint })).status, 200);
    assert.match(prompts[1]!, /Listen to ministry partners/);
    assert.doesNotMatch(prompts[1]!, /Understand external viewer needs/);
  } finally { await f.close(); }
});

test("objective checks use only the configured mission and preserve uncertainty when it is absent", async () => {
  let prompt = "";
  let reply: unknown = { ready: false, assessment: {
    purpose: { status: "met", note: "The contribution is clear." },
    people: { status: "met", note: "Viewers are named." },
    alignment: { status: "met", note: "The intended outcome supports the mission." },
  } };
  const coach: CoachProvider = { async suggest(system, _context, validate) { prompt = system; return validate(reply); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const request = () => f.request("member", "/api/coach/suggest", "POST", { stage: "review", context: { ...checkpoint, entry: "objective" } });
    const checked = await request();
    assert.equal(checked.status, 200);
    assert.equal((await checked.json()).assessment.alignment.status, "uncertain");
    assert.doesNotMatch(prompt, /We partner with the Body of Christ through heart language media/);
    assert.match(prompt, /Department context:.*"mission":""/);
    const development = await f.request("member", "/api/coach/suggest", "POST", { stage: "review", context: { ...checkpoint, entry: "objective", kind: "personal-development" } });
    assert.equal((await development.json()).assessment.alignment.status, "met");
    // With Not sure chosen, a recommended development or leadership type is judged against the work, not the mission.
    reply = { objective: "Grow my mentoring skills", recommendedKind: "leadership", assessment: (reply as { assessment: unknown }).assessment };
    const unsure = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: { ...checkpoint, entry: "objective", kind: undefined } });
    assert.equal((await unsure.json()).assessment.alignment.status, "met");
    reply = { ...(reply as object), recommendedKind: "normal" };
    const unsureContribution = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: { ...checkpoint, entry: "objective", kind: undefined } });
    assert.equal((await unsureContribution.json()).assessment.alignment.status, "uncertain");
    reply = { ready: false, assessment: (reply as { assessment: unknown }).assessment };
    const direction = await (await f.request("lead", "/api/department/direction")).json();
    assert.equal((await f.request("lead", "/api/department/direction", "PUT", { ...direction, mission: "Serve training communities." })).status, 200);
    const configured = await request();
    assert.equal((await configured.json()).assessment.alignment.status, "met");
    assert.match(prompt, /Serve training communities\./);
    reply = { objective: "A useful draft", assessment: { purpose: { status: "met", note: "Clear." } } };
    const partial = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: checkpoint });
    assert.equal(partial.status, 200);
    assert.equal((await partial.json()).assessment, undefined);
    reply = { assessment: { purpose: { status: "met", note: "Clear." } } };
    assert.equal((await request()).status, 503);
  } finally { await f.close(); }
});

test("an unassessed objective automatically gets checks and remains usable if that check fails", async () => {
  const calls: Array<{ stage: string; context: typeof checkpoint }> = [];
  let failCheck = false;
  const coach: CoachProvider = { async suggest(_system, text, validate) {
    const input = JSON.parse(text); calls.push(input);
    if (input.stage !== "review") return validate({ objective: "Build a gospel video app for online seekers.", initiativeIds: [] });
    if (failCheck) throw Error("provider unavailable");
    return validate({ assessment: {
      purpose: { status: "met", note: "The contribution is clear." },
      people: { status: "met", note: "Online seekers benefit." },
      alignment: { status: "met", note: "Supports the mission." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, kind: "normal", work: "Build a gospel video app.", answers: [{ question: "Who benefits?", answer: "Online seekers" }] };
    const request = () => f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    const response = await request();
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.objective, "Build a gospel video app for online seekers.");
    assert.equal(result.assessment.people.status, "met");
    assert.equal(result.assessment.alignment.status, "uncertain");
    assert.deepEqual(calls.map(c => c.stage), ["clarify", "review"]);
    assert.equal(calls[1]!.context.objective, result.objective);
    assert.deepEqual(calls[1]!.context.answers, context.answers);
    failCheck = true;
    const failed = await request();
    assert.equal(failed.status, 200);
    const preserved = await failed.json();
    assert.equal(preserved.objective, result.objective);
    assert.equal(preserved.assessment, undefined);
  } finally { await f.close(); }
});

test("a complete initial assessment needs no second model call", async () => {
  let calls = 0;
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    calls++;
    return validate({ objective: "Help trainers run workshops.", assessment: {
      purpose: { status: "met", note: "The contribution is clear." },
      people: { status: "met", note: "Trainers benefit." },
      alignment: { status: "met", note: "This supports the mission." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, kind: "normal" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).assessment.alignment.status, "uncertain");
    assert.equal(calls, 1);
  } finally { await f.close(); }
});

test("when a follow-up still cannot produce a draft the member's own wording is checked", async () => {
  const calls: Array<{ stage: string; context: typeof checkpoint }> = [];
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    const input = JSON.parse(raw); calls.push(input);
    return validate(input.stage === "review" ? { assessment: {
      purpose: { status: "met", note: "The work is clear." },
      people: { status: "needs_attention", note: "Who benefits?" },
      alignment: { status: "uncertain", note: "Mission is missing." },
    } } : { ready: false, objective: "An unready invented draft", question: "What is the intended outcome?", assessment: {
      purpose: { status: "met", note: "The unready draft is detailed." },
      people: { status: "met", note: "The unready draft names an audience." },
      alignment: { status: "met", note: "The unready draft is aligned." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const input = { ...checkpoint, objective: "", work: "Build a gospel video app", answers: [{ question: "Who benefits?", answer: "Online seekers" }] };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: input });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).assessment.people.status, "needs_attention");
    assert.deepEqual(calls.map(c => c.stage), ["clarify", "objective", "review"]);
    assert.equal(calls[2]!.context.objective, input.work);
  } finally { await f.close(); }
});

test("an answered follow-up is drafted into the visible objective and checked as shown", async () => {
  const calls: Array<{ stage: string; context: typeof checkpoint }> = [];
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    const input = JSON.parse(raw); calls.push(input);
    if (input.stage === "clarify") return validate({ ready: false, question: "Is the app for public self-service or internal colleagues?" });
    if (input.stage === "objective") return validate({ objective: `Build an app that generates gospel videos for ${input.context.answers.at(-1).answer.toLowerCase()}.`, initiativeIds: [] });
    return validate({ assessment: {
      purpose: { status: "met", note: "Building the app is clear." },
      people: { status: "met", note: "The audience is named." },
      alignment: { status: "met", note: "Supports the mission." },
    }, concern: "Is the application for public self-service or internal colleagues?" });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const direction = await (await f.request("lead", "/api/department/direction")).json();
    assert.equal((await f.request("lead", "/api/department/direction", "PUT", { ...direction, mission: "Help everyone encounter Jesus." })).status, 200);
    const input = { ...checkpoint, kind: "normal", objective: "", work: "I'm building an application that generates gospel videos.",
      answers: [{ question: "Who is the audience?", answer: "People who don't yet know Jesus" }] };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: input });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.objective, "Build an app that generates gospel videos for people who don't yet know jesus.");
    assert.equal(result.question, undefined);
    assert.equal(result.concern, undefined, "An optional refinement is not shown once every check is met.");
    assert.deepEqual(calls.map(c => c.stage), ["clarify", "objective", "review"]);
    assert.equal(calls[2]!.context.objective, result.objective, "The checks assess the wording the member sees.");
  } finally { await f.close(); }
});

test("an answer to an existing objective question is used in a draft and the visible wording is checked", async () => {
  const calls: Array<{ stage: string; context: CoachCheckpoint }> = [];
  let allChecksMet = false;
  let failedDraft = false;
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    const input = JSON.parse(raw); calls.push(input);
    if (input.stage === "review") return validate({ assessment: {
      purpose: { status: "met", note: "Testing is clear." },
      people: { status: allChecksMet ? "met" : "needs_attention", note: "How do users benefit?" },
      alignment: { status: allChecksMet ? "met" : "uncertain", note: "Connection is unclear." },
    } });
    if (input.context.question || failedDraft) return validate({ question: "What kind of testing?", concern: "What kind of testing?", ready: false });
    return validate({ objective: "Test the app so users have fewer bugs." });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const input = { ...checkpoint, entry: "objective", objective: "stuff", kind: "normal", question: "Who benefits?", answer: "Users have fewer bugs when I test the app.", answers: [{ question: "Who benefits?", answer: "Users have fewer bugs when I test the app." }] };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: input });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.objective, "Test the app so users have fewer bugs.");
    assert.equal(result.question, undefined);
    assert.match(result.concern, /What kind of testing\?/);
    assert.equal(result.assessment.people.status, "needs_attention");
    assert.deepEqual(calls.map(c => c.stage), ["objective", "objective", "review"]);
    assert.equal(calls[1]!.context.answers[0]!.answer, input.answer);
    assert.equal(calls[2]!.context.objective, result.objective);
    allChecksMet = true;
    const ready = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: { ...input, kind: "personal-development" } });
    assert.equal(ready.status, 200);
    const readyResult = await ready.json();
    assert.equal(readyResult.objective, "Test the app so users have fewer bugs.");
    assert.equal(readyResult.assessment.purpose.status, "met");
    assert.equal(readyResult.assessment.people.status, "met");
    assert.equal(readyResult.assessment.alignment.status, "met");
    assert.equal(readyResult.concern, undefined, "The coach stays quiet when every check is met.");
    allChecksMet = false;
    const repeated = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: {
      ...input, answers: [{ question: "What kind of testing?", answer: "Functional testing." }, ...input.answers],
    } });
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).concern, undefined, "A question already answered earlier is not repeated as feedback.");
    failedDraft = true;
    const noDraft = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: {
      ...input, answers: [{ question: "What kind of testing?", answer: "Functional testing." }, ...input.answers],
    } });
    assert.equal(noDraft.status, 200);
    const fallback = await noDraft.json();
    assert.equal(fallback.objective, undefined);
    assert.equal(fallback.concern, undefined, "An answered question is not repeated when the retry also fails.");
  } finally { await f.close(); }
});

test("answering feedback never starts a question loop and unchanged wording is still checked", async () => {
  const calls: Array<{ stage: string; context: typeof checkpoint }> = [];
  let reviews = 0;
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    const input = JSON.parse(raw); calls.push(input);
    if (input.stage === "objective") return validate({ ready: false, question: "What is your role?" });
    // An echoed field is tolerated; a failed check is retried once.
    if (++reviews === 1) throw new Error("unavailable");
    return validate({ kind: "normal", objective: "echo", question: "Ignored during review?", assessment: {
      purpose: { status: "needs_attention", note: "What is your role?" },
      people: { status: "needs_attention", note: "Who benefits?" },
      alignment: { status: "uncertain", note: "Not enough detail." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const input = { ...checkpoint, kind: "normal", entry: "objective", objective: "asdf jkl", answers: [{ question: "What do you do?", answer: "idk" }] };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "objective", context: input });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.question, undefined);
    assert.equal(result.objective, undefined);
    assert.match(result.concern, /What is your role\?/);
    assert.equal(result.concern.match(/What is your role\?/g)?.length, 1, "Repeated provider questions appear only once in feedback.");
    assert.equal(result.assessment.people.status, "needs_attention");
    assert.deepEqual(calls.map(c => c.stage), ["objective", "objective", "review", "review"]);
    assert.equal(calls[3]!.context.objective, "asdf jkl");
  } finally { await f.close(); }
});

test("a first concern-only reply becomes the member's question, and an unusable first draft keeps checks on their wording", async () => {
  const calls: string[] = [];
  let reply: object = { ready: false, concern: "Which process slows the team down most?" };
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    const input = JSON.parse(raw); calls.push(input.stage);
    return validate(input.stage === "review" ? { assessment: {
      purpose: { status: "needs_attention", note: "Name the work." },
      people: { status: "needs_attention", note: "Who benefits?" },
      alignment: { status: "uncertain", note: "Unclear." },
    } } : reply);
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const request = async () => (await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, objective: "", work: "help the team with stuff" } })).json();
    const asked = await request();
    assert.equal(asked.question, "Which process slows the team down most?");
    assert.equal(asked.assessment, undefined);
    reply = { ready: false, concern: "This needs more detail before it can be drafted." };
    calls.length = 0;
    const own = await request();
    assert.equal(own.question, undefined);
    assert.equal(own.assessment.purpose.status, "needs_attention");
    assert.deepEqual(calls, ["clarify", "review"]);
  } finally { await f.close(); }
});

test("after one answered goal question the coach drafts the goal from the member's action", async () => {
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    const input = JSON.parse(raw);
    return validate({ ready: false, question: input.context.answer ? "And how will you measure it?" : "What evidence will you record?" });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const ask = async (answer: string) => (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...activeCheckpoint, answer, question: answer ? "What evidence will you record?" : "", answers: answer ? [{ question: "What evidence will you record?", answer }] : [] } })).json();
    assert.equal((await ask("")).question, "What evidence will you record?");
    const after = await ask("I'm not sure.");
    assert.equal(after.question, undefined);
    assert.match(after.concern, /how will you measure it/);
    // The member can't say how success will be shown; they still get an editable goal of their own action and date.
    assert.equal(after.goal, `By ${activeDate}, Review logs`);
  } finally { await f.close(); }
});

test("a goal reply with only feedback still gives the member their action as a goal, without inventing evidence", async () => {
  let reply: Record<string, unknown> = { concern: "Evidence is missing for this action." };
  const coach: CoachProvider = { async suggest(_s, _c, validate) { return validate(reply); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const ask = async (context = {}) => (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...activeCheckpoint, ...context } })).json();
    assert.deepEqual(await ask(), { concern: "Evidence is missing for this action.", goal: `By ${activeDate}, Review logs` });
    // A coach-written goal is kept as written.
    reply = { goal: "Review logs and note recurring causes.", concern: "Consider who sees the notes." };
    assert.equal((await ask()).goal, `By ${activeDate}, Review logs and note recurring causes.`);
    // An unanswered question is still asked; the member has not yet had the chance to answer.
    reply = { question: "How does reviewing logs support this objective?" };
    assert.equal((await ask()).goal, undefined);
  } finally { await f.close(); }
});

test("when goal ideas come back empty the coach is asked once more without the earlier question", async () => {
  const questions: string[] = [];
  let replies: Array<Record<string, unknown>> = [];
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    questions.push(JSON.parse(raw).context.question);
    return validate(replies.shift() ?? { concern: "Still unclear." });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const answered = { ...checkpoint, entry: "goal", action: "", goal: "", question: "Who reviews the plan?", answer: "My team.", answers: [{ question: "Who reviews the plan?", answer: "My team." }] };
    const ask = async () => (await f.request("member", "/api/coach/suggest", "POST", { stage: "actions", context: answered })).json();
    replies = [{ concern: "Who reviews the plan?" }, { actions: ["Review three failure reports with the on-call engineer"] }];
    const first = await ask();
    assert.deepEqual(first.actions, ["Review three failure reports with the on-call engineer"]);
    assert.match(first.concern, /Who reviews the plan\?/);
    assert.deepEqual(questions, ["Who reviews the plan?", ""]);
    // If the retry has no ideas either, the feedback is shown and no third call is made.
    questions.length = 0;
    const none = await ask();
    assert.equal(none.actions, undefined);
    assert.equal(questions.length, 2);
  } finally { await f.close(); }
});

test("a check reply without checks is retried", async () => {
  let reviews = 0;
  const coach: CoachProvider = { async suggest(_s, raw, validate) {
    const input = JSON.parse(raw);
    if (input.stage !== "review") return validate({ objective: "Help trainers run accessible workshops.", initiativeIds: [] });
    return validate(++reviews === 1 ? { ready: false, concern: "No checks this time." } : { assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Trainers." }, alignment: { status: "met", note: "Fits." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const result = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, kind: "personal-development" } })).json();
    assert.equal(result.assessment.people.status, "met");
    assert.equal(reviews, 2);
  } finally { await f.close(); }
});

test("a first draft whose beneficiary is not in the member's words becomes the coach's one question", async () => {
  const stages: string[] = [];
  let reply: Record<string, unknown> = {};
  const assessment = { purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Supports the mission." } };
  const coach: CoachProvider = { async suggest(_s, raw, validate) { stages.push(JSON.parse(raw).stage); return validate(stages.at(-1) === "review" ? { assessment } : reply); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const ask = async (context: Record<string, unknown>) => {
      stages.length = 0;
      return (await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, objective: "", work: "I'm building an application that generates gospel videos.", kind: "normal", ...context } })).json();
    };
    // Invented audience: the member never named viewers.
    reply = { objective: "Build an app that generates gospel videos for viewers seeking Jesus.", beneficiary: "viewers seeking Jesus", ready: true, initiativeIds: [] };
    const invented = await ask({});
    assert.equal(invented.objective, undefined);
    assert.match(invented.question, /who/i);
    assert.equal(invented.beneficiary, undefined);
    assert.deepEqual(stages, ["clarify"]);
    // The coach says the member has not named anyone.
    reply = { ...reply, beneficiary: "" };
    assert.match((await ask({})).question, /who/i);
    // A beneficiary taken from the member's own words is drafted and checked as usual.
    reply = { objective: "Deliver subtitles before outreach events for churches in East Africa.", beneficiary: "Churches in East Africa", ready: true, initiativeIds: [] };
    const grounded = await ask({ work: "I translate subtitles, and churches in east Africa need them before their outreach events." });
    assert.equal(grounded.objective, "Deliver subtitles before outreach events for churches in East Africa.");
    assert.equal(grounded.beneficiary, undefined);
    assert.deepEqual(stages, ["clarify", "review"]);
    // Development objectives serve the member, and answers already given are never followed by another question.
    reply = { objective: "Grow my Playwright skills.", beneficiary: "engineers", ready: true, initiativeIds: [] };
    assert.equal((await ask({ kind: "personal-development" })).objective, "Grow my Playwright skills.");
    reply = { objective: "Build an app that generates gospel videos for seekers.", beneficiary: "seekers", ready: true, initiativeIds: [] };
    const answered = await ask({ answers: [{ question: "Who is it for?", answer: "Not sure yet." }] });
    assert.equal(answered.objective, "Build an app that generates gospel videos for seekers.");
    assert.equal(answered.question, undefined);
  } finally { await f.close(); }
});

test("coach questions use member-facing objective type names without changing ordinary language", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({
      question: "I recommend personal-development. Kind is currently 'normal'; what kind of tests do you run in normal working hours?",
      options: ["personal-development", "normal objective type"],
      recommendedKind: "personal-development",
    });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, kind: "normal", answers: [] } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.question, "I recommend Personal development. Objective type is currently 'Contribution'; what kind of tests do you run in normal working hours?");
    assert.deepEqual(result.options, ["Personal development", "Contribution objective type"]);
    assert.equal(result.recommendedKind, "personal-development");
  } finally { await f.close(); }
});

test("coach feedback and checks do not expose type identifiers", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({
      review: "The current type is normal; personal-development may fit.",
      assessment: {
        purpose: { status: "needs_attention", note: "Kind: normal; consider personal-development." },
        people: { status: "met", note: "What kind of support is available during normal hours?" },
        alignment: { status: "uncertain", note: "The normal objective type needs a clearer link." },
      },
    });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "review", context: { ...checkpoint, entry: "objective", kind: "personal-development" } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.review, "The current type is Contribution; Personal development may fit.");
    assert.equal(result.assessment.purpose.note, "Objective type: Contribution; consider Personal development.");
    assert.equal(result.assessment.people.note, "What kind of support is available during normal hours?");
    assert.equal(result.assessment.alignment.note, "The Contribution objective type needs a clearer link.");
  } finally { await f.close(); }
});

test("the coach describes the selected type without the internal normal value", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "I recommend personal-development; normal is currently selected. What would you like to learn?" });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).question, "I recommend Personal development; Contribution is currently selected. What would you like to learn?");
  } finally { await f.close(); }
});

test("type-selection options use the same names shown in the editor", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "Which objective type fits?", options: ["normal", "personal-development", "leadership"] });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).options, ["Contribution", "Personal development", "Leadership"]);
  } finally { await f.close(); }
});

test("the coach does not rewrite the member's exact objective text when it contains an identifier", async () => {
  const objective = "Maintain personal-development scripts for trainers.";
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ objective, assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, work: objective, objective: "", answers: [], kind: "personal-development" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).objective, objective);
  } finally { await f.close(); }
});

test("a dated goal preserves the member's action when it contains an identifier", async () => {
  const action = "Maintain personal-development scripts for trainers.";
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ goal: action }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...activeCheckpoint, action } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).goal, `By ${activeDate}, ${action}`);
  } finally { await f.close(); }
});

test("the existing coach flow is unchanged when the redesign flag is off", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ ready: false, question: "Kind is normal; consider personal-development.", options: ["normal"] });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=off" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [] } });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.question, "Kind is normal; consider personal-development.");
    assert.deepEqual(result.options, ["normal"]);
  } finally { await f.close(); }
});

test("the coach uses Contribution when it names a normal objective", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "The objective is normal. Would personal-development be a better type?" });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).question, "The objective is Contribution. Would Personal development be a better type?");
  } finally { await f.close(); }
});

test("internal type choices are labelled even when the question omits objective type", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "Which one fits?", options: ["normal", "personal-development", "leadership"] });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).options, ["Contribution", "Personal development", "Leadership"]);
  } finally { await f.close(); }
});

test("quoted schema field names are not shown in coach questions", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "Update `Kind` before continuing." });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).question, "Update `Objective type` before continuing.");
  } finally { await f.close(); }
});

test("ordinary uses of kind are not mistaken for an objective type", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "What kind is best for smoke testing?" });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).question, "What kind is best for smoke testing?");
  } finally { await f.close(); }
});

test("rephrased coach drafts and actions preserve identifiers supplied by the member", async () => {
  const coach: CoachProvider = { async suggest(_system, raw, validate) {
    const { stage } = JSON.parse(raw);
    if (stage === "actions") return validate({ actions: ["Document the personal-development scripts for trainers"] });
    if (stage === "goal") return validate({ goal: "Document the personal-development scripts for trainers" });
    return validate({ objective: "Maintain the personal-development scripts for trainers", assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  const context = { ...activeCheckpoint, work: "I maintain personal-development scripts for trainers.", action: "Document personal-development scripts for trainers", kind: "personal-development" };
  try {
    const objective = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...context, answers: [] } });
    assert.equal((await objective.json()).objective, "Maintain the personal-development scripts for trainers");
    const actions = await f.request("member", "/api/coach/suggest", "POST", { stage: "actions", context });
    assert.deepEqual((await actions.json()).actions, ["Document the personal-development scripts for trainers"]);
    const goal = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context });
    assert.equal((await goal.json()).goal, `By ${activeDate}, Document the personal-development scripts for trainers`);
  } finally { await f.close(); }
});

test("mixed internal and displayed objective choices use member-facing labels", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "You chose normal. Which one fits?", options: ["normal", "Personal development", "Leadership"] });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    const result = await response.json();
    assert.equal(result.question, "You chose Contribution. Which one fits?");
    assert.deepEqual(result.options, ["Contribution", "Personal development", "Leadership"]);
  } finally { await f.close(); }
});

test("a sentence beginning with Kind can refer to ordinary language", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "Kind is the name of our test environment. How will you use it?" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal((await response.json()).question, "Kind is the name of our test environment. How will you use it?");
  } finally { await f.close(); }
});

test("ordinary descriptions of an objective stay unchanged", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "Your objective is normal for this stage. What would you like to achieve?" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal((await response.json()).question, "Your objective is normal for this stage. What would you like to achieve?");
  } finally { await f.close(); }
});

test("feedback explains where to change a suggested objective type", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "Your type is normal; change it in the editor if you prefer personal-development." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal((await response.json()).question, "Your type is Contribution; change it on the Objective step if you prefer Personal development.");
  } finally { await f.close(); }
});

test("an instruction to select normal for the objective type uses the Contribution label", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "Select normal for the objective type." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal((await response.json()).question, "Select Contribution for the objective type.");
  } finally { await f.close(); }
});

test("member terminology is preserved in questions, rewritten objectives and actions", async () => {
  const coach: CoachProvider = { async suggest(_system, raw, validate) {
    const { stage, context } = JSON.parse(raw);
    if (stage === "actions") return validate({ actions: ["Document the normal type of deployment"] });
    if (stage === "goal") return validate({ goal: "Document the normal type of deployment" });
    if (context.answers.length) return validate({ objective: "Document the normal type of deployment for trainers", assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
    } });
    return validate({ question: "How do you maintain the personal-development scripts?" });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  const context = { ...activeCheckpoint, work: "I document the normal type of deployment and maintain personal-development scripts.", action: "Document the normal type of deployment", kind: "personal-development" };
  try {
    const question = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...context, answers: [] } });
    assert.equal((await question.json()).question, "How do you maintain the personal-development scripts?");
    const objective = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...context, answers: [{ question: "Who?", answer: "trainers" }] } });
    assert.equal((await objective.json()).objective, "Document the normal type of deployment for trainers");
    const actions = await f.request("member", "/api/coach/suggest", "POST", { stage: "actions", context });
    assert.deepEqual((await actions.json()).actions, ["Document the normal type of deployment"]);
    const goal = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context });
    assert.equal((await goal.json()).goal, `By ${activeDate}, Document the normal type of deployment`);
  } finally { await f.close(); }
});

test("the coach translates a selected type in conversational recommendations", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ question: "You chose normal and I suggest personal-development. Which type fits?", options: ["normal", "leadership"] });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    const result = await response.json();
    assert.equal(result.question, "You chose Contribution and I suggest Personal development. Which type fits?");
    assert.deepEqual(result.options, ["Contribution", "Leadership"]);
  } finally { await f.close(); }
});

test("follow-up answers retain identifiers in generated goals", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ goal: "Document personal-development scripts for trainers" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...activeCheckpoint, answer: "They are named personal-development scripts.", answers: [] } });
    assert.equal((await response.json()).goal, `By ${activeDate}, Document personal-development scripts for trainers`);
  } finally { await f.close(); }
});

test("normal test modes remain ordinary language", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "Which test mode do you prefer? Choose normal." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal((await response.json()).question, "Which test mode do you prefer? Choose normal.");
  } finally { await f.close(); }
});

test("recommendations name the objective type and its editor step", async () => {
  let reply = { question: "The kind should be personal-development.", recommendedKind: "personal-development" };
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate(reply); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const ask = () => f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal((await (await ask()).json()).question, "The objective type should be Personal development.");
    reply = { question: "Would you like to change it in the editor?", recommendedKind: "personal-development" };
    assert.equal((await (await ask()).json()).question, "Would you like to change it on the Objective step?");
  } finally { await f.close(); }
});

test("kind and type in ordinary test-mode questions stay ordinary", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "What kind of testing do you prefer? Choose normal." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context: { ...checkpoint, answers: [], kind: "normal" } });
    assert.equal((await response.json()).question, "What kind of testing do you prefer? Choose normal.");
  } finally { await f.close(); }
});

test("rephrased technical objectives preserve member-supplied kind and normal", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ objective: "Update API payloads by setting `kind` to normal for every client.", assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Update API payloads to set `kind` to normal for all clients.", objective: "", answers: [], kind: "personal-development" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Update API payloads by setting `kind` to normal for every client.");
  } finally { await f.close(); }
});

test("rephrased goals preserve a member's normal deployment mode", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ goal: "Verify normal is selected for production deployments" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...activeCheckpoint, action: "Check normal is selected for production deployments" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context });
    assert.equal((await response.json()).goal, `By ${activeDate}, Verify normal is selected for production deployments`);
  } finally { await f.close(); }
});

test("member-supplied unquoted API fields survive a rewritten objective", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ objective: "Preserve kind: normal in API payloads for all clients.", assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Update API payloads that contain kind: normal.", objective: "", answers: [], kind: "personal-development" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Preserve kind: normal in API payloads for all clients.");
  } finally { await f.close(); }
});

test("rephrased technical kind and normal remain unchanged in a suggested objective", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) {
    return validate({ objective: "Ensure kind is normal", assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
    } });
  } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Ensure that the `kind` field is normal for API clients.", objective: "", answers: [], kind: "personal-development" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Ensure kind is normal");
  } finally { await f.close(); }
});

test("ordinary normal objectives and technical kinds keep their meaning", async () => {
  let suggestion: Record<string, unknown> = { question: "Your objective is normal and clear." };
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate(suggestion); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    let context = { ...checkpoint, work: "Keep the test kind normal for deployments.", objective: "", answers: [] };
    let response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).question, "Your objective is normal and clear.");
    suggestion = { objective: "Ensure the test kind is normal before each deployment", assessment: {
      purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
    } };
    response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Ensure the test kind is normal before each deployment");
    context = { ...context, work: "Update the kind property in our API requests." };
    suggestion = { ...suggestion, objective: "Update the `kind` property for API requests." };
    response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Update the `kind` property for API requests.");
  } finally { await f.close(); }
});

test("a selected objective type is translated even when work mentions normal hours", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "normal is currently selected", recommendedKind: "personal-development" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Learn Playwright during normal working hours.", answers: [], kind: "normal" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).question, "Contribution is currently selected");
  } finally { await f.close(); }
});

test("technical kind and normal remain intact in coach questions and feedback", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "The test kind is normal; how do you verify it?", concern: "Ensure kind is normal" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Maintain the normal test kind for deployments.", answers: [], kind: "normal" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    const result = await response.json();
    assert.equal(result.question, "The test kind is normal; how do you verify it?");
    assert.equal(result.concern, "Ensure kind is normal");
  } finally { await f.close(); }
});

test("the member's recommendedKind API field survives rephrasing", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ objective: "Update the recommendedKind field for every client.", assessment: {
    purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
  } }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Update API payloads containing recommendedKind.", objective: "", answers: [], kind: "personal-development" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Update the recommendedKind field for every client.");
  } finally { await f.close(); }
});

test("a normal deployment type is not changed to an objective type", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ objective: "Ensure the deployment type is normal before releases.", assessment: {
    purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
  } }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Keep deployment settings stable.", objective: "", answers: [], kind: "personal-development" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Ensure the deployment type is normal before releases.");
  } finally { await f.close(); }
});

test("the member's focus title protects its technical identifiers", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ objective: "Document the kind: normal payload for API clients.", assessment: {
    purpose: { status: "met", note: "Clear." }, people: { status: "met", note: "Clear." }, alignment: { status: "met", note: "Clear." },
  } }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, title: "Migrate kind: normal payloads", work: "Help API clients.", objective: "", answers: [], kind: "personal-development" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).objective, "Document the kind: normal payload for API clients.");
  } finally { await f.close(); }
});

test("a technical normal mode does not hide the coach's explicit objective-type label", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "Kind is currently normal; I recommend personal-development.", recommendedKind: "personal-development" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Check the normal mode of production deployments.", answers: [], kind: "normal" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).question, "Objective type is currently Contribution; I recommend Personal development.");
  } finally { await f.close(); }
});

test("a member's technical identifier does not hide an explicit recommended type", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "Kind is currently normal; I recommend personal-development.", recommendedKind: "personal-development" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Maintain personal-development scripts for trainers.", answers: [], kind: "normal" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).question, "Objective type is currently Contribution; I recommend Personal development.");
  } finally { await f.close(); }
});

test("a normal production mode remains intact in a rephrased goal", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ goal: "Ensure normal is selected for production deployments" }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...activeCheckpoint, action: "Use normal production mode for deployments" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context });
    assert.equal((await response.json()).goal, `By ${activeDate}, Ensure normal is selected for production deployments`);
  } finally { await f.close(); }
});

test("an explicit kind recommendation is translated even when the member names scripts", async () => {
  const coach: CoachProvider = { async suggest(_system, _context, validate) { return validate({ question: "The kind should be personal-development." }); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const context = { ...checkpoint, work: "Maintain personal-development scripts.", answers: [], kind: "normal" };
    const response = await f.request("member", "/api/coach/suggest", "POST", { stage: "clarify", context });
    assert.equal((await response.json()).question, "The objective type should be Personal development.");
  } finally { await f.close(); }
});
