import type {
  DiscoverPullRequests,
  PullRequestLookup,
} from './changelog-pr.js';
import type { PullLink } from '../shared/changelog.js';
import { signGitHubAppToken } from './github.js';

interface AppCredentials {
  appId: string;
  installationId: string;
  privateKey: string;
}
interface InstallationToken {
  token: string;
  expires_at: string;
}
interface Candidate {
  number: number;
  repository_url: string;
}
interface Pull {
  title: string;
  merged: boolean;
  merged_at: string | null;
  commits: number;
  user: { login: string } | null;
  base: { ref: string; repo: { default_branch: string } };
}

export function changelogGitHub(
  credentials: AppCredentials,
  transport: typeof fetch = fetch,
) {
  let token: InstallationToken | undefined;
  async function request<T>(
    path: string,
    bearer: string,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<T> {
    const response = await transport('https://api.github.com' + path, {
      method: body ? 'POST' : 'GET',
      redirect: 'error',
      signal,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + bearer,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401 && token?.token === bearer) token = undefined;
    if (!response.ok) throw new Error('GitHub request unavailable');
    return response.json() as Promise<T>;
  }

  let pending: Promise<string> | undefined;
  async function issue() {
    const jwt = await signGitHubAppToken(credentials);
    token = await request<InstallationToken>(
      '/app/installations/' + credentials.installationId + '/access_tokens',
      jwt,
      AbortSignal.timeout(10000),
      { permissions: { pull_requests: 'read', metadata: 'read' } },
    );
    if (!token?.token) throw new Error('GitHub credential unavailable');
    return token.token;
  }
  function authorize() {
    if (token && Date.parse(token.expires_at) > Date.now() + 60000)
      return Promise.resolve(token.token);
    return (pending ??= issue().finally(() => {
      pending = undefined;
    }));
  }
  function pullPath(repository: string, number: string) {
    if (
      !/^[\w.-]+$/.test(repository) ||
      /^\.{1,2}$/.test(repository) ||
      !/^[1-9]\d*$/.test(number)
    )
      throw new Error('Invalid pull request');
    return '/repos/JesusFilm/' + repository + '/pulls/' + number;
  }
  async function getPull(path: string, auth: string, signal: AbortSignal) {
    const pr = await request<Pull>(path, auth, signal);
    if (
      !pr.title?.trim() ||
      typeof pr.merged !== 'boolean' ||
      !pr.base?.ref ||
      !pr.base.repo?.default_branch
    )
      throw new Error('Incomplete pull request');
    return pr;
  }
  const pullRequest: PullRequestLookup = async (repository, number) => {
    const pr = await getPull(
      pullPath(repository, number),
      await authorize(),
      AbortSignal.timeout(10000),
    );
    return {
      title: pr.title,
      merged: pr.merged,
      base: pr.base.ref,
      defaultBranch: pr.base.repo.default_branch,
    };
  };

  const discoverPullRequests: DiscoverPullRequests = async (
    username,
    week,
    timeZone,
  ) => {
    const signal = AbortSignal.timeout(30000);
    const auth = await authorize();
    const start = Date.parse(week),
      end = start + 7 * 86400000;
    const day = (instant: number) =>
      new Date(instant).toISOString().slice(0, 10);
    const localDay = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // GitHub searches UTC dates. Include both boundary days before comparing local dates.
    const query =
      'org:JesusFilm is:pr is:merged merged:' +
      day(start - 86400000) +
      '..' +
      day(end);
    const links = new Map<string, PullLink>();
    const login = username.toLowerCase();
    let partial = false;
    async function inspect(item: Candidate) {
      const repository =
        /^https:\/\/api\.github\.com\/repos\/JesusFilm\/([\w.-]+)$/i.exec(
          item.repository_url,
        )?.[1];
      if (!repository) throw new Error('Unexpected repository');
      const path = pullPath(repository, String(item.number));
      const pr = await getPull(path, auth, signal);
      const mergedAt = Date.parse(pr.merged_at ?? '');
      if (!pr.merged || pr.base.ref !== pr.base.repo.default_branch) return;
      const mergedDay = localDay.format(mergedAt);
      if (mergedDay < week || mergedDay >= day(end)) return;
      let matches = pr.user?.login.toLowerCase() === login;
      if (!Number.isInteger(pr.commits) || pr.commits < 0)
        throw new Error('Missing commit count');
      // GitHub exposes at most 250 commits through the read-only PR interface.
      for (
        let offset = 0;
        !matches && offset < Math.min(pr.commits, 250);
        offset += 100
      ) {
        const commits = await request<
          {
            author: { login: string } | null;
            committer: { login: string } | null;
          }[]
        >(
          path + '/commits?per_page=100&page=' + (1 + offset / 100),
          auth,
          signal,
        );
        matches = commits.some(
          (commit) =>
            commit.author?.login.toLowerCase() === login ||
            commit.committer?.login.toLowerCase() === login,
        );
        if (!matches && commits.length < Math.min(100, pr.commits - offset))
          partial = true;
      }
      if (!matches && pr.commits > 250) partial = true;
      if (matches)
        return {
          url:
            'https://github.com/JesusFilm/' +
            repository +
            '/pull/' +
            item.number,
          title: pr.title,
        };
    }
    try {
      for (let page = 1; page <= 10; page++) {
        const params = new URLSearchParams({
          q: query,
          per_page: '100',
          page: String(page),
          sort: 'created',
          order: 'asc',
        });
        const batch = await request<{
          items: Candidate[];
          incomplete_results: boolean;
          total_count: number;
        }>('/search/issues?' + params, auth, signal);
        partial ||= batch.incomplete_results || batch.total_count > 1000;
        for (let i = 0; i < batch.items.length; i += 5) {
          signal.throwIfAborted();
          const results = await Promise.allSettled(
            batch.items.slice(i, i + 5).map(inspect),
          );
          for (const result of results) {
            if (result.status === 'rejected') partial = true;
            else if (result.value) links.set(result.value.url, result.value);
          }
        }
        if (page * 100 >= batch.total_count) break;
        if (batch.items.length < 100) {
          partial = true;
          break;
        }
      }
    } catch {
      if (!links.size) return { status: 'unavailable', links: [] };
      partial = true;
    }
    return {
      status: partial ? 'partial' : 'complete',
      links: [...links.values()],
    };
  };
  return { pullRequest, discoverPullRequests };
}
