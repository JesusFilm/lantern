import { BookOpen, CircleDot, ExternalLink, FolderKanban, GitPullRequest, Target } from 'lucide-react';
import type { WeeklyGoalLinkDraft } from '../../shared/weekly.js';

const workIcons = { focus: Target, repository: BookOpen, project: FolderKanban, issue: CircleDot, other: ExternalLink };
const labels = { focus: 'Position focus', repository: 'Repository', project: 'Project', issue: 'Issue', other: 'Linked work' };

export function WorkLinkIcon({ link, size = 14 }: { link: WeeklyGoalLinkDraft; size?: number }) {
  const pullRequest = link.kind !== 'focus' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+(?:[/?#]|$)/.test(link.url);
  const Icon = pullRequest ? GitPullRequest : workIcons[link.kind];
  return <Icon size={size} aria-hidden="true"><title>{pullRequest ? 'Pull request' : labels[link.kind]}</title></Icon>;
}

export function workLinkLabel(link: Exclude<WeeklyGoalLinkDraft, { kind: 'focus' }>) {
  return link.kind === 'repository' ? link.label.replace(/^JesusFilm\//i, '') : link.label;
}
