import { Router, type Response, type Request } from 'express';
import type { Pool } from 'pg';
import { requireFeature, type FeatureConfig } from './features.js';
import { AccessError } from './membership.js';
import { addProduct, readChangelog, saveEntry } from './changelog.js';

import type { PullRequestLookup } from './changelog-pr.js';

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
    const id = req.params.id;
    if (id !== undefined && typeof id !== 'string')
      throw new AccessError(404, 'Entry not found.');
    res
      .status(id ? 200 : 201)
      .json(await saveEntry(db, user, body, lookup, id));
  }
  router.post('/api/changelog/entries', save);
  router.put('/api/changelog/entries/:id', save);
  return router;
}
