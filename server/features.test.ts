import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enabledFeatures, featureEnabled, requireFeature, resolveFeatureConfig } from './features.js';
import { AccessError } from './membership.js';

const names = ['focus-notes', 'team-calendar'];
const owner = 'owner@example.test';

test('production hides every registered feature until its state is set', () => {
  const config = resolveFeatureConfig({}, 'production', names);
  assert.deepEqual(enabledFeatures(config, owner), []);
  assert.deepEqual(enabledFeatures(config, undefined), []);
});

test('stage and local show registered features unless they are switched off', () => {
  for (const environment of ['stage', 'local'] as const) {
    assert.deepEqual(enabledFeatures(resolveFeatureConfig({}, environment, names), undefined), names);
    const config = resolveFeatureConfig({ LANTERN_FEATURES: 'team-calendar=off' }, environment, names);
    assert.deepEqual(enabledFeatures(config, owner), ['focus-notes']);
  }
});

test('on shows a feature to everyone, including before sign-in', () => {
  const config = resolveFeatureConfig({ LANTERN_FEATURES: 'focus-notes=on' }, 'production', names);
  assert.deepEqual(enabledFeatures(config, undefined), ['focus-notes']);
  assert.deepEqual(enabledFeatures(config, 'member@example.test'), ['focus-notes']);
  assert.equal(featureEnabled(config, 'team-calendar', owner), false);
});

test('preview shows a feature only to the listed accounts', () => {
  const config = resolveFeatureConfig({
    LANTERN_FEATURES: ' focus-notes=preview , team-calendar=off ',
    LANTERN_PREVIEW_EMAILS: ' Owner@Example.test , second@example.test ',
  }, 'production', names);
  assert.deepEqual(enabledFeatures(config, owner), ['focus-notes']);
  assert.deepEqual(enabledFeatures(config, 'OWNER@example.test'), ['focus-notes']);
  assert.deepEqual(enabledFeatures(config, 'second@example.test'), ['focus-notes']);
  assert.deepEqual(enabledFeatures(config, 'member@example.test'), []);
  assert.deepEqual(enabledFeatures(config, undefined), []);
});

test('a setting for a feature this release does not have is reported and changes nothing', () => {
  const config = resolveFeatureConfig({ LANTERN_FEATURES: 'retired-feature=preview,focus-notes=on' }, 'production', names);
  assert.deepEqual(config.unknown, ['retired-feature']);
  assert.deepEqual(enabledFeatures(config, owner), ['focus-notes']);
});

test('invalid settings stop startup', () => {
  const invalid = [
    { LANTERN_FEATURES: 'focus-notes=enabled' },
    { LANTERN_FEATURES: 'focus-notes' },
    { LANTERN_FEATURES: 'Focus Notes=on' },
    { LANTERN_FEATURES: 'focus-notes=on,focus-notes=off' },
    { LANTERN_FEATURES: 'focus-notes=on,,team-calendar=on' },
    { LANTERN_FEATURES: 'focus-notes=preview' },
    { LANTERN_FEATURES: 'focus-notes=preview', LANTERN_PREVIEW_EMAILS: 'not-an-email' },
    { LANTERN_PREVIEW_EMAILS: '*@example.test' },
  ];
  for (const env of invalid) assert.throws(() => resolveFeatureConfig(env, 'production', names), JSON.stringify(env));
});

test('code cannot ask about a feature that is not registered', () => {
  const config = resolveFeatureConfig({}, 'stage', names);
  assert.throws(() => featureEnabled(config, 'focus-note', owner));
});

test('a hidden feature answers like a route that does not exist', () => {
  const config = resolveFeatureConfig({ LANTERN_FEATURES: 'focus-notes=preview', LANTERN_PREVIEW_EMAILS: owner }, 'production', names);
  assert.doesNotThrow(() => requireFeature(config, 'focus-notes', owner));
  assert.throws(() => requireFeature(config, 'focus-notes', 'member@example.test'),
    (error: unknown) => error instanceof AccessError && error.status === 404 && error.message === 'Not found.');
});

