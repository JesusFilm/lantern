export type GitHubWorkKind = 'repository' | 'project' | 'issue';
export interface GitHubConnectionStatus { connected: boolean; account?: string; appName?: string; available: boolean; revision?: number; username?: string }
export interface GitHubProfile { username: string }
export interface GitHubWorkItem { id: string; kind: GitHubWorkKind; label: string; url: string; description?: string; repository?: string; state?: string; relevance?: string[] }
export interface GitHubWorkResults { items: GitHubWorkItem[]; next?: string; notice?: string }
export interface GitHubRepositoryChoice { fullName: string }
