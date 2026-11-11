export interface Department { id: string; name: string; role: 'member' | 'career-lead' }
export interface SessionView {
  user: { id: string; email: string; name: string } | null;
  department?: Department;
  signInAvailable: boolean;
  localAccess?: boolean;
  coachAvailable?: boolean;
  /** Flagged features this account may see; see shared/features.ts. */
  features: string[];
}
export interface RegisteredUser {
  id: string; name: string; email: string;
  department: string | null;
  status: 'available' | 'member' | 'other-department' | 'former';
}
