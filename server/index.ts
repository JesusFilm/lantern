import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app.js';
import { createDatabase } from './database.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env before starting.');
}

const port = Number(process.env.PORT ?? 4391);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const host = process.env.HOST ?? '127.0.0.1';
const database = createDatabase(connectionString);
const app = createApp(database);
const server = createServer(app);
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
let closeFrontend: (() => Promise<void>) | undefined;

if (production) {
  app.use(express.static(resolve('dist/client')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  closeFrontend = () => vite.close();
}

server.listen(port, host, () => {
  console.log(`Lantern: http://${host}:${port}`);
});
server.on('error', async () => {
  console.error('The web server could not start. Check the host and whether the port is in use.');
  await closeFrontend?.();
  await database.end();
  process.exitCode = 1;
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  await closeFrontend?.();
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  await database.end();
  clearTimeout(deadline);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
