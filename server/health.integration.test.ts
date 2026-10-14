import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { Pool } from 'pg';
import { createApp } from './app.js';
import { createDatabase } from './database.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set DATABASE_URL and start PostgreSQL before testing.');

async function withServer(database: Pool, run: (url: string) => Promise<void>) {
  const server = createServer(createApp(database));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await database.end();
  }
}

test('GET /health succeeds against real PostgreSQL without caching', { timeout: 10000 }, async () => {
  await withServer(createDatabase(connectionString), async (url) => {
    const response = await fetch(`${url}/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('etag'), null);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'ok' });
    const conditionalResponse = await fetch(`${url}/health`, {
      cache: 'force-cache',
      headers: { 'If-None-Match': response.headers.get('etag') ?? 'previous-health-response' },
    });
    assert.equal(conditionalResponse.status, 200);
    assert.deepEqual(await conditionalResponse.json(), { status: 'ok', database: 'ok' });
  });
});

test('GET /health fails when the configured database does not exist', { timeout: 10000 }, async () => {
  const missingDatabase = new URL(connectionString);
  missingDatabase.pathname = `/health_test_missing_${randomUUID().replaceAll('-', '')}`;
  await withServer(createDatabase(missingDatabase.href), async (url) => {
    const response = await fetch(`${url}/health`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('etag'), null);
    assert.deepEqual(await response.json(), { status: 'unavailable', database: 'unavailable' });
  });
});
