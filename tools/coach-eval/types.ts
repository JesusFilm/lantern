import type { CoachCheckpoint, CoachSuggestion } from "../../shared/coach.js";
import type { ObjectiveKind } from "../../shared/focus.js";

export type CoachStage = "clarify" | "objective" | "actions" | "goal" | "review";

export type AttemptOutcome =
  | "ok"
  | "schema"
  | "unparseable"
  | "truncated"
  | "timeout"
  | "network"
  | `http-${number}`;

/** One HTTP request to a model provider within a coach turn. */
export interface Attempt {
  route: "primary" | "fallback";
  model: string;
  outcome: AttemptOutcome;
  elapsedMs: number;
  status?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  stopReason?: string;
  content?: string;
}

export type FlowStep = "work" | "question" | "refine" | "actions" | "goal" | "review";

export interface CoachTurn {
  type: "coach";
  step: FlowStep;
  stage: CoachStage;
  context: CoachCheckpoint;
  ok: boolean;
  suggestion?: CoachSuggestion;
  error?: string;
  elapsedMs: number;
  attempts: Attempt[];
}

export interface MemberTurn {
  type: "member";
  step: "answer" | "objective" | "plan";
  text: string;
}

export type Turn = CoachTurn | MemberTurn;

export interface GoalPlan {
  actions: string[];
  suggestedDate?: string;
  action: string;
  date: string;
  goal?: string;
  concerns: string[];
}

/** What the member sees on the Objective step after a coach reply. */
export interface ObjectiveScreen {
  objective: string;
  kind: ObjectiveKind;
  assessment?: CoachSuggestion["assessment"];
  concern: string;
}

export interface Outcome {
  completed: boolean;
  failure?: string;
  objective: string;
  kind: ObjectiveKind;
  recommendedKind?: ObjectiveKind;
  initiatives: string[];
  recommendedInitiatives: string[];
  other: boolean;
  goals: string[];
  plans: GoalPlan[];
  /** Objective screens in order; the last is what the member continues with. */
  screens?: ObjectiveScreen[];
}

export interface Transcript {
  flow?: "legacy" | "redesigned";
  scenario: string;
  target: string;
  repeat: number;
  today: string;
  startedAt: string;
  durationMs: number;
  turns: Turn[];
  outcome: Outcome;
}

export type CoachCall = (
  stage: CoachStage,
  context: CoachCheckpoint,
) => Promise<Omit<CoachTurn, "type" | "step" | "stage" | "context">>;

export interface Member {
  answer(question: string, options: string[]): Promise<string>;
  /** Answers AI coach feedback; undefined when the member has nothing to add. */
  respond?(feedback: string): Promise<string | undefined>;
}
