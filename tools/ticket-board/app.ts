import { readFile } from 'node:fs/promises';
import express from 'express';
import { loadTickets, repositoryPath } from './tickets.js';

export function createTicketBoardApp(repository = repositoryPath) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.get(['/', '/index.html'], async (_request, response) => {
    const page = await readFile(new URL('./index.html', import.meta.url), 'utf8');
    response.type('html').send(page);
  });
  app.get('/favicon.svg', async (_request, response) => {
    const icon = await readFile(new URL('./favicon.svg', import.meta.url), 'utf8');
    response.type('image/svg+xml').send(icon);
  });
  app.get('/api/tickets', async (_request, response) => {
    try {
      response.json(await loadTickets(repository));
    } catch (error) {
      console.error('Cannot read ticket files:', error);
      response.status(500).json({ error: 'Could not read ticket files. Check the local server output.' });
    }
  });
  app.use((_request, response) => { response.status(404).type('text').send('Not found'); });
  return app;
}
