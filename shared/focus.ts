export type ObjectiveKind = "normal" | "personal-development" | "leadership";
export interface FocusSection {
  kind: ObjectiveKind;
  objective: string;
  goals: string[];
}
export interface FocusDraft {
  title: string;
  start: string;
  end: string;
  sections: FocusSection[];
}
export interface PositionFocus extends FocusDraft {
  id: string;
  version: number;
  updatedAt: string;
}
