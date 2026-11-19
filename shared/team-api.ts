export interface TeamAPIToken { id:string; name:string; createdAt:string; expiresAt:string }
export interface CreatedTeamAPIToken extends TeamAPIToken { token:string }
