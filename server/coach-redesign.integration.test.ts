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
    assert.match(system, /Express the useful change you intend to make, who it serves/);
    assert.match(system, /Do not force a numerical target just to make a goal look measurable/);
    assert.doesNotMatch(system, /Test 20 viewers|this viewer task/);
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
    for (const prefix of ["", "By 1 January 2027, ", "By January 1, 2027, ", "By 2027-01-01, ", "By 1st January 2027, ", "By January 1st, 2027, ",
      "By the end of March 2027, ", "By end of March 2027, ", "By March 2027, ", "By the end of Q1 2027, ", "By mid-January 2027, ",
      "By the end of 2027, ", "By mid-2027, ", "By early 2027, "]) {
      suppliedGoal = prefix + "review failure reports.";
      const goal = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: checkpoint })).json();
      assert.equal(goal.goal, "By 30 November 2026, review failure reports.");
    }
    suppliedGoal = "By reviewing reports from January 2026, identify recurring failures.";
    const goal = await (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: checkpoint })).json();
    assert.equal(goal.goal, "By 30 November 2026, " + suppliedGoal);
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
    assert.equal(result.assessment.people.status, "needs_attention");
    assert.deepEqual(calls.map(c => c.stage), ["objective", "review", "review"]);
    assert.equal(calls[2]!.context.objective, "asdf jkl");
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
    const ask = async (answer: string) => (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...checkpoint, answer, question: answer ? "What evidence will you record?" : "", answers: answer ? [{ question: "What evidence will you record?", answer }] : [] } })).json();
    assert.equal((await ask("")).question, "What evidence will you record?");
    const after = await ask("I'm not sure.");
    assert.equal(after.question, undefined);
    assert.match(after.concern, /how will you measure it/);
    // The member can't say how success will be shown; they still get an editable goal of their own action and date.
    assert.equal(after.goal, "By 30 November 2026, Review logs");
  } finally { await f.close(); }
});

test("a goal reply with only feedback still gives the member their action as a goal, without inventing evidence", async () => {
  let reply: Record<string, unknown> = { concern: "Evidence is missing for this action." };
  const coach: CoachProvider = { async suggest(_s, _c, validate) { return validate(reply); } };
  const f = await coachingFixture(coach, resolveFeatureConfig({ LANTERN_FEATURES: "coach=on,coach-redesign=on" }, "local"));
  try {
    const ask = async (context = {}) => (await f.request("member", "/api/coach/suggest", "POST", { stage: "goal", context: { ...checkpoint, ...context } })).json();
    assert.deepEqual(await ask(), { concern: "Evidence is missing for this action.", goal: "By 30 November 2026, Review logs" });
    // A coach-written goal is kept as written.
    reply = { goal: "Review logs and note recurring causes.", concern: "Consider who sees the notes." };
    assert.equal((await ask()).goal, "By 30 November 2026, Review logs and note recurring causes.");
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
