import { localAccount } from './local-access.js';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import express from 'express';
import { createApp } from './app.js';
import { googleProvider } from './google.js';
import { createDatabase } from './database.js';
import { assertRuntimePrivileges } from './database-privileges.js';

import { resolveRuntime } from './runtime.js';
import { assertSchemaReady } from './schema.js';
const { environment, connectionString, port, host, localAccess, origin, clientId, clientSecret, hosted, hostingOnly } = resolveRuntime();
const database = createDatabase(connectionString);
try {
  await assertSchemaReady(database);
  await assertRuntimePrivileges(database);
} catch {
  await database.end();
  throw new Error('Database schema or runtime privileges are not ready. Check the scoped database setup before startup.');
}
let localUserId: string | undefined;
try { localUserId = localAccess ? await localAccount(database) : undefined; }
catch (error) { await database.end(); throw error; }
let revision: string | undefined;
try { revision = JSON.parse(readFileSync('release.json', 'utf8')).sha; } catch { /* Local builds need no release stamp. */ }
const app = createApp(database, { origin, hostingOnly, admissionPolicy: environment, localUserId, provider: clientId && clientSecret ? googleProvider(clientId, clientSecret, origin) : undefined }, hosted ? { revision, deployment: process.env.RAILWAY_DEPLOYMENT_ID } : undefined);
const server = createServer(app);
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
let closeFrontend: (() => Promise<void>) | undefined;

if (production) {
  app.use(express.static(resolve('dist/client')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: { server }, hmr: { server } },
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
