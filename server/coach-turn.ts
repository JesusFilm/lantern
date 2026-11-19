import { coachContextLimits, type CoachCheckpoint, type CoachSuggestion } from "../shared/coach.js";
import type { DepartmentDirection } from "../shared/direction.js";
import { datedGoal, validateCheckpoint, validateSuggestion, type CoachStage } from "./coach-contract.js";
import { coachPrompt } from "./coach-prompt.js";
import type { CoachProvider } from "./coach-provider.js";

type Ask = (stage: CoachStage, context: CoachCheckpoint, signal?: AbortSignal) => Promise<CoachSuggestion>;

/** Sends one stage to the provider using the shipped prompt and response contract. */
export function providerAsk(provider: CoachProvider, direction: DepartmentDirection, enhanced: boolean): Ask {
  const ids = direction.initiatives.filter(i => !i.archived).map(i => i.id);
  return (stage, context, signal) => provider.suggest(
    coachPrompt(direction, enhanced, stage),
    JSON.stringify({ stage, context }),
    value => validateSuggestion(stage, value, ids, enhanced, context),
    signal,
  );
}

const allMet = (suggestion: CoachSuggestion) =>
  !!suggestion.assessment && Object.values(suggestion.assessment).every(check => check.status === "met");
const joined = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(" ") || undefined;
/** Beyond this, a first reply probably waited on a provider timeout, so no optional call follows. */
const retryWithinMs = 20000;

/**
 * One member-facing coaching turn. In redesigned drafting the coach asks at most once
 * before drafting; after the member has answered, remaining gaps become feedback on the
 * Objective screen. Every Objective screen gets checks of the exact wording it shows.
 * Optional follow-up steps never discard a usable draft; only cancellation stops the turn.
 */
export async function coachTurn(input: {
  ask: Ask;
  direction: DepartmentDirection;
  stage: CoachStage;
  context: CoachCheckpoint;
  enhanced: boolean;
  signal?: AbortSignal;
  /** Clock for the latency guard; injected by tests. */
  now?: () => number;
}): Promise<CoachSuggestion> {
  const { ask, direction, stage, context, enhanced, signal, now = Date.now } = input;
  const started = now();
  let suggestion = await ask(stage, context, signal);
  if (!enhanced) return suggestion;
  const optional = async (next: CoachStage, nextContext: CoachCheckpoint, tries = 1) => {
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        return await ask(next, validateCheckpoint(nextContext, coachContextLimits.answers, coachContextLimits.characters),
          AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)]));
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
  };
  if (stage === "actions" || stage === "goal") {
    // The member has answered this step's question: show any remaining gap instead of asking again.
    const asFeedback = (reply: CoachSuggestion) =>
      ({ ...reply, question: undefined, options: undefined, concern: joined(reply.concern, reply.question) });
    if (context.answer?.trim() && suggestion.question) suggestion = asFeedback(suggestion);
    if (stage === "actions" && !suggestion.question && !suggestion.actions?.length && now() - started < retryWithinMs) {
      // Feedback alone leaves the member nothing to choose: ask once more without the earlier question,
      // unless the first reply was already slow enough to risk a long wait.
      const retry = await optional("actions", { ...context, question: "", answer: "" });
      if (retry?.actions?.length) suggestion = { ...asFeedback(retry), concern: joined(suggestion.concern, retry.concern, retry.question) };
    }
    if (stage === "goal" && !suggestion.question && !suggestion.goal?.trim()) {
      // The member may not know how success will be shown. They still get an editable goal of
      // their own action and selected date, with the coach's feedback beside it.
      const goal = context.action?.trim() ? datedGoal(context.action, context.date ?? "") : undefined;
      if (goal) suggestion = { ...suggestion, goal, ready: undefined };
    }
    return suggestion;
  }
  const answered = context.answers.length > 0;
  const memberWording = context.objective.trim() || context.work;
  const drafted = (reply: CoachSuggestion) => !!reply.objective && reply.ready !== false && !reply.question;
  // The wording the editor will show, or undefined when it shows a question instead.
  let shown: string | undefined;
  if (stage === "clarify") {
    if (!answered && !drafted(suggestion) && !suggestion.question && suggestion.concern?.trim().endsWith("?"))
      // A first reply that only asks, phrased as a concern, is the coach's one question.
      suggestion = { ...suggestion, question: suggestion.concern, concern: undefined, objective: undefined, assessment: undefined };
    if (drafted(suggestion)) shown = suggestion.objective;
    else if (answered) {
      // After the member answers, the editor stops asking and shows a draft built from the answers.
      const draft = await optional("objective", { ...context, entry: "objective", objective: memberWording, question: "", answer: "" });
      if (draft && drafted(draft)) {
        suggestion = { ...draft, ready: true };
        shown = draft.objective;
      } else {
        suggestion = { ...suggestion, objective: undefined, assessment: undefined, question: undefined,
          concern: joined(suggestion.concern, suggestion.question, draft?.concern, draft?.question) };
        shown = memberWording;
      }
    } else if (!suggestion.question) {
      // The editor shows the member's own wording with the concern; checks of a discarded draft do not apply.
      suggestion = { ...suggestion, objective: undefined, assessment: undefined };
      shown = memberWording;
    }
  } else if (stage === "objective") {
    if (answered && suggestion.question && !drafted(suggestion))
      // Answering feedback never starts a chain of questions: show the gap on the Objective screen.
      suggestion = { ...suggestion, question: undefined, ready: undefined, objective: undefined, assessment: undefined,
        concern: joined(suggestion.concern, suggestion.question) };
    if (!suggestion.question) {
      if (suggestion.objective) shown = suggestion.objective;
      else {
        suggestion = { ...suggestion, assessment: undefined };
        shown = memberWording;
      }
    }
  }
  if (shown?.trim() && !suggestion.assessment) {
    for (let attempt = 0; attempt < 2 && !suggestion.assessment; attempt++) {
      const checked = await optional("review", { ...context, entry: "objective", objective: shown }, 2 - attempt);
      // A review never asks the member anything; an extra question does not invalidate its checks.
      if (checked?.assessment) suggestion = { ...suggestion, assessment: checked.assessment };
      else if (!checked) break;
    }
  }
  // With Not sure chosen, the coach's recommended type decides which lens applies.
  const kind = context.kind ?? suggestion.recommendedKind;
  if (suggestion.assessment && !direction.mission.trim() && kind !== "personal-development" && kind !== "leadership")
    suggestion = { ...suggestion, assessment: { ...suggestion.assessment, alignment: { status: "uncertain", note: "Your career lead has not configured a mission yet." } } };
  // Once every check is met, further refinements belong in SMART goals.
  if (allMet(suggestion) && suggestion.concern) suggestion = { ...suggestion, concern: undefined };
  return suggestion;
}
