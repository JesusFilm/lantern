export type ProgressStatus = 'in-progress' | 'achieved' | 'needs-attention';
export interface ProgressTarget { section: number; goal: number | null }
export interface ProgressNote extends ProgressTarget { body: string; createdAt: string; revision: string }
export interface ProgressRecord { statuses: Array<ProgressTarget & {status: ProgressStatus | null; revision: string}>; notes: ProgressNote[] }
