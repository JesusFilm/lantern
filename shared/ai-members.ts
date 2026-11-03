export interface AiMemberFocusContent { objective: string; goals: string[] }
export interface AiMemberFocus extends AiMemberFocusContent { version: number; updatedAt: string }
export interface AiMemberProfile {
  id: string; name: string; purpose: string; profileRevision: number;
  createdAt: string; updatedAt: string; lastRetrievedAt: string | null; lastRetrievedVersion: number | null;
}
export interface AiMemberToken {
  id: string; name: string; suffix: string; credentialRevision: number; createdAt: string; rotatedAt: string;
}
export interface AiMemberDetail extends AiMemberProfile { focus: AiMemberFocus | null; tokens: AiMemberToken[] }
export interface AiMemberFocusResponse { member: { id: string; name: string }; focus: AiMemberFocus }
