import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFocus } from "./focus.js";

const focus = {
  title: "  Term one  ",
  start: "2026-01-01",
  end: "2026-03-31",
  sections: [{ kind: "normal", objective: "  Grow the team  ", goals: ["Hire two leads"] }],
};

test("focus text is tidied before saving", () => {
  const saved = validateFocus(focus);
  assert.equal(saved.title, "Term one");
  assert.equal(saved.sections[0]!.objective, "Grow the team");
});

test("a section cannot repeat a goal", () => {
  const repeated = { ...focus, sections: [{ kind: "normal", objective: "Grow", goals: ["Hire two leads", "Hire two leads"] }] };
  assert.throws(() => validateFocus(repeated), /repeated goal/);
});

test("a goal is saved trimmed", () => {
  const padded = { ...focus, sections: [{ kind: "normal", objective: "Grow the team", goals: ["  Hire two leads  "] }] };
  const saved = validateFocus(padded);
  assert.deepEqual(saved.sections[0]!.goals, ["Hire two leads"]);
});

test("repeats are rejected ignoring case", () => {
  const caseRepeat = { ...focus, sections: [{ kind: "normal", objective: "Grow", goals: ["Hire two leads", "hire two leads"] }] };
  assert.throws(() => validateFocus(caseRepeat), /repeated goal/);
});

test("repeats are rejected ignoring whitespace", () => {
  const whitespaceRepeat = { ...focus, sections: [{ kind: "normal", objective: "Grow", goals: ["Hire two leads", "Hire two leads "] }] };
  assert.throws(() => validateFocus(whitespaceRepeat), /repeated goal/);
});
