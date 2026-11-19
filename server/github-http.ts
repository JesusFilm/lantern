import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import type { Pool } from 'pg';
import type { GitHubWorkKind } from '../shared/github.js';
import type { GitHubConnection } from './github.js';
import { requireFeature, type FeatureConfig } from './features.js';
import { AccessError, membership } from './membership.js';
import { githubProfileStore } from './github-profile.js';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function githubRoutes(db: Pool, requireUser: (request: Request) => Promise<{ id: string; email: string }>, features: FeatureConfig,
  origin: string, connection?: { ownerId: string; source: GitHubConnection }) {
  const router = Router();
  const profiles = githubProfileStore(db);
  const flows = new Map<string, { userId: string; department: string; expires: number; phase: 'create' | 'install' }>();
  const cookieName = origin.startsWith('https:') ? '__Host-lantern-github' : 'lantern-github';
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: origin.startsWith('https:'), path: '/', maxAge: 20 * 60000 };
  async function actor(req: Request) {
    const user = await requireUser(req);
    requireFeature(features, 'weekly-updates', user.email);
    const department = await membership(db, user.id);
    if (!department) throw new AccessError(403, 'Active department membership is required.');
    return { user, department: department.id, role: department.role };
  }
  async function connectedActor(req: Request) {
    const access = await actor(req);
    if (!connection) throw new AccessError(409, 'GitHub App setup is not available for this account yet.');
    return { ...access, source: connection.source };
  }
  function verifyFlow(req: Request, userId: string, department: string, phase: 'create' | 'install') {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const cookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    const flow = flows.get(state);
    if (!flow || cookie !== state || flow.expires < Date.now() || flow.userId !== userId || flow.department !== department || flow.phase !== phase)
      throw new AccessError(400, 'This GitHub connection attempt expired. Close this window and try Connect GitHub again.');
    flows.delete(state);
    return flow;
  }
  router.get('/api/integrations/github', async (req, res) => {
    const { user, department } = await actor(req);
    const status = connection ? await connection.source.status(department) : { connected: false, available: false };
    res.json({ ...status, ...(await profiles.get(user.id)) });
  });
  router.get('/api/integrations/github/profile', async (req, res) => {
    const { user } = await actor(req);
    res.json(await profiles.get(user.id));
  });
  router.patch('/api/integrations/github/profile', async (req, res) => {
    const { user } = await actor(req);
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).some(key => key !== 'username') || typeof req.body.username !== 'string')
      throw new AccessError(400, 'Supply your GitHub username.');
    res.json(await profiles.save(user.id, req.body.username.trim().replace(/^@/, '')));
  });
  router.get('/api/integrations/github/repositories', async (req, res) => {
    const { source, department } = await connectedActor(req);
    res.json((await source.repositories(department)).map(repo => ({ fullName: repo.full_name })));
  });
  router.get('/api/integrations/github/search', async (req, res) => {
    const { source, department, user } = await connectedActor(req);
    const { kind, q = '', repository = '', cursor = '', closed = 'false' } = req.query;
    if (!['repository', 'project', 'issue'].includes(String(kind)) || typeof q !== 'string' || q.length > 200
      || typeof repository !== 'string' || repository.length > 200 || typeof cursor !== 'string' || cursor.length > 256
      || !['true', 'false'].includes(String(closed)) || (cursor && !/^\d{1,5}$/.test(cursor)))
      throw new AccessError(400, 'Choose a GitHub work type and a search up to 200 characters.');
    const { username } = await profiles.get(user.id);
    res.json(await source.search(department, kind as GitHubWorkKind, q.trim(), repository, cursor, closed === 'true', username));
  });
  router.get('/auth/github/connect', async (req, res) => {
    const { source, user, department, role } = await connectedActor(req);
    if (connection?.ownerId !== user.id && role !== 'career-lead') throw new AccessError(403, 'Ask your career lead to connect the team GitHub installation.');
    for (const [key, flow] of flows) if (flow.expires < Date.now()) flows.delete(key);
    const state = randomBytes(32).toString('hex');
    const start = await source.connect(department, state);
    flows.set(state, { userId: user.id, department, expires: Date.now() + cookieOptions.maxAge, phase: 'install' });
    res.cookie(cookieName, state, cookieOptions).redirect(start.url);
  });
  router.get('/auth/github/admin/create', async (req, res) => {
    const { source, user, department } = await connectedActor(req);
    if (connection?.ownerId !== user.id) throw new AccessError(403, 'Only the Lantern administrator can register the shared GitHub App.');
    for (const [key, flow] of flows) if (flow.expires < Date.now()) flows.delete(key);
    const state = randomBytes(32).toString('hex');
    const organization = typeof req.query.organization === 'string' ? req.query.organization.trim() : '';
    if (organization && !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(organization)) throw new AccessError(400, 'Enter a GitHub organization name.');
    const start = await source.setup(department, state, organization);
    flows.set(state, { userId: user.id, department, expires: Date.now() + cookieOptions.maxAge, phase: 'create' });
    res.cookie(cookieName, state, cookieOptions);
    res.set('Content-Security-Policy', "default-src 'none'; form-action https://github.com; style-src 'unsafe-inline'");
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Lantern to GitHub</title><style>body{font:16px system-ui;max-width:520px;margin:12vh auto;padding:24px;color:#173651;line-height:1.6}button{background:#27717d;color:white;border:0;border-radius:8px;padding:14px 20px;font:inherit;cursor:pointer}small{color:#536984}</style></head><body><h1>Connect Lantern to GitHub</h1><p>Register the shared Lantern GitHub App once. Developers will use this app without registering their own.</p><p>The app requests read-only access to repository details, issues and organization projects. Your organization may need to approve it.</p><form action="${escapeHtml(start.url)}" method="post"><input type="hidden" name="manifest" value="${escapeHtml(start.manifest)}"><button>Create GitHub App</button></form><p><small>You’ll return to Lantern after installing the app.</small></p></body></html>`);
  });
  router.get('/auth/github/app/callback', async (req, res) => {
    const { source, user, department } = await connectedActor(req);
    if (connection?.ownerId !== user.id) throw new AccessError(403, 'Only the Lantern administrator can register the shared GitHub App.');
    verifyFlow(req, user.id, department, 'create');
    if (typeof req.query.code !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(req.query.code)) throw new AccessError(400, 'GitHub did not return an app registration.');
    const state = randomBytes(32).toString('hex');
    const url = await source.register(department, req.query.code, state);
    flows.set(state, { userId: user.id, department, expires: Date.now() + cookieOptions.maxAge, phase: 'install' });
    res.cookie(cookieName, state, cookieOptions).redirect(url);
  });
  router.get('/auth/github/app/setup', async (req, res) => {
    const { source, user, department } = await connectedActor(req);
    verifyFlow(req, user.id, department, 'install');
    const installationId = typeof req.query.installation_id === 'string' ? Number(req.query.installation_id) : NaN;
    if (!Number.isSafeInteger(installationId) || installationId <= 0) throw new AccessError(400, 'GitHub did not return an installation.');
    await source.install(department, installationId);
    const nonce = randomBytes(16).toString('hex');
    res.clearCookie(cookieName, cookieOptions).set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'`);
    res.type('html').send(`<!doctype html><html><head><title>GitHub connected</title><style>body{font:16px system-ui;padding:40px;color:#173651}</style></head><body><h1>GitHub connected</h1><p>You can close this window and choose work in Lantern.</p><script nonce="${nonce}">if(window.opener){window.opener.postMessage({type:'lantern-github-connected'},${JSON.stringify(origin)});window.close();}</script></body></html>`);
  });
  return router;
}
