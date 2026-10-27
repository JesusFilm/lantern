import type { CoachCheckpoint, CoachSuggestion } from "../shared/coach.js";
import { AccessError } from "./membership.js";
export type CoachStage = "clarify" | "objective" | "actions" | "goal";
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
export function validateCheckpoint(value: unknown): CoachCheckpoint {
  const fail = (): never => {
    throw new AccessError(
      400,
      "Check the coaching fields and dates before saving.",
    );
  };
  if (!object(value) || JSON.stringify(value).length > 32000) return fail();
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
    value.answers.length > 3 ||
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
  for (const key of ["sectionIndex", "goalIndex", "sourceVersion"])
    if (
      value[key] !== undefined &&
      (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0)
    )
      return fail();
  return value as unknown as CoachCheckpoint;
}
export function validateSuggestion(
  stage: CoachStage,
  value: unknown,
  initiativeIds: string[],
): CoachSuggestion {
  const fail = (): never => {
    throw new Error("Invalid coach response");
  };
  if (!object(value)) return fail();
  const fields = ["question", "objective", "goal", "title", "concern"];
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
  if (value.suggestedDate !== undefined && !date(value.suggestedDate))
    return fail();
  if (
    stage === "clarify" &&
    !(value.ready === false ? value.question : value.objective)
  )
    return fail();
  if (
    (stage === "objective" && !value.objective) ||
    (stage === "actions" &&
      (!Array.isArray(value.actions) ||
        value.actions.length < 2 ||
        !date(value.suggestedDate))) ||
    (stage === "goal" && !value.goal)
  )
    return fail();
  const result = value as CoachSuggestion;
  if (result.initiativeIds?.some((id) => !initiativeIds.includes(id)))
    return fail();
  return result;
}
