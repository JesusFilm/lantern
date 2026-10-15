import { registerSession } from './accounts.js';
import { isAdmitted, type AdmissionPolicy } from './admission.js';
import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import type { IdentityProvider } from './google.js';
import { focusRoutes } from './focus-http.js';
import { guideContent } from './guide-content.js';
import { AccessError, addMember, membership } from './membership.js';
import type { RegisteredUser } from '../shared/access.js';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(32).toString('base64url');
function cookie(request: Request, name: string) {
  return request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}
export interface AccessConfig { origin: string; provider?: IdentityProvider; localUserId?: string; admissionPolicy?: AdmissionPolicy; hostingOnly?: boolean }
export function accessRoutes(db: Pool, config: AccessConfig) {
  const router = Router();
  const secure = config.origin.startsWith('https:');
  const sessionCookie = secure ? '__Host-lantern-session' : 'lantern-session';
  const loginCookie = secure ? '__Host-lantern-login' : 'lantern-login';
  const options = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, _res, next) => {
    if (req.method !== 'GET' && req.headers.origin !== config.origin) return next(new AccessError(403, 'Request origin is not allowed.'));
    next();
  });
  async function currentUser(req: Request) {
    if (config.hostingOnly) return undefined;
    if (config.localUserId) {
      const local = await db.query('SELECT id,name,email FROM users WHERE id=$1', [config.localUserId]);
      return local.rows[0] as { id: string; name: string; email: string } | undefined;
    }
    const token = cookie(req, sessionCookie);
    if (!token) return undefined;
    const result = await db.query(`SELECT u.id,u.name,u.email,u.hosted_domain FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now()`, [hash(token)]);
    const user = result.rows[0];
    if (!user || !await isAdmitted(db, { email: user.email, hostedDomain: user.hosted_domain }, config.admissionPolicy)) return undefined;
    return { id: user.id as string, name: user.name as string, email: user.email as string };
  }
  async function requireUser(req: Request) {
    const user = await currentUser(req);
    if (!user) throw new AccessError(401, 'Sign in to continue.');
    return user;
  }
  router.get('/auth/google', async (_req, res) => {
    if (config.hostingOnly || !config.provider) throw new AccessError(503, 'Google sign-in is not configured.');
    const state = random(), nonce = random(), verifier = random();
    await db.query('DELETE FROM login_attempts WHERE expires_at<=now()');
    await db.query("INSERT INTO login_attempts VALUES($1,$2,$3,now()+interval '10 minutes')", [hash(state), nonce, verifier]);
    res.cookie(loginCookie, state, { ...options, maxAge: 600000 });
    res.redirect(config.provider.authorizationUrl(state, nonce, createHash('sha256').update(verifier).digest('base64url')));
  });
  router.get('/auth/google/callback', async (req, res) => {
    const state = req.query.state;
    res.clearCookie(loginCookie, options);
    if (config.hostingOnly || !config.provider || typeof state !== 'string' || cookie(req, loginCookie) !== state) return res.redirect('/?signInError=1');
    const attempt = await db.query('DELETE FROM login_attempts WHERE state_hash=$1 AND expires_at>now() RETURNING nonce,verifier', [hash(state)]);
    if (!attempt.rowCount || typeof req.query.code !== 'string') return res.redirect('/?signInError=1');
    let identity;
    try { identity = await config.provider.exchange(req.query.code, attempt.rows[0].verifier, attempt.rows[0].nonce); }
    catch { return res.redirect('/?signInError=1'); }
    const token = random();
    const old = cookie(req, sessionCookie);
    if (!await registerSession(db, identity, hash(token), old ? hash(old) : undefined, config.admissionPolicy)) {
      return res.redirect('/?signInError=1');
    }
    res.cookie(sessionCookie, token, { ...options, maxAge: 7 * 86400000 });
    res.redirect('/');
  });
  router.post('/api/sign-out', async (req, res) => {
    const token = cookie(req, sessionCookie);
    if (token) await db.query('DELETE FROM sessions WHERE token_hash=$1', [hash(token)]);
    res.clearCookie(sessionCookie, options).sendStatus(204);
  });
  router.get('/api/session', async (req, res) => {
    const user = await currentUser(req);
    res.json({ user: user ?? null, department: user ? await membership(db, user.id) : undefined, signInAvailable: !config.hostingOnly && !!config.provider, localAccess: !!config.localUserId });
  });
  router.use(focusRoutes(db, requireUser));
  router.patch('/api/account', async (req, res) => {
    const user = await requireUser(req);
    if (!req.body || Object.keys(req.body).some(k => k !== 'name') || typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 100) throw new AccessError(400, 'Enter a display name of 1–100 characters.');
    const result = await db.query('UPDATE users SET name=$1 WHERE id=$2 RETURNING id,name,email', [req.body.name.trim(), user.id]);
    res.json(result.rows[0]);
  });
  router.get('/api/guide', async (req, res) => {
    const user = await requireUser(req);
    if (!await membership(db, user.id)) throw new AccessError(403, 'Active department membership is required.');
    res.json(guideContent);
  });
  router.get('/api/department', async (req, res) => {
    const user = await requireUser(req);
    const department = await membership(db, user.id);
    if (department?.role !== 'career-lead') throw new AccessError(403, 'Only the career lead can browse department users.');
    const members = await db.query(`SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id
      WHERE m.department_id=$1 AND m.deleted_at IS NULL ORDER BY lower(u.name),u.id`, [department.id]);
    res.json({ department, members: members.rows });
  });
  router.get('/api/department/registered-users', async (req, res) => {
    const user = await requireUser(req);
    const department = await membership(db, user.id);
    if (department?.role !== 'career-lead') throw new AccessError(403, 'Only the career lead can browse registered users.');
    const result = await db.query(`SELECT u.id,u.name,u.email,d.name AS department,m.department_id,m.deleted_at
      FROM users u LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN departments d ON d.id=m.department_id
      ORDER BY lower(u.email),u.id`);
    res.json(result.rows.map((row): RegisteredUser => ({ id: row.id, name: row.name, email: row.email, department: row.department,
      status: !row.department_id ? 'available' : row.department_id !== department.id ? 'other-department' : row.deleted_at ? 'former' : 'member' })));
  });
  router.post('/api/department/members', async (req, res) => {
    const user = await requireUser(req);
    if (!req.body || Object.keys(req.body).some((key) => key !== 'userId') || typeof req.body.userId !== 'string') {
      throw new AccessError(400, 'Select a registered user; no roles or departments may be supplied.');
    }
    await addMember(db, user.id, req.body.userId, config.admissionPolicy);
    res.sendStatus(204);
  });
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AccessError) res.status(error.status).json({ error: error.message });
    else res.status(503).json({ error: 'The service is temporarily unavailable. Please try again.' });
  });
  return router;
}
