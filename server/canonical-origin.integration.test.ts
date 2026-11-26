import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request } from 'node:http';
import { createApp } from './app.js';
import { privilegeFixture } from './privilege-test-support.js';
import { migrate } from './schema.js';
import { chromium } from '@playwright/test';
import { grantApplicationPrivileges } from './database-privileges.js';

test('production aliases redirect before authentication and parsing while health remains available', async () => {
  const fixture = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(fixture.migration);
    await grantApplicationPrivileges(fixture.migration, fixture.roles);
    const app = createApp(fixture.runtime, { origin: 'https://ds-lantern.jesusfilm.org' }, { canonicalRedirect: true });
    server.on('request', app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    const send = (path: string, host: string, method = 'GET', body?: string) => new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders }>((resolve, reject) => {
      const req = request(origin + path, { method, headers: { Host: host, 'X-Forwarded-Host': 'evil.example', 'Content-Type': 'application/json' } }, response => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers }));
      });
      req.on('error', reject);
      req.end(body);
    });
    for (const path of ['/?page=week', '/auth/jesusfilm', '/lantern.svg', '/api/session', '//other.example/path?x=%2F']) {
      const response = await send(path, 'lantern-production-0bd8.up.railway.app');
      assert.equal(response.status, 308);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.equal(response.headers.location, 'https://ds-lantern.jesusfilm.org' + path);
      assert.equal(response.headers['set-cookie'], undefined);
    }
    const write = await send('/api/position-focuses?from=old', 'old.example', 'POST', '{invalid');
    assert.equal(write.status, 308);
    assert.equal(write.headers.location, 'https://ds-lantern.jesusfilm.org/api/position-focuses?from=old');
    assert.equal((await send('/health', 'internal.example')).status, 200);
    const canonical = await send('/api/session', 'ds-lantern.jesusfilm.org');
    assert.equal(canonical.status, 200);
    assert.equal(canonical.headers.location, undefined);
    const browserApp = createApp(fixture.runtime, { origin }, { canonicalRedirect: true });
    browserApp.get('/landing', (_request, response) => response.send('<h1>Canonical destination</h1>'));
    server.removeAllListeners('request');
    server.on('request', browserApp);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(origin.replace('127.0.0.1', 'localhost') + '/landing?page=week&from=old');
      assert.equal(page.url(), origin + '/landing?page=week&from=old');
      assert.equal(await page.locator('h1').textContent(), 'Canonical destination');
    } finally { await browser.close(); }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fixture.close();
  }
});
