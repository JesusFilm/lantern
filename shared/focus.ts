import type { InitiativeAppearance } from "./initiative-appearance.js";

export interface ObjectiveAlignment {
  initiatives: Array<{ id: string; name: string; appearance?: InitiativeAppearance }>;
  other: boolean;
}
export type ObjectiveKind = "normal" | "personal-development" | "leadership";
export interface FocusSection {
  kind: ObjectiveKind;
  objective: string;
  goals: string[];
  alignment?: ObjectiveAlignment;
}
// Member intent contains no historical labels or appearance.
export interface ObjectiveAlignmentChoice {
  initiatives: Array<{ id: string }>;
  other: boolean;
}
export interface FocusDraftSection extends Omit<FocusSection, "alignment"> {
  alignment?: ObjectiveAlignmentChoice;
}
export interface FocusDraft {
  title: string;
  start: string;
  end: string;
  sections: FocusDraftSection[];
}
export interface PositionFocus extends Omit<FocusDraft, "sections"> {
  sections: FocusSection[];
  id: string;
  version: number;
  updatedAt: string;
  status: "draft" | "confirmed";
  confirmedAt: string | null;
  confirmedBy: { id: string; name: string } | null;
}

export interface FocusMember {
  id: string;
  name: string;
  email: string;
}
export interface MemberFocusList {
  member: FocusMember;
  focuses: PositionFocus[];
}
export interface MemberFocusDetail {
  member: FocusMember;
  focus: PositionFocus;
}
