import { validateSuggestion } from "../../server/coach-contract.js";
import { direction, initiativeName, type Scenario } from "./scenarios.js";
import type { CoachStage, CoachTurn, Transcript } from "./types.js";

const months = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Reads the "By 6 May 2027," prefix the prompt requires on goals. */
export function goalDate(goal: string): string | undefined {
  const match = /^\s*By\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(goal);
  if (!match) return undefined;
  const month = months.indexOf(match[2]!.toLowerCase());
  if (month < 0) return undefined;
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const terms = (text: string) =>
  new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3));

/** True when two questions share most of their meaningful words. */
export function similarQuestions(a: string, b: string) {
  const x = terms(a), y = terms(b);
  const shared = [...x].filter((w) => y.has(w)).length;
  const union = new Set([...x, ...y]).size;
  return union > 0 && shared / union >= 0.6;
}

export interface Checks {
  completed: boolean;
  coachTurns: number;
  failedTurns: number;
  attempts: Record<string, number>;
  schemaCauses: Record<string, number>;
  fallbackTurns: number;
  latency: Array<{ step: string; ms: number }>;
  questions: number;
  repeatedQuestion: boolean;
  longQuestions: number;
  forcedObjective: boolean;
  kindMatch?: boolean;
  initiativesOk?: boolean;
  concernExpected: boolean;
  concernRaised: boolean;
  dateIssues: string[];
}

const ids = direction.initiatives.map((i) => i.id);
const valid = (stage: CoachStage, value: unknown, redesigned = false) => {
  try {
    validateSuggestion(stage, value, ids, redesigned);
    return true;
  } catch {
    return false;
  }
};

/** Explains why a parsed reply failed the shipped response contract. */
export function schemaCause(stage: CoachStage, content: string, redesigned = false): string {
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(content.replace(/<think>[\s\S]*?<\/think>/g, "").trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""));
  } catch {
    return "invalid JSON";
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return "not an object";
  if (!redesigned && stage === "goal" && !value.goal && typeof value.concern === "string" && value.concern.trim()) return "concern without goal";
  if (!redesigned && stage !== "clarify" && value.ready === false && typeof value.question === "string") return "question where a draft is required";
  if (value.recommendedKind !== undefined && !["normal", "personal-development", "leadership"].includes(String(value.recommendedKind)) && valid(stage, { ...value, recommendedKind: undefined }, redesigned))
    return "unknown objective type";
  const withoutEmpty = Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)),
  );
  if (valid(stage, withoutEmpty, redesigned)) return "empty or null optional field";
  const allowed = ["question", "objective", "goal", "title", "concern", "ready", "options", "actions", "initiativeIds", "suggestedDate", "recommendedKind", ...(redesigned ? ["review"] : [])];
  const known = Object.fromEntries(Object.entries(withoutEmpty).filter(([k]) => allowed.includes(k)));
  if (valid(stage, known, redesigned)) return "unexpected field";
  const trimmed = Object.fromEntries(Object.entries(known).map(([k, v]) => [k, Array.isArray(v) && k !== "initiativeIds" ? v.slice(0, 3) : v]));
  if (valid(stage, trimmed, redesigned)) return "more than three items";
  if (Array.isArray(trimmed.initiativeIds) && valid(stage, { ...trimmed, initiativeIds: trimmed.initiativeIds.filter((id) => ids.includes(String(id))) }, redesigned))
    return "unknown initiative";
  if (stage === "actions" && (!Array.isArray(trimmed.actions) || trimmed.actions.length < 2)) return "fewer than two actions";
  if (stage === "clarify" && trimmed.ready === false && !trimmed.question) return "not ready without a question";
  if (stage === "clarify" && trimmed.ready !== false && !trimmed.objective) return "ready without an objective";
  return "other";
}

export function checkTranscript(transcript: Transcript, scenario: Scenario, redesigned = false): Checks {
  const coach = transcript.turns.filter((t): t is CoachTurn => t.type === "coach");
  const attempts: Record<string, number> = {};
  const schemaCauses: Record<string, number> = {};
  for (const turn of coach)
    for (const attempt of turn.attempts) {
      attempts[attempt.outcome] = (attempts[attempt.outcome] ?? 0) + 1;
      if (attempt.outcome === "schema" || attempt.outcome === "unparseable") {
        const cause = attempt.content ? schemaCause(turn.stage, attempt.content, redesigned) : "no content";
        schemaCauses[cause] = (schemaCauses[cause] ?? 0) + 1;
      }
    }
  const succeeded = coach.filter((t) => t.ok);
  const questions = succeeded
    .filter((t) => (redesigned || t.suggestion?.ready === false) && t.suggestion?.question)
    .map((t) => t.suggestion!.question!);
  const objectiveTurn = succeeded.find((t) => (t.step === "work" || t.step === "question") && t.suggestion?.objective && t.suggestion.ready !== false);
  const { outcome } = transcript;
  const { start, end } = scenario.focus;
  const earliest = transcript.today > start ? transcript.today : start;
  const dateIssues: string[] = [];
  for (const plan of outcome.plans) {
    if (plan.suggestedDate && (plan.suggestedDate < earliest || plan.suggestedDate > end))
      dateIssues.push(`suggested ${plan.suggestedDate} outside ${earliest}..${end}`);
    const written = plan.goal ? goalDate(plan.goal) : undefined;
    if (plan.goal && written !== plan.date)
      dateIssues.push(`goal dated ${written ?? "(none)"} instead of ${plan.date}`);
  }
  const expected = scenario.expect.initiatives;
  const recommended = outcome.recommendedInitiatives.map(initiativeName);
  return {
    completed: outcome.completed,
    coachTurns: coach.length,
    failedTurns: coach.filter((t) => !t.ok).length,
    attempts,
    schemaCauses,
    fallbackTurns: succeeded.filter((t) => t.attempts.at(-1)?.route === "fallback" && t.attempts.some((a) => a.route === "primary")).length,
    latency: succeeded.map((t) => ({ step: t.step, ms: t.elapsedMs })),
    questions: questions.length,
    repeatedQuestion: questions.some((q, i) => questions.slice(0, i).some((p) => similarQuestions(p, q))),
    longQuestions: questions.filter((q) => words(q) > 25).length,
    forcedObjective: objectiveTurn?.stage === "objective",
    ...(scenario.expect.kind && outcome.completed ? { kindMatch: outcome.recommendedKind === scenario.expect.kind } : {}),
    ...(expected && outcome.completed
      ? {
          initiativesOk: expected.length
            ? recommended.length > 0 && recommended.every((name) => expected.includes(name))
            : recommended.length === 0,
        }
      : {}),
    concernExpected: !!scenario.expect.concern,
    concernRaised: outcome.plans.some((plan) => plan.concerns.length > 0) || (redesigned && succeeded.some(t => !!t.suggestion?.concern)),
    dateIssues,
  };
}
