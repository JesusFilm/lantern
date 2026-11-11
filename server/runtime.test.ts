import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntime } from './runtime.js';
const hosted = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://unused', APP_ORIGIN: 'https://stage.example.test', AUTH_CLIENT_ID: 'test' };
test('hosting-only startup is explicit, credential-free and confined to stage', () => {
  const staging = { ...hosted, LANTERN_ENV: 'stage', LANTERN_HOSTING_ONLY: '1', AUTH_CLIENT_ID: '' };
  assert.equal(resolveRuntime(staging).hostingOnly, true);
  for (const patch of [{LANTERN_ENV:'production'}, {LANTERN_ENV:undefined}, {LANTERN_ENV:'local'}, {LANTERN_HOSTING_ONLY:'yes'}, {LANTERN_HOSTING_ONLY:'0'}, {AUTH_CLIENT_ID:'configured'}, {LOCAL_ACCESS:'1'}]) {
    assert.throws(() => resolveRuntime({...staging,...patch}));
  }
});
test('environment identity defaults restrictively and validates hosted configuration before connecting', () => {
  assert.equal(resolveRuntime(hosted).environment, 'production');
  assert.equal(resolveRuntime({ ...hosted, LANTERN_ENV: 'stage' }).environment, 'stage');
  for (const patch of [{ LANTERN_ENV: 'staging' }, { LANTERN_ENV: 'stage', NODE_ENV: 'development' }, { LOCAL_ACCESS: '1' }, { APP_ORIGIN: 'http://localhost:4391' }, { AUTH_CLIENT_ID: '' }, { PORT: 'abc' }]) {
    assert.throws(() => resolveRuntime({ ...hosted, ...patch }));
  }
  assert.equal(resolveRuntime({ DATABASE_URL: 'postgresql://unused', LANTERN_ENV: 'local', LOCAL_ACCESS: '1' }).localAccess, true);
});

test('feature settings are checked at startup, before connecting', () => {
  assert.deepEqual(resolveRuntime({ ...hosted, LANTERN_FEATURES: 'retired-feature=on' }).features.unknown, ['retired-feature']);
  assert.throws(() => resolveRuntime({ ...hosted, LANTERN_FEATURES: 'retired-feature=maybe' }));
  assert.throws(() => resolveRuntime({ ...hosted, LANTERN_PREVIEW_EMAILS: 'not-an-email' }));
});

test('a coach set to preview or on needs its providers; shown by default it is simply unavailable without them', () => {
  const providers = { AI_GATEWAY_CHAT_API_KEY: 'primary', OPENROUTER_API_KEY: 'fallback', AI_GATEWAY_CHAT_BASE_URL: 'https://gateway.example.com' };
  assert.throws(() => resolveRuntime({ ...hosted, LANTERN_FEATURES: 'coach=on' }), /coach/);
  assert.throws(() => resolveRuntime({ ...hosted, LANTERN_FEATURES: ' coach=preview ', LANTERN_PREVIEW_EMAILS: 'owner@example.test' }), /coach/);
  assert.ok(resolveRuntime({ ...hosted, ...providers, LANTERN_FEATURES: 'coach=on' }).coach);
  assert.equal(resolveRuntime({ ...hosted, LANTERN_ENV: 'stage' }).coach, undefined);
  assert.equal(resolveRuntime({ ...hosted, LANTERN_FEATURES: 'coach=off' }).coach, undefined);
  // The retired COACH_ENABLED switch neither enables nor disables anything.
  assert.equal(resolveRuntime({ ...hosted, COACH_ENABLED: '1' }).coach, undefined);
  assert.ok(resolveRuntime({ ...hosted, ...providers, COACH_ENABLED: '0' }).coach);
});

test('application deployment never runs the privileged migration command', async () => {
  const { readFile } = await import('node:fs/promises');
  const config = JSON.parse(await readFile('railway.json','utf8'));
  assert.equal(config.deploy.preDeployCommand, undefined);
});
