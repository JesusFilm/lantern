// Private coaching input and submitted review documents have separate visibility.
import type { FocusDraft, PositionFocus, ObjectiveKind } from "./focus.js";
export interface CoachCheckpoint {
  entry?: "work" | "objective" | "goal";
  kind?: ObjectiveKind;
  recommendedKind?: ObjectiveKind;
  adding?: boolean;
  siblings?: string[];
  revision?: number;
  step: number;
  sectionIndex?: number;
  goalIndex?: number;
  answer?: string;
  other?: boolean;
  sourceVersion?: number;
  work: string;
  answers: Array<{ question: string; answer: string }>;
  question: string;
  options: string[];
  objective: string;
  initiatives: string[];
  actions: string[];
  action: string;
  date: string;
  goal: string;
  title: string;
  start: string;
  end: string;
  concern: string;
}
export interface CoachSuggestion {
  recommendedKind?: ObjectiveKind;
  ready?: boolean;
  question?: string;
  options?: string[];
  objective?: string;
  initiativeIds?: string[];
  actions?: string[];
  suggestedDate?: string;
  goal?: string;
  title?: string;
  concern?: string;
}
export interface CoachRequest {
  id: string;
  at: string;
  document: PositionFocus;
}
export interface CoachNote {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  requestVersion: number;
}
export interface CoachRecord {
  focus: PositionFocus;
  memberName: string;
  checkpoint: CoachCheckpoint | null;
  requests: CoachRequest[];
  notes: CoachNote[];
  readIds: string[];
}
export interface CoachSave {
  id?: string;
  version?: number;
  draft: FocusDraft;
  checkpoint: CoachCheckpoint;
}
