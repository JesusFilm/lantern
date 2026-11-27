import { createPrivateKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { importPKCS8, SignJWT } from 'jose';
import type { GitHubConnectionStatus, GitHubWorkItem, GitHubWorkKind, GitHubWorkResults } from '../shared/github.js';
import { AccessError } from './membership.js';

type Credentials = { ownerId: string; departmentId: string; appId: number; privateKey: string; slug: string; installationId?: number; account?: string; accountType?: string; connectedAt?: number };
type Repository = { id: number; node_id: string; full_name: string; html_url: string; description: string | null; pushed_at: string };
type PageInfo = { hasNextPage: boolean; endCursor: string };
type Project = { id: string; title: string; url: string; shortDescription: string; closed: boolean; repositories: { nodes: { nameWithOwner: string }[] } };
export interface GitHubConnection {
  status(department: string): Promise<GitHubConnectionStatus>;
  connect(department: string, state: string): Promise<{ url: string }>;
  setup(department: string, state: string, organization: string): Promise<{ url: string; manifest: string }>;
  register(department: string, code: string, state: string): Promise<string>;
  install(department: string, id: number): Promise<void>;
  repositories(department: string): Promise<Repository[]>;
  search(department: string, kind: GitHubWorkKind, query: string, repository: string, cursor: string, includeClosed: boolean, username?: string): Promise<GitHubWorkResults>;
}

export async function signGitHubAppToken(saved: { privateKey: string; appId: number | string }) {
  const pem = createPrivateKey(saved.privateKey).export({ type: 'pkcs8', format: 'pem' }).toString();
  const key = await importPKCS8(pem, 'RS256');
  return new SignJWT({}).setProtectedHeader({ alg: 'RS256' }).setIssuer(String(saved.appId))
    .setIssuedAt(Math.floor(Date.now() / 1000) - 60).setExpirationTime('9m').sign(key);
}

/** Development's explicitly configured local member owns this installation.
 * Private keys stay in an owner-only file outside the checkout; installation
 * tokens stay in memory and never cross the HTTP interface. */
export function localGitHubApp(ownerId: string, origin: string, file: string, transport: typeof fetch = fetch): GitHubConnection {
  let credentials: Credentials | undefined;
  let token: { value: string; expires: number } | undefined;
  let inventory: { items: Repository[]; expires: number } | undefined;
  type PersonalWork = { repositories: Map<string, Set<string>>; projects: Map<string, GitHubWorkItem>; notices: string[] };
  const projectInventory = new Map<string, { expires: number; value: Promise<Project[]> }>();
  const personal = new Map<string, { expires: number; value: Promise<PersonalWork> }>();
  async function load(departmentId: string) {
    if (!credentials) {
      try {
        const saved: Credentials = JSON.parse(await readFile(file, 'utf8'));
        if (saved.ownerId === ownerId) credentials = saved;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new AccessError(503, 'The GitHub connection could not be loaded.'); }
    }
    if (credentials && credentials.departmentId !== departmentId) throw new AccessError(409, 'Reconnect GitHub for your current department.');
    return credentials;
  }
  async function persist(value: Credentials) {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, JSON.stringify(value), { mode: 0o600 });
    credentials = value; token = undefined; inventory = undefined; personal.clear(); projectInventory.clear();
  }
  async function request<T>(path: string, authorization?: string, body?: unknown, signal = AbortSignal.timeout(15000)): Promise<T> {
    let response: Response;
    try {
      response = await transport('https://api.github.com' + path, { method: body === undefined ? 'GET' : 'POST', headers: {
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Lantern',
        ...(authorization ? { Authorization: 'Bearer ' + authorization } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
    } catch { throw new AccessError(503, 'GitHub is taking too long to respond. Try again.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 404) throw new AccessError(409, 'This GitHub connection is unavailable. Reconnect and check the selected repositories.');
      if (response.status === 403 || response.status === 429) throw new AccessError(503, 'GitHub could not provide access. Check the app permissions or try again shortly.');
      throw new AccessError(503, 'GitHub could not complete this request. Try again.');
    }
    return response.json() as Promise<T>;
  }
  async function installed(department: string) {
    const saved = await load(department);
    if (!saved?.installationId) throw new AccessError(409, 'Connect GitHub to browse your work.');
    if (!token || token.expires < Date.now() + 60000) {
      const issued = await request<{ token: string; expires_at: string }>(`/app/installations/${saved.installationId}/access_tokens`, await signGitHubAppToken(saved), {});
      token = { value: issued.token, expires: Date.parse(issued.expires_at) };
    }
    return { saved, authorization: token.value };
  }
  async function repositories(department: string) {
    const { authorization } = await installed(department);
    if (inventory && inventory.expires > Date.now()) return inventory.items;
    const signal = AbortSignal.timeout(20000), items: Repository[] = [];
    for (let page = 1; ; page++) {
      const result = await request<{ repositories: Repository[]; total_count: number }>(`/installation/repositories?per_page=100&page=${page}`, authorization, undefined, signal);
      items.push(...result.repositories);
      if (items.length >= result.total_count || !result.repositories.length) break;
    }
    items.sort((a, b) => (b.pushed_at ?? '').localeCompare(a.pushed_at ?? ''));
    inventory = { items, expires: Date.now() + 60000 };
    return items;
  }
  async function matchingProjects(department: string, query: string): Promise<Project[]> {
    const key = department + ':' + query;
    const cached = projectInventory.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const value = (async () => {
      const { saved, authorization } = await installed(department);
      const ownerType = saved.accountType === 'Organization' ? 'organization' : 'user';
      const document = `query($owner:String!,$search:String!,$after:String){${ownerType}(login:$owner){projectsV2(first:100,query:$search,after:$after){nodes{id title url shortDescription closed repositories(first:100){nodes{nameWithOwner}}}pageInfo{hasNextPage endCursor}}}}`;
      const items: Project[] = [], signal = AbortSignal.timeout(20000);
      let cursor: string | null = null;
      do {
        const response: { data?: Record<string, { projectsV2: { nodes: Project[]; pageInfo: PageInfo } }>; errors?: unknown[] } = await request('/graphql', authorization,
          { query: document, variables: { owner: saved.account, search: query, after: cursor } }, signal);
        if (response.errors?.length || !response.data?.[ownerType]) throw new AccessError(503, 'Projects are unavailable. Your GitHub App may need approval to read organization projects.');
        const page = response.data[ownerType]!.projectsV2;
        items.push(...page.nodes);
        cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      } while (cursor);
      return items;
    })();
    if (projectInventory.size >= 30) projectInventory.delete(projectInventory.keys().next().value!);
    projectInventory.set(key, { expires: Date.now() + 60000, value });
    value.catch(() => { if (projectInventory.get(key)?.value === value) projectInventory.delete(key); });
    return value;
  }
  async function personalWork(department: string, username: string): Promise<PersonalWork> {
    const key = department + ':' + username.toLowerCase();
    const cached = personal.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const value = (async () => {
      const { saved, authorization } = await installed(department);
      const allowed = new Set((await repositories(department)).map(repo => repo.full_name.toLowerCase()));
      const scope = `${saved.accountType === 'Organization' ? 'org' : 'user'}:${saved.account}`;
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const result: PersonalWork = { repositories: new Map(), projects: new Map(), notices: [] };
      const addRepo = (name: string, reason: string) => {
        const key = name.toLowerCase();
        if (!allowed.has(key)) return;
        const reasons = result.repositories.get(key) ?? new Set();
        reasons.add(reason); result.repositories.set(key, reasons);
      };
      const projectQuery = `query($search:String!){search(query:$search,type:ISSUE,first:100){nodes{
        ... on Issue{projectItems(first:20){nodes{project{id title url shortDescription closed owner{... on Organization{login} ... on User{login}}}}}}
        ... on PullRequest{projectItems(first:20){nodes{project{id title url shortDescription closed owner{... on Organization{login} ... on User{login}}}}}}
      }}}`;
      type RelatedProject = { id: string; title: string; url: string; shortDescription: string; closed: boolean; owner: { login: string } };
      const signals = await Promise.allSettled([
        request<{ items: { repository_url: string; assignees: { login: string }[] }[] }>(`/search/issues?${new URLSearchParams({ q: scope + ' involves:' + username, per_page: '100', sort: 'updated', order: 'desc' })}`, authorization),
        request<{ items: { repository: { full_name: string } }[] }>(`/search/commits?${new URLSearchParams({ q: scope + ' author:' + username + ' committer-date:>=' + since, per_page: '100', sort: 'committer-date', order: 'desc' })}`, authorization),
        request<{ data?: { search: { nodes: { projectItems?: { nodes: { project: RelatedProject }[] } }[] } }; errors?: unknown[] }>('/graphql', authorization, { query: projectQuery, variables: { search: scope + ' involves:' + username } }),
      ]);
      const [issues, commits, projects] = signals;
      if (issues.status === 'fulfilled') for (const issue of issues.value.items)
        addRepo(issue.repository_url.replace('https://api.github.com/repos/', ''), issue.assignees.some(person => person.login.toLowerCase() === username.toLowerCase()) ? 'Assigned issues' : 'Mentioned or involved');
      else result.notices.push('Your issue activity is temporarily unavailable.');
      if (commits.status === 'fulfilled') for (const commit of commits.value.items) addRepo(commit.repository.full_name, 'Committed in the last 30 days');
      else result.notices.push('Recent commits could not be checked. The GitHub App may need read access to repository contents.');
      if (projects.status === 'fulfilled' && projects.value.data && !projects.value.errors?.length) {
        for (const node of projects.value.data.search.nodes) for (const { project } of node?.projectItems?.nodes ?? []) {
          if (project.owner.login.toLowerCase() !== saved.account?.toLowerCase()) continue;
          result.projects.set(project.id, { id: project.id, kind: 'project', label: project.title, url: project.url,
            description: project.shortDescription, state: project.closed ? 'Closed' : 'Open', relevance: ['Contains your issues or pull requests'] });
        }
      } else result.notices.push('Projects related to your issue activity could not be checked.');
      return result;
    })();
    // The department and username are part of the key; activity never crosses profiles.
    if (personal.size >= 100) personal.delete(personal.keys().next().value!);
    personal.set(key, { expires: Date.now() + 120000, value });
    value.catch(() => { if (personal.get(key)?.value === value) personal.delete(key); });
    return value;
  }
  return {
    async status(department) {
      const saved = await load(department);
      return { available: !!saved, connected: !!saved?.installationId, account: saved?.account, appName: saved?.slug, revision: saved?.connectedAt };
    },
    async connect(department, state) {
      const saved = await load(department);
      if (!saved) throw new AccessError(409, "Lantern's shared GitHub App has not been configured yet.");
      return { url: `https://github.com/apps/${encodeURIComponent(saved.slug)}/installations/new?state=${encodeURIComponent(state)}` };
    },
    async setup(department, state, organization) {
      if (await load(department)) throw new AccessError(409, 'The shared Lantern GitHub App is already registered.');
      const manifest = {
        name: 'Lantern', url: origin,
        redirect_url: origin + '/auth/github/app/callback', setup_url: origin + '/auth/github/app/setup',
        setup_on_update: true, public: false,
        hook_attributes: { url: origin + '/api/integrations/github/events', active: false },
        default_permissions: { metadata: 'read', issues: 'read', contents: 'read', organization_projects: 'read' },
        default_events: [], description: 'Link Lantern weekly goals to selected GitHub repositories, issues and projects.',
      };
      const setup = organization ? 'https://github.com/organizations/' + encodeURIComponent(organization) + '/settings/apps/new' : 'https://github.com/settings/apps/new';
      return { url: setup + '?state=' + encodeURIComponent(state), manifest: JSON.stringify(manifest) };
    },
    async register(department, code, state) {
      const app = await request<{ id: number; pem: string; slug: string }>('/app-manifests/' + encodeURIComponent(code) + '/conversions', undefined, {});
      await persist({ ownerId, departmentId: department, appId: app.id, privateKey: app.pem, slug: app.slug });
      return `https://github.com/apps/${encodeURIComponent(app.slug)}/installations/new?state=${encodeURIComponent(state)}`;
    },
    async install(department, id) {
      const saved = await load(department);
      if (!saved) throw new AccessError(409, 'Create the GitHub App before connecting it.');
      const installation = await request<{ account: { login: string; type: string }; permissions: Record<string, string> }>(`/app/installations/${id}`, await signGitHubAppToken(saved));
      if (installation.permissions.issues !== 'read' && installation.permissions.issues !== 'write') throw new AccessError(409, 'Allow the GitHub App to read issues before connecting it.');
      await persist({ ...saved, installationId: id, account: installation.account.login, accountType: installation.account.type, connectedAt: Date.now() });
    },
    repositories,
    async search(department, kind, query, repository, cursor, includeClosed, username) {
      const { saved, authorization } = await installed(department);
      const related = username ? await personalWork(department, username).catch(() => undefined) : undefined;
      let notice = related?.notices.join(' ') || (username && !related ? 'Personalised ordering is temporarily unavailable.' : undefined);
      if (kind === 'project') {
        const projects = await matchingProjects(department, query);
        const pinned = [...(related?.projects.values() ?? [])].filter(project => (includeClosed || project.state !== 'Closed') && (project.label + ' ' + (project.description ?? '')).toLowerCase().includes(query.toLowerCase()));
        const pinnedIds = new Set(pinned.map(project => project.id));
        const items: GitHubWorkItem[] = projects.filter(project => (includeClosed || !project.closed) && !pinnedIds.has(project.id)).map(project => ({ id: project.id, kind, label: project.title, url: project.url, description: project.shortDescription, state: project.closed ? 'Closed' : 'Open',
          ...(project.repositories.nodes.some(repo => related?.repositories.has(repo.nameWithOwner.toLowerCase())) ? { relevance: ['Linked to your active repositories'] } : {}) }));
        const ordered = [...pinned, ...items];
        ordered.sort((a, b) => Number(!!b.relevance?.length) - Number(!!a.relevance?.length));
        const start = Number(cursor || 0);
        return { items: ordered.slice(start, start + 20), next: start + 20 < ordered.length ? String(start + 20) : undefined, notice };
      }
      const repos = await repositories(department);
      if (kind === 'repository') {
        const matching = repos.filter(repo => [repo.full_name, repo.description ?? ''].join(' ').toLowerCase().includes(query.toLowerCase()));
        matching.sort((a, b) => Number(!!related?.repositories.has(b.full_name.toLowerCase())) - Number(!!related?.repositories.has(a.full_name.toLowerCase())));
        const start = Number(cursor || 0);
        return { items: matching.slice(start, start + 20).map(repo => ({ id: repo.node_id, kind, label: repo.full_name, url: repo.html_url, description: repo.description ?? undefined,
          relevance: [...(related?.repositories.get(repo.full_name.toLowerCase()) ?? [])] })), next: start + 20 < matching.length ? String(start + 20) : undefined, notice };
      }
      if (repository && !repos.some(repo => repo.full_name === repository)) throw new AccessError(400, 'Choose one of your connected repositories.');
      if (!repos.length) return { items: [] };
      const scope = repository ? 'repo:' + repository : `${saved.accountType === 'Organization' ? 'org' : 'user'}:${saved.account}`;
      const page = Number(cursor || 1);
      const q = [scope, 'is:issue', includeClosed ? '' : 'is:open', query].filter(Boolean).join(' ');
      const results = await request<{ items: { node_id: string; title: string; html_url: string; repository_url: string; state: string; number: number }[]; total_count: number }>(`/search/issues?${new URLSearchParams({ q, per_page: '20', page: String(page), sort: 'updated', order: 'desc' })}`, authorization);
      const allowed = new Set(repos.map(repo => repo.full_name));
      let personalIssues: typeof results.items = [];
      if (username) {
        try {
          const relevant = await request<typeof results>(`/search/issues?${new URLSearchParams({ q: q + ' involves:' + username, per_page: '100', sort: 'updated', order: 'desc' })}`, authorization);
          personalIssues = relevant.items;
        } catch { notice = [notice, 'Personal issue ordering is temporarily unavailable.'].filter(Boolean).join(' '); }
      }
      const personalIds = new Set(personalIssues.map(issue => issue.node_id));
      return { items: [...(!cursor ? personalIssues : []), ...results.items.filter(issue => !personalIds.has(issue.node_id))].flatMap(issue => {
        const fullName = issue.repository_url.replace('https://api.github.com/repos/', '');
        return allowed.has(fullName) ? [{ id: issue.node_id, kind, label: '#' + issue.number + ' ' + issue.title, url: issue.html_url, repository: fullName, state: issue.state,
          ...(personalIds.has(issue.node_id) ? { relevance: ['Assigned, mentioned or involved'] } : {}) }] : [];
      }), next: page * 20 < Math.min(results.total_count, 1000) ? String(page + 1) : undefined, notice };
    },
  };
}
