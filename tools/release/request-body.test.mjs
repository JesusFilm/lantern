import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Keep an uncaught decoder error in a child so this checks process survival.
// GHSA-27r3-jxmh-p828: a valid gzip frame followed by trailing decoder input.
test('unauthenticated compressed JSON cannot terminate the application', { timeout: 15000 }, () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import http from 'node:http';
    import { gzipSync } from 'node:zlib';
    import { setTimeout as pause } from 'node:timers/promises';
    import { createApp } from './server/app.ts';
    const database = { query: async () => ({ rows: [] }) };
    const server = createApp(database).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const port = server.address().port;
    try {
      const compressed = gzipSync(Buffer.from(JSON.stringify({ message: 'synthetic' })));
      const payload = Buffer.concat([compressed, Buffer.of(0), Buffer.alloc(128 * 1024, 65)]);
      const status = await new Promise((resolve, reject) => {
        const request = http.request({ hostname: '127.0.0.1', port, path: '/api/no-such-route', method: 'POST', agent: false,
          headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': payload.length } }, response => {
          response.resume(); response.once('end', () => resolve(response.statusCode));
        });
        request.once('error', reject); request.end(payload);
      });
      assert.ok(status >= 400 && status < 500, 'anonymous request remains denied');
      await pause(300);
      const health = await fetch('http://127.0.0.1:' + port + '/health');
      assert.equal(health.status, 200);
      assert.equal((await health.json()).status, 'ok');
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 12000 });
  assert.equal(result.status, 0, `${result.error?.message ?? ''}\n${result.stderr}\n${result.stdout}`);
});
