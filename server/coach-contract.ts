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
const text = (v: unknown, max = 4000): v is string =>
  typeof v === "string" && v.length <= max;
const texts = (v: unknown, max = 6) =>
  Array.isArray(v) && v.length <= max && v.every((x) => text(x, 1000));
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
export function validateSuggestion(
  stage: CoachStage,
  value: unknown,
  initiativeIds: string[],
  redesigned = false,
): CoachSuggestion {
  const fail = (): never => {
    throw new Error("Invalid coach response");
  };
  if (!object(value)) return fail();
  // Optional empty strings carry no meaning; they are not a provider failure.
  if (redesigned) value = Object.fromEntries(Object.entries(value).filter(([key, item]) =>
    !["question", "objective", "goal", "title", "concern", "review", "suggestedDate", "recommendedKind"].includes(key) || typeof item !== "string" || item.trim()));
  if (!object(value)) return fail();
  const fields = ["question", "objective", "goal", "title", "concern", ...(redesigned ? ["review"] : [])];
  if (
    Object.keys(value).some(
      (k) =>
        ![
          ...fields,
          "ready",
          "options",
          "actions",
          "initiativeIds",
          "suggestedDate",
          "recommendedKind",
        ].includes(k),
    )
  )
    return fail();
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
  if (redesigned && value.ready === false && !value.question && !value.concern) return fail();
  if (redesigned && !value.question && !value.concern) {
    const output = stage === "actions" ? Array.isArray(value.actions) && value.actions.length > 0 && date(value.suggestedDate)
      : stage === "goal" ? value.goal : stage === "review" ? value.review : value.objective;
    if (!output) return fail();
  }
  const result = value as CoachSuggestion;
  if (result.initiativeIds?.some((id) => !initiativeIds.includes(id)))
    return fail();
  return result;
}
