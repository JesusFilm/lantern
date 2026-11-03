import type { CoachProvider } from './coach-provider.js';
import type { CoachAdmission } from './coach-admission.js';
import { aiMemberCoach } from './ai-member-coach.js';
import { Router, type Request } from 'express';
import type { Pool } from 'pg';
import { bodyFields, boundedText, revision, focusContent } from './ai-member-contract.js';
import { aiMemberStore } from './ai-member-store.js';

export function aiMemberRoutes(db: Pool, requireUser: (req: Request) => Promise<{ id: string }>, emails: ReadonlySet<string>, provider: CoachProvider | undefined, admit: CoachAdmission) {
  const router = Router(), store = aiMemberStore(db, emails);
  router.use(aiMemberCoach(db, requireUser, emails, provider, admit));
  router.get('/api/ai-members', async (req, res) => res.json(await store.list((await requireUser(req)).id)));
  router.post('/api/ai-members', async (req, res) => {
    const owner = (await requireUser(req)).id;
    bodyFields(req.body, ['name', 'purpose']);
    res.status(201).json(await store.create(owner, { name: boundedText(req.body.name, 100, 'Name'), purpose: boundedText(req.body.purpose ?? '', 4000, 'Purpose', true) }));
  });
  router.get('/api/ai-members/:id', async (req, res) => res.json(await store.get((await requireUser(req)).id, String(req.params.id))));
  router.patch('/api/ai-members/:id', async (req, res) => {
    const owner = (await requireUser(req)).id;
    bodyFields(req.body, ['name', 'purpose', 'profileRevision']);
    res.json(await store.edit(owner, String(req.params.id), { name: boundedText(req.body.name, 100, 'Name'), purpose: boundedText(req.body.purpose ?? '', 4000, 'Purpose', true) }, revision(req.body.profileRevision)));
  });
  router.post('/api/ai-members/:id/tokens', async (req, res) => {
    const owner = (await requireUser(req)).id;
    bodyFields(req.body, ['name']);
    res.status(201).json(await store.issue(owner, String(req.params.id), boundedText(req.body.name, 100, 'Token name')));
  });
  router.post('/api/ai-members/:id/tokens/:token/rotate', async (req, res) => {
    const owner = (await requireUser(req)).id;
    bodyFields(req.body, ['credentialRevision']);
    res.json(await store.tokenAction(owner, String(req.params.id), String(req.params.token), revision(req.body.credentialRevision), true));
  });
  router.delete('/api/ai-members/:id/tokens/:token', async (req, res) => {
    const owner = (await requireUser(req)).id;
    bodyFields(req.body, ['credentialRevision']);
    await store.tokenAction(owner, String(req.params.id), String(req.params.token), revision(req.body.credentialRevision), false);
    res.sendStatus(204);
  });
  router.put('/api/ai-members/:id/focus', async (req, res) => {
    const owner = (await requireUser(req)).id;
    bodyFields(req.body, ['objective', 'goals', 'version']);
    const content = focusContent(req.body);
    res.json(await store.saveFocus(owner, String(req.params.id), content, revision(req.body.version, true)));
  });
  router.delete('/api/ai-members/:id', async (req, res) => { await store.remove((await requireUser(req)).id, String(req.params.id)); res.sendStatus(204); });
  return router;
}
