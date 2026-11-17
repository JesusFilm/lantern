import type { CoachCheckpoint, CoachSuggestion } from "../../shared/coach.js";
import type { ObjectiveKind } from "../../shared/focus.js";
import { validateCheckpoint } from "../../server/coach-contract.js";
import type { Scenario } from "./scenarios.js";
import type {
  CoachCall,
  CoachStage,
  FlowStep,
  GoalPlan,
  Member,
  Outcome,
  Turn,
} from "./types.js";

/**
 * Replays the guided authoring flow in client/workspace/ObjectiveEditor.tsx on main:
 * Your work → up to three questions → Objective → Add SMART goal (actions → goal).
 * Check objective makes no model call. Update this module when that flow changes.
 */
export async function runCurrentFlow(
  scenario: Scenario,
  coach: CoachCall,
  member: Member,
  options: { retries?: number } = {},
): Promise<{ turns: Turn[]; outcome: Outcome }> {
  const retries = options.retries ?? 1;
  const turns: Turn[] = [];
  const focus = { ...scenario.focus, version: 3 };
  const edit = {
    text: scenario.existing?.objective ?? "",
    kind: (scenario.existing?.kind ?? "normal") as ObjectiveKind,
    initiatives: [] as string[],
    other: false,
    goals: [...(scenario.existing?.goals ?? [])],
  };
  let work = "",
    answers: CoachCheckpoint["answers"] = [],
    question = "",
    answer = "",
    choices: string[] = [];
  let plan = { actions: [] as string[], action: "", date: focus.end, text: "" };
  let recommendedKind: ObjectiveKind | undefined;
  let recommendedInitiatives: string[] = [];
  const plans: GoalPlan[] = [];

  // Mirrors ObjectiveEditor's context(); the server adds department direction.
  const context = (): CoachCheckpoint => ({
    entry: "work",
    step: 0,
    work,
    answers,
    question,
    answer,
    options: choices,
    objective: edit.text,
    kind: edit.kind,
    initiatives: [...edit.initiatives],
    other: edit.other,
    actions: plan.actions,
    action: plan.action,
    date: plan.date,
    goal: plan.text,
    siblings: edit.goals.slice(0, 12).map((g) => g.slice(0, 500)),
    title: focus.title,
    start: focus.start,
    end: focus.end,
    concern: "",
    sourceVersion: focus.version,
  });

  const outcome = (failure?: string): Outcome => ({
    completed: !failure,
    ...(failure ? { failure } : {}),
    objective: edit.text,
    kind: edit.kind,
    recommendedKind,
    initiatives: edit.initiatives,
    recommendedInitiatives,
    other: edit.other,
    goals: edit.goals,
    plans,
  });

  // A failed turn is retried like a member pressing Next again.
  async function ask(
    step: FlowStep,
    stage: CoachStage,
    input: CoachCheckpoint,
  ): Promise<CoachSuggestion | undefined> {
    try {
      validateCheckpoint(structuredClone(input));
    } catch {
      turns.push({ type: "coach", step, stage, context: input, ok: false, error: "request-rejected", elapsedMs: 0, attempts: [] });
      return undefined;
    }
    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await coach(stage, input);
      turns.push({ type: "coach", step, stage, context: input, ...result });
      if (result.ok && result.suggestion) return result.suggestion;
    }
    return undefined;
  }

  function chooseObjectiveFields() {
    if (scenario.typeChoice === "recommended") {
      if (recommendedKind) edit.kind = recommendedKind;
    } else if (scenario.typeChoice !== "keep") edit.kind = scenario.typeChoice;
    // Next requires an initiative or Other; the member accepts the recommendation.
    if (recommendedInitiatives.length) edit.initiatives = [...recommendedInitiatives];
    else edit.other = true;
    turns.push({
      type: "member",
      step: "objective",
      text: JSON.stringify({ kind: edit.kind, initiatives: edit.initiatives, other: edit.other }),
    });
  }

  if (scenario.existing) {
    edit.other = true;
    if (scenario.improvement?.trim()) {
      const result = await ask("refine", "objective", {
        ...context(),
        entry: "objective",
        concern: scenario.improvement,
      });
      if (!result) return { turns, outcome: outcome("coach unavailable") };
      // Refinement replaces the wording only; type and alignment stay as saved.
      if (result.objective) edit.text = result.objective;
      recommendedKind = result.recommendedKind;
      recommendedInitiatives = result.initiativeIds ?? [];
      if (scenario.typeChoice === "recommended" && recommendedKind) edit.kind = recommendedKind;
      else if (scenario.typeChoice !== "keep" && scenario.typeChoice !== "recommended")
        edit.kind = scenario.typeChoice;
    }
  } else {
    work = scenario.work ?? "";
    let step: "work" | "question" = "work";
    for (;;) {
      const nextAnswers = step === "question" ? [...answers, { question, answer }] : answers;
      const stage: CoachStage = nextAnswers.length >= 3 ? "objective" : "clarify";
      const result = await ask(step, stage, { ...context(), answers: nextAnswers });
      if (!result) return { turns, outcome: outcome("coach unavailable") };
      answers = nextAnswers;
      if (result.objective && result.ready !== false) {
        edit.text = result.objective;
        recommendedKind = result.recommendedKind;
        recommendedInitiatives = result.initiativeIds ?? [];
        break;
      }
      question = result.question ?? "Who benefits from this work?";
      choices = result.options ?? [];
      answer = await member.answer(question, choices);
      turns.push({ type: "member", step: "answer", text: answer });
      step = "question";
    }
    chooseObjectiveFields();
  }

  for (const choice of scenario.goals) {
    const suggested = await ask("actions", "actions", {
      ...context(),
      entry: "goal",
      actions: [],
      action: "",
      goal: "",
    });
    if (!suggested) return { turns, outcome: outcome("coach unavailable") };
    plan = {
      actions: suggested.actions ?? [],
      action: "",
      date: suggested.suggestedDate ?? focus.end,
      text: "",
    };
    const action =
      typeof choice.action === "number"
        ? (plan.actions[choice.action] ?? plan.actions[0] ?? "")
        : choice.action;
    const date = choice.date ?? plan.date;
    const record: GoalPlan = {
      actions: plan.actions,
      ...(suggested.suggestedDate ? { suggestedDate: suggested.suggestedDate } : {}),
      action,
      date,
      concerns: suggested.concern ? [suggested.concern] : [],
    };
    plans.push(record);
    plan = { ...plan, action, date };
    turns.push({ type: "member", step: "plan", text: JSON.stringify({ action, date }) });
    const written = await ask("goal", "goal", { ...context(), entry: "goal" });
    if (!written?.goal) return { turns, outcome: outcome("coach unavailable") };
    record.goal = written.goal;
    if (written.concern) record.concerns.push(written.concern);
    edit.goals.push(written.goal);
    plan = { actions: [], action: "", date: plan.date, text: "" };
  }
  return { turns, outcome: outcome() };
}
