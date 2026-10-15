export interface Department { id: string; name: string; role: 'member' | 'career-lead' }
export interface SessionView {
  user: { id: string; email: string; name: string } | null;
  department?: Department;
  signInAvailable: boolean;
  localAccess?: boolean;
}
export interface RegisteredUser {
  id: string; name: string; email: string;
  department: string | null;
  status: 'available' | 'member' | 'other-department' | 'former';
}
