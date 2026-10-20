import express from 'express';
import type {Request,Response,NextFunction} from 'express';
import { accessRoutes } from './access.js';
import type { AccessConfig } from './access.js';
import type { Pool } from 'pg';
import { assertSchemaReady } from './schema.js';
import type { HealthResponse } from '../shared/health.js';

export function createApp(database: Pool, config: AccessConfig = { origin: 'http://127.0.0.1:4391' }, runtime?: { revision?: string; deployment?: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');

  app.get('/health', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    try {
      if (runtime) await assertSchemaReady(database);
      else await database.query('SELECT 1');
      if (runtime?.revision) response.set('X-Lantern-Revision', runtime.revision);
      if (runtime?.deployment) response.set('X-Lantern-Deployment', runtime.deployment);
      if (runtime) response.set('X-Lantern-Schema', '6');
      response.status(200).json({ status: 'ok', database: 'ok' } satisfies HealthResponse);
    } catch {
      response.status(503).json({
        status: 'unavailable',
        database: 'unavailable',
      } satisfies HealthResponse);
    }
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(accessRoutes(database, config));
  app.use('/api', (_request, response) => { response.status(404).json({ error: 'Not found.' }); });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : 503;
    res.set('Cache-Control','no-store');
    if (status === 400) res.status(400).json({error:'The request contains invalid JSON.'});
    else if (status === 413) res.status(413).json({error:'This document is too large to save. Reduce its size and try again.'});
    else res.status(503).json({error:'The service is temporarily unavailable. Please try again.'});
  });
  return app;
}
