import { AccessError } from './membership.js';

export type PullRequestLookup = (
  repository: string,
  number: string,
) => Promise<{
  title: string;
  merged: boolean;
  base: string;
  defaultBranch: string;
} | null>;

export async function verifyPullRequests(
  links: string[],
  lookup?: PullRequestLookup,
) {
  const requests = links.map((link) => {
    const match =
      /^https:\/\/github\.com\/JesusFilm\/([\w.-]+)\/pull\/([1-9]\d*)\/?$/i.exec(
        link,
      );
    if (!match || match[1] === '.' || match[1] === '..')
      throw new AccessError(400, 'Enter a Jesus Film GitHub pull request URL.');
    return { repository: match[1]!, number: match[2]! };
  });
  const verified = [];
  for (const { repository, number } of requests) {
    const pr = await lookup?.(repository, number).catch(() => undefined);
    if (pr === undefined)
      throw new AccessError(
        503,
        'GitHub verification is unavailable. Your entry is still open. Try again later.',
      );
    if (
      !pr ||
      pr.merged !== true ||
      !pr.defaultBranch ||
      pr.base !== pr.defaultBranch ||
      !pr.title?.trim()
    )
      throw new AccessError(
        400,
        'Every pull request must be verified as merged into its repository’s default branch.',
      );
    verified.push({
      url: 'https://github.com/JesusFilm/' + repository + '/pull/' + number,
      title: pr.title,
    });
  }
  return verified;
}
