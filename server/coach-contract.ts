import type { CoachCheckpoint, CoachSuggestion } from "../shared/coach.js";
import { AccessError } from "./membership.js";
export type CoachStage = "clarify" | "objective" | "actions" | "goal" | "review";
export const date = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value >= "1900-01-01" &&
  value <= "9999-12-31" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
/** Translate schema terminology when it is used as an objective type label. */
type MemberTerms = { development: boolean; kind: boolean; normal: boolean; recommendedKind: boolean };
function memberFacingText(text: string, terms: MemberTerms, typeChoices = false, recommended = false, memberDraft = false): string {
  const typeContext = typeChoices || /personal[-_ ]development|\brecommendedKind\b|\bobjective\s+(?:type|kind)\b|\b(?:your|current|selected|recommended)\s+(?:kind|type)\b|\bkind\s*(?:is|was|:|=|currently|set to|should be|could be|might be)\s*(?:(?:currently|set to)\s*)?["'`]*(?:normal|Contribution|Personal development|Leadership)\b/i.test(text);
  const preserveTechnicalKind = terms.kind && terms.normal && (memberDraft || (!recommended && !/personal[-_ ]development|\brecommendedKind\b|\bobjective\s+(?:type|kind)\b/i.test(text)));
  let result = terms.development
    ? text.replace(/(\b(?:recommend|suggest|choose|select)\s+(?:the\s+)?["'`]*)(personal[-_]development)\b(?=["'`]*\s*(?:[.,;!?]|$|objective\b|type\b))/gi, "$1Personal development")
    : text.replace(/\bpersonal[-_]development\b/gi, "Personal development");
  if (terms.development) result = result.replace(/(\b(?:objective\s+type|kind|type)\s*(?:is|was|currently|set to|should be|could be|might be)\s*(?:(?:currently|set to)\s*)?["'`]*)(personal[-_]development)\b(?=["'`]*\s*(?:[.,;!?]|$))/gi, "$1Personal development");
  if (!terms.recommendedKind) result = result.replace(/\brecommendedKind\b/g, "recommended objective type");
  if (typeContext) result = result.replace(/(\bobjective\s+(?:is|was)\s*["'`]*)(normal)\b(?!\s+(?:for|in|when|at|during|under|with)\b)/gi, "$1Contribution");
  result = result.replace(/(\b(?:objective\s+type|kind|type)\s*(?:is|was|:|=|currently|set to)\s*(?:(?:currently|set to)\s*)?["'`]*)(normal)\b(?!\s+(?:for|in|when|at|during|under|with)\b)/gi,
    (match, prefix: string) => {
      if ((/^type\b/i.test(prefix) && !typeContext) || (terms.kind && /^kind\s*[:=]/i.test(prefix)) || (preserveTechnicalKind && /^kind\b/i.test(prefix))) return match;
      return prefix + "Contribution";
    });
  result = result.replace(/(\b(?:you\s+)?(?:chose|choose|select(?:ed)?|pick(?:ed)?)\s*["'`]*)(normal)\b(?=\s*(?:[.,;!?]|$|for\s+(?:the\s+)?objective\s+(?:type|kind)|(?:and|but)\s+I\s+(?:suggest|recommend)))/gi,
    (match, prefix: string) => typeContext ? prefix + "Contribution" : match);
  result = result.replace(/\bnormal(?=\s+objective\s+(?:kind|type)\b|\s+(?:is\s+)?(?:currently\s+)?selected\b)/gi,
    match => typeContext || recommended || !terms.normal ? "Contribution" : match);
  if (!terms.kind) result = result.replace(/`kind`/gi, "`Objective type`");
  result = result.replace(/\bkind(?=\s*(?:is|was|currently|set to|should be|could be|might be)\s*(?:(?:currently|set to)\s*)?["'`]*(?:Contribution|Personal development|Leadership)\b)/gi,
    match => match[0] === "K" ? "Objective type" : "objective type");
  if (!terms.kind) result = result.replace(/\bkind(?=\s*[:=])/gi, match => match[0] === "K" ? "Objective type" : "objective type");
  return result.replace(/\bin the editor\b/gi, match => typeContext || (recommended && /\bchange\s+(?:it|the type|your type)\s+in the editor\b/i.test(text)) ? "on the Objective step" : match);
}

/** Keep the machine-readable type unchanged while using the member's labels in prose. */
function memberFacingCoachText<T extends CoachSuggestion>(reply: T, context?: Partial<CoachCheckpoint>): T {
  const memberText = [context?.work, context?.objective, context?.action, context?.goal, context?.answer, context?.title,
    ...(context?.answers ?? []).map(answer => answer.answer), ...(context?.siblings ?? [])];
  const terms: MemberTerms = {
    development: memberText.some(own => /\bpersonal[-_]development\b/i.test(own ?? "")),
    recommendedKind: memberText.some(own => /\brecommendedKind\b/i.test(own ?? "")),
    kind: memberText.some(own => /\bkind\b/i.test(own ?? "")),
    normal: memberText.some(own => /\bnormal\b/i.test(own ?? "")),
  };
  const typeChoices = /\bobjective (?:type|kind)\b/i.test(reply.question ?? "") ||
    (!!reply.options && reply.options.length > 1 && reply.options.some(value => /^(personal[-_ ]development|leadership)$/i.test(value.trim())) &&
      reply.options.every(value => /^(normal|contribution|personal[-_ ]development|leadership)$/i.test(value.trim())));
  const draft = (value: string) => memberText.some(own => own?.trim() && own.trim() === value.trim()) ? value : memberFacingText(value, terms, false, false, true);
  const text = (value: string | undefined) => value === undefined ? undefined : memberFacingText(value, terms, typeChoices, !!reply.recommendedKind);
  const option = (value: string) => {
    if (typeChoices && value.trim().toLowerCase() === "normal") return "Contribution";
    if (typeChoices && value.trim().toLowerCase() === "leadership") return "Leadership";
    return typeChoices ? memberFacingText(value, { development: false, kind: false, normal: false, recommendedKind: false }) : draft(value);
  };
  const assessment = reply.assessment && {
    purpose: { ...reply.assessment.purpose, note: text(reply.assessment.purpose.note)! },
    people: { ...reply.assessment.people, note: text(reply.assessment.people.note)! },
    alignment: { ...reply.assessment.alignment, note: text(reply.assessment.alignment.note)! },
  };
  return {
    ...reply,
    ...(reply.question !== undefined && { question: text(reply.question) }),
    ...(reply.concern !== undefined && { concern: text(reply.concern) }),
    ...(reply.objective !== undefined && { objective: draft(reply.objective) }),
    ...(reply.goal !== undefined && { goal: draft(reply.goal) }),
    ...(reply.title !== undefined && { title: draft(reply.title) }),
    ...(reply.review !== undefined && { review: text(reply.review) }),
    ...(reply.options && { options: reply.options.map(option) }),
    ...(reply.actions && { actions: reply.actions.map(draft) }),
    ...(assessment && { assessment }),
  };
}

const text = (v: unknown, max = 4000): v is string =>
  typeof v === "string" && v.length <= max;
const texts = (v: unknown, max = 6) =>
  Array.isArray(v) && v.length <= max && v.every((x) => text(x, 1000));
// Match dates explicitly: Date.parse also accepts method phrases containing a date.
const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
const day = "\\d{1,2}(?:st|nd|rd|th)?";
// Lantern adds the selected date itself, so a model's own deadline phrase is removed first:
// exact dates, and month, quarter or year phrases such as "By the end of March 2027" or "By mid-2027".
const part = "(?:(?:the )?(?:end|start|beginning|middle) of |mid-?|early |late )";
const period = `(?:${part}?(?:${month}|Q[1-4]),? |${part})\\d{4}`;
const modelDeadline = new RegExp(`^By (?:\\d{4}-\\d{2}-\\d{2}|${day} ${month} \\d{4}|${month} ${day},? \\d{4}|${period}),\\s*`, "i");
/**
 * Prefixes a goal with the member-selected date, replacing any deadline phrase the
 * model wrote. Returns undefined when the date is invalid or no wording remains.
 */
export function datedGoal(text: string, selected: string): string | undefined {
  if (!date(selected)) return undefined;
  const action = text.trim().replace(modelDeadline, "");
  if (!action.trim()) return undefined;
  const label = new Date(selected + "T12:00:00Z").toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return 'By ' + label + ', ' + action;
}
export function validateCheckpoint(value: unknown, maxAnswers = 3, maxCharacters = 32000): CoachCheckpoint {
  const fail = (): never => {
    throw new AccessError(
      400,
      "Check the coaching fields and dates before saving.",
    );
  };
  if (!object(value)) return fail();
  if (JSON.stringify(value).length > maxCharacters) {
    if (maxCharacters > 32000) throw new AccessError(400, "This coaching context is too long. Shorten it or continue writing manually; your draft is unchanged.");
    return fail();
  }
  const fields = [
    "work",
    "question",
    "objective",
    "action",
    "goal",
    "title",
    "concern",
  ];
  const allowed = [
    ...fields,
    "step",
    "answers",
    "options",
    "initiatives",
    "actions",
    "date",
    "start",
    "end",
    "answer",
    "other",
    "sourceVersion",
    "sectionIndex",
    "goalIndex",
    "entry",
    "kind",
    "recommendedKind",
    "adding",
    "siblings",
    "revision",
  ];
  if (
    Object.keys(value).some((k) => !allowed.includes(k)) ||
    !Number.isInteger(value.step) ||
    Number(value.step) < 0 ||
    Number(value.step) > 7 ||
    fields.some((k) => !text(value[k], k === "title" ? 200 : 10000))
  )
    return fail();
  if (
    !Array.isArray(value.answers) ||
    value.answers.length > maxAnswers ||
    value.answers.some(
      (a) =>
        !object(a) ||
        Object.keys(a).some((k) => !["question", "answer"].includes(k)) ||
        !text(a.question, 1000) ||
        !text(a.answer, 4000),
    )
  )
    return fail();
  if (
    !texts(value.options) ||
    !texts(value.actions) ||
    !texts(value.initiatives, 100) ||
    !date(value.start) ||
    !date(value.end) ||
    value.start > value.end ||
    (value.date !== "" && !date(value.date))
  )
    return fail();
  if (
    (value.answer !== undefined && !text(value.answer, 4000)) ||
    (value.other !== undefined && typeof value.other !== "boolean")
  )
    return fail();
  if (
    (value.entry !== undefined &&
      !["work", "objective", "goal"].includes(String(value.entry))) ||
    (value.adding !== undefined && typeof value.adding !== "boolean") ||
    (value.siblings !== undefined &&
      (!Array.isArray(value.siblings) ||
        value.siblings.length > 100 ||
        value.siblings.some((v) => !text(v, 10000)))) ||
    [value.kind, value.recommendedKind].some(
      (v) =>
        v !== undefined &&
        !["normal", "personal-development", "leadership"].includes(String(v)),
    )
  )
    return fail();
  for (const key of ["sectionIndex", "goalIndex", "sourceVersion"])
    if (
      value[key] !== undefined &&
      (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0)
    )
      return fail();
  if (value.revision !== undefined && (typeof value.revision !== "string" || !/^[0-9a-f-]{36}$/.test(value.revision))) return fail();
  return value as unknown as CoachCheckpoint;
}
/**
 * A validated model reply. beneficiary is the model's quote of who the member said the work
 * serves ("" when they have not said); coachTurn checks it and never returns it to the client.
 */
export interface ModelSuggestion extends CoachSuggestion {
  beneficiary?: string;
}
export function validateSuggestion(
  stage: CoachStage,
  value: unknown,
  initiativeIds: string[],
  redesigned = false,
  context?: Pick<CoachCheckpoint, "date" | "end"> & Partial<Pick<CoachCheckpoint, "work" | "objective" | "action" | "goal" | "answer" | "title" | "answers" | "siblings">>,
): ModelSuggestion {
  const fail = (): never => {
    throw new Error("Invalid coach response");
  };
  if (!object(value)) return fail();
  // Optional empty strings carry no meaning; they are not a provider failure.
  if (redesigned) value = Object.fromEntries(Object.entries(value).filter(([key, item]) =>
    !["question", "objective", "goal", "title", "concern", "review", "suggestedDate", "recommendedKind"].includes(key) || typeof item !== "string" || item.trim()));
  if (!object(value)) return fail();
  const fields = ["question", "objective", "goal", "title", "concern", ...(redesigned ? ["review"] : [])];
  const known = [...fields, "ready", "options", "actions", "initiativeIds", "suggestedDate", "recommendedKind", ...(redesigned ? ["assessment", "beneficiary"] : [])];
  // The redesigned coach ignores echoed context fields such as kind; they are never returned.
  if (redesigned) value = Object.fromEntries(Object.entries(value).filter(([k]) => known.includes(k)));
  if (!object(value) || Object.keys(value).some((k) => !known.includes(k))) return fail();
  // An unusable beneficiary is treated as not supplied; it never discards a draft.
  if (value.beneficiary !== undefined && !text(value.beneficiary, 300)) delete value.beneficiary;
  if (value.assessment !== undefined) {
    const assessment = value.assessment;
    const valid = object(assessment) && Object.keys(assessment).length === 3 && ["purpose", "people", "alignment"].every(key => {
      const item = assessment[key];
      return object(item) && Object.keys(item).every(k => k === "status" || k === "note") &&
        ["met", "needs_attention", "uncertain"].includes(String(item.status)) && text(item.note, 500) && !!item.note.trim();
    });
    // A malformed optional assessment must never discard an otherwise usable draft.
    if (!valid) delete value.assessment;
  }
  if (
    fields.some(
      (k) =>
        value[k] !== undefined &&
        (!text(value[k], k === "title" ? 200 : 4000) ||
          !String(value[k]).trim()),
    )
  )
    return fail();
  if (value.ready !== undefined && typeof value.ready !== "boolean")
    return fail();
  for (const k of ["options", "actions", "initiativeIds"])
    if (
      value[k] !== undefined &&
      !texts(value[k], k === "initiativeIds" ? 100 : 3)
    )
      return fail();
  for (const key of ["options", "actions"] as const) {
    const choices = value[key] as string[] | undefined;
    if (choices && choices.some((choice) => !choice.trim())) return fail();
  }
  if (redesigned && context && Array.isArray(value.actions) && value.actions.length) value.suggestedDate = context.end;
  if (value.suggestedDate !== undefined && !date(value.suggestedDate))
    return fail();
  if (
    !redesigned && stage === "clarify" &&
    !(value.ready === false ? value.question : value.objective)
  )
    return fail();
  if (!redesigned && (
    (stage === "objective" && !value.objective) ||
    (stage === "actions" &&
      (!Array.isArray(value.actions) ||
        value.actions.length < 2 ||
        !date(value.suggestedDate))) ||
    (stage === "goal" && !value.goal)
  ))
    return fail();
  if (
    value.recommendedKind !== undefined &&
    !["normal", "personal-development", "leadership"].includes(
      String(value.recommendedKind),
    )
  )
    return fail();
  if (redesigned && value.ready === false && !value.question && !value.concern && !(stage === "review" && value.assessment)) return fail();
  if (redesigned && !value.question && !value.concern) {
    const output = stage === "actions" ? Array.isArray(value.actions) && value.actions.length > 0 && date(value.suggestedDate)
      : stage === "goal" ? value.goal : stage === "review" ? value.review || value.assessment : value.objective;
    if (!output) return fail();
  }
  const result = redesigned ? memberFacingCoachText(value as ModelSuggestion, context) : value as ModelSuggestion;
  // A review assesses supplied wording; it never rewrites it.
  if (redesigned && stage === "review") delete result.objective;
  if (redesigned && context && result.goal && date(context.date)) {
    const dated = datedGoal(result.goal, context.date);
    if (!dated) return fail();
    result.goal = dated;
  }
  if (result.initiativeIds?.some((id) => !initiativeIds.includes(id)))
    return fail();
  return result;
}
