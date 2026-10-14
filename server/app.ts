import express from 'express';
import type { Pool } from 'pg';
import type { HealthResponse } from '../shared/health.js';

export function createApp(database: Pool) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');

  app.get('/health', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    try {
      await database.query('SELECT 1');
      response.status(200).json({ status: 'ok', database: 'ok' } satisfies HealthResponse);
    } catch {
      response.status(503).json({
        status: 'unavailable',
        database: 'unavailable',
      } satisfies HealthResponse);
    }
  });

  return app;
}
