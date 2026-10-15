import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntime } from './runtime.js';
const hosted = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://unused', APP_ORIGIN: 'https://stage.example.test', GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test' };
test('environment identity defaults restrictively and validates hosted configuration before connecting', () => {
  assert.equal(resolveRuntime(hosted).environment, 'production');
  assert.equal(resolveRuntime({ ...hosted, LANTERN_ENV: 'stage' }).environment, 'stage');
  for (const patch of [{ LANTERN_ENV: 'staging' }, { LANTERN_ENV: 'stage', NODE_ENV: 'development' }, { LOCAL_ACCESS: '1' }, { APP_ORIGIN: 'http://localhost:4391' }, { GOOGLE_CLIENT_SECRET: '' }, { PORT: 'abc' }]) {
    assert.throws(() => resolveRuntime({ ...hosted, ...patch }));
  }
  assert.equal(resolveRuntime({ DATABASE_URL: 'postgresql://unused', LANTERN_ENV: 'local', LOCAL_ACCESS: '1' }).localAccess, true);
});
