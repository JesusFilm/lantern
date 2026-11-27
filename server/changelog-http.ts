import { Router, type Response, type Request } from 'express';
import type { Pool } from 'pg';
import { requireFeature, type FeatureConfig } from './features.js';
import { AccessError } from './membership.js';
import { addProduct, readChangelog, saveEntry } from './changelog.js';

import type { EntryOperation } from './changelog.js';
import type { PullRequestLookup } from './changelog-pr.js';

function uuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  );
}

function entryOperation(id: unknown, body: Record<string, unknown>): EntryOperation {
  if (id === undefined) {
    if (!uuid(body.publicationKey))
      throw new AccessError(400, 'Supply a valid publication key.');
    return { publicationKey: body.publicationKey };
  }
  if (!uuid(id)) throw new AccessError(404, 'Entry not found.');
  const revision = body.revision;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1)
    throw new AccessError(400, 'Supply the entry revision you read.');
  return { id, revision };
}

export function changelogRoutes(
  db: Pool,
  requireUser: (req: Request) => Promise<{ id: string; email: string }>,
  features: FeatureConfig,
  lookup?: PullRequestLookup,
) {
  const router = Router();
  async function actor(req: Request) {
    const user = await requireUser(req);
    requireFeature(features, 'changelog', user.email);
    return user.id;
  }
  router.get('/api/changelog', async (req, res) => {
    const user = await actor(req);
    res.json(
      await readChangelog(db, user, req.query.week, req.query.view === 'mine'),
    );
  });
  router.post('/api/changelog/products', async (req, res) => {
    const user = await actor(req);
    const name = req.body?.name;
    if (!req.body || Object.keys(req.body).length !== 1)
      throw new AccessError(400, 'Supply a product name.');
    res.status(201).json(await addProduct(db, user, name));
  });
  async function save(req: Request, res: Response) {
    const user = await actor(req);
    const body = req.body;
    if (
      !body ||
      typeof body !== 'object' ||
      Object.keys(body).some(
        (key) =>
          ![
            req.method === 'POST' ? 'publicationKey' : 'revision',
            'week',
            'productId',
            'title',
            'changed',
            'benefit',
            'links',
          ].includes(key),
      )
    )
      throw new AccessError(400, 'Supply only entry fields.');
    if (!uuid(body.productId)) throw new AccessError(400, 'Choose a department product.');
    const operation = entryOperation(req.params.id, body);
    const saved = await saveEntry(db, user, body, operation, lookup);
    res.status('id' in operation ? 200 : 201).json(saved);
  }
  router.post('/api/changelog/entries', save);
  router.put('/api/changelog/entries/:id', save);
  return router;
}
