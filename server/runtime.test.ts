import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntime } from './runtime.js';
const hosted = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://unused', APP_ORIGIN: 'https://stage.example.test', GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test' };
test('hosting-only startup is explicit, credential-free and confined to stage', () => {
  const staging = { ...hosted, LANTERN_ENV: 'stage', LANTERN_HOSTING_ONLY: '1', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' };
  assert.equal(resolveRuntime(staging).hostingOnly, true);
  for (const patch of [{LANTERN_ENV:'production'}, {LANTERN_ENV:undefined}, {LANTERN_ENV:'local'}, {LANTERN_HOSTING_ONLY:'yes'}, {LANTERN_HOSTING_ONLY:'0'}, {GOOGLE_CLIENT_ID:'configured', GOOGLE_CLIENT_SECRET:'configured'}, {LOCAL_ACCESS:'1'}]) {
    assert.throws(() => resolveRuntime({...staging,...patch}));
  }
});
test('environment identity defaults restrictively and validates hosted configuration before connecting', () => {
  assert.equal(resolveRuntime(hosted).environment, 'production');
  assert.equal(resolveRuntime({ ...hosted, LANTERN_ENV: 'stage' }).environment, 'stage');
  for (const patch of [{ LANTERN_ENV: 'staging' }, { LANTERN_ENV: 'stage', NODE_ENV: 'development' }, { LOCAL_ACCESS: '1' }, { APP_ORIGIN: 'http://localhost:4391' }, { GOOGLE_CLIENT_SECRET: '' }, { PORT: 'abc' }]) {
    assert.throws(() => resolveRuntime({ ...hosted, ...patch }));
  }
  assert.equal(resolveRuntime({ DATABASE_URL: 'postgresql://unused', LANTERN_ENV: 'local', LOCAL_ACCESS: '1' }).localAccess, true);
});

test('application deployment never runs the privileged migration command', async () => {
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile('railway.json','utf8'));
  assert.equal(config.deploy.preDeployCommand, undefined);
});
