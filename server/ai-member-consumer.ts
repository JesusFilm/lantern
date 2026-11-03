import { Router } from 'express';
import type { Pool } from 'pg';
import { AccessError } from './membership.js';
import { aiMemberStore } from './ai-member-store.js';

/** Fixed windows, capped by both global volume and bounded distinct-IP memory. */
export function consumerLimiter(now = Date.now) {
  let start = now(), total = 0;
  const clients = new Map<string, number>();
  return (key: string) => {
    if (now() - start >= 60000) { start = now(); total = 0; clients.clear(); }
    const count = clients.get(key) ?? 0;
    if (total >= 600 || count >= 120 || (!clients.has(key) && clients.size >= 1024)) return false;
    total++;
    clients.set(key, count + 1);
    return true;
  };
}
export function aiMemberConsumer(db: Pool, emails: ReadonlySet<string>) {
  const router = Router(), store = aiMemberStore(db, emails), admit = consumerLimiter();
  router.all('/api/ai-member/position-focus', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.set('Allow', 'GET').status(405).json({ error: 'Use GET.' }); return; }
    if (!admit(req.socket.remoteAddress ?? 'unknown')) { res.set('Retry-After', '60').status(429).json({ error: 'Too many requests.' }); return; }
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !/^Bearer lam_[A-Za-z0-9_-]{43}$/.test(header)) { res.status(401).json({ error: 'Invalid credentials.' }); return; }
    if (Object.keys(req.query).length || req.headers['transfer-encoding'] || Number(req.headers['content-length'] ?? 0) !== 0) { res.status(400).json({ error: 'GET accepts no parameters or body.' }); return; }
    try { res.json(await store.retrieve(header.slice(7))); }
    catch (error) {
      const status = error instanceof AccessError ? error.status : 503;
      res.status(status).json({ error: status === 401 ? 'Invalid credentials.' : status === 404 ? 'Position focus is not configured.' : 'The service is temporarily unavailable.', ...(status === 404 ? { code: 'focus_not_configured' } : {}) });
    }
  });
  return router;
}
