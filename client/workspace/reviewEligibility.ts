import type { PositionFocus } from "../../shared/focus.js";

export function hasReviewableContribution(focus: PositionFocus) {
  return focus.sections.some(section =>
    section.kind === "normal" && section.objective.trim() && section.goals.some(goal => goal.trim()),
  );
}
