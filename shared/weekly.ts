export type GoalVisibility = 'team' | 'lead' | 'private';
export interface FocusWorkTarget {version: number; section: number; goal: number | null}
export interface SavedFocusWorkTarget extends FocusWorkTarget {objective: string; goalText?: string}
export type ExternalWorkKind = 'project' | 'repository' | 'issue' | 'other';
export type WeeklyGoalLinkDraft =
  | { kind: 'focus'; focusId: string; target?: FocusWorkTarget }
  | { kind: ExternalWorkKind; label: string; url: string };
export type WeeklyGoalLink =
  | { kind: 'focus'; focusId: string; title: string; target?: SavedFocusWorkTarget }
  | { kind: ExternalWorkKind; label: string; url: string };
export const maxWeeklyGoalDescriptionLength = 20_000;
export interface WeeklyGoalDraft { id?: string; text: string; visibility?: GoalVisibility; description?: string; completed?: boolean; links: WeeklyGoalLinkDraft[] }
export interface WeeklyGoal { id: string; text: string; visibility?: GoalVisibility; description?: string; completed?: boolean; links: WeeklyGoalLink[] }
export interface WeeklyPlan {
  version: number;
  goals: WeeklyGoal[];
  createdAt: string;
}
export interface DailyUpdate {
  id: string;
  date: string;
  body: string;
  planVersion: number;
  goalStatuses: DailyGoalStatus[];
  createdAt: string;
}
export interface WeekRecord {
  week: string;
  plans: WeeklyPlan[];
  updates: DailyUpdate[];
}
export interface WeeklyPlanDraft { version: number; goals: WeeklyGoalDraft[] }
export const dailyGoalStatuses = ['on-track', 'at-risk', 'blocked', 'done'] as const;
export type GoalStatus = typeof dailyGoalStatuses[number];
export const goalStatusLabels: Record<GoalStatus, string> = { 'on-track': 'On track', 'at-risk': 'At risk', blocked: 'Blocked', done: 'Done' };
export interface DailyGoalStatus { goalId: string; status: GoalStatus }
export interface DailyUpdateDraft { date: string; body: string; planVersion: number; goalStatuses: DailyGoalStatus[] }

export interface WeeklyRange { firstWeek: string | null }

export interface TeamDayMember {
  id: string;
  name: string;
  githubUsername: string | null;
  goals: WeeklyGoal[];
  update: DailyUpdate | null;
}
export interface TeamDay {
  date: string;
  firstDate: string | null;
  members: TeamDayMember[];
}

export interface FocusWeeklyWork {items: Array<{week:string;goal:WeeklyGoal;target?:SavedFocusWorkTarget;status?:GoalStatus}>}
