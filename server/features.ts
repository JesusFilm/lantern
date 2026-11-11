import { normalizeEmail } from './admission.js';
import { AccessError } from './membership.js';
import { featureNames } from '../shared/features.js';
import type { LanternEnvironment } from './runtime.js';

export type FeatureState = 'off' | 'preview' | 'on';
export interface FeatureConfig {
  states: ReadonlyMap<string, FeatureState>;
  previewEmails: ReadonlySet<string>;
  /** Names set in LANTERN_FEATURES that this release does not have. */
  unknown: readonly string[];
}

const entries = (value: string | undefined) => value?.trim() ? value.split(',').map(entry => entry.trim()) : [];

// Production hides a registered feature until its state is set. Stage and local
// show it, so acceptance and development exercise the code before release.
export function resolveFeatureConfig(env: NodeJS.ProcessEnv, environment: LanternEnvironment, names: readonly string[] = featureNames): FeatureConfig {
  const settings = new Map<string, FeatureState>();
  for (const entry of entries(env.LANTERN_FEATURES)) {
    const match = /^([a-z][a-z0-9-]*)=(off|preview|on)$/.exec(entry);
    if (!match) throw new Error('LANTERN_FEATURES must list name=off, name=preview or name=on, separated by commas.');
    if (settings.has(match[1]!)) throw new Error('LANTERN_FEATURES sets the same feature more than once.');
    settings.set(match[1]!, match[2] as FeatureState);
  }
  const previewEmails = new Set(entries(env.LANTERN_PREVIEW_EMAILS).map((email) => {
    try { return normalizeEmail(email); }
    catch { throw new Error('LANTERN_PREVIEW_EMAILS must list exact email addresses, separated by commas.'); }
  }));
  const fallback: FeatureState = environment === 'production' ? 'off' : 'on';
  const states = new Map(names.map(name => [name, settings.get(name) ?? fallback] as const));
  if ([...states.values()].includes('preview') && !previewEmails.size) throw new Error('LANTERN_PREVIEW_EMAILS is required while a feature is in preview.');
  return { states, previewEmails, unknown: [...settings.keys()].filter(name => !names.includes(name)) };
}

/** Whether this account sees the feature. The email must be the server-resolved identity. */
export function featureEnabled(config: FeatureConfig, name: string, email: string | undefined) {
  const state = config.states.get(name);
  if (!state) throw new Error('Feature ' + name + ' is not registered in shared/features.ts.');
  if (state === 'preview') return email !== undefined && config.previewEmails.has(email.trim().toLowerCase());
  return state === 'on';
}

export function enabledFeatures(config: FeatureConfig, email: string | undefined) {
  return [...config.states.keys()].filter(name => featureEnabled(config, name, email));
}

/** Guards a feature's routes: a hidden feature answers like a route that does not exist. */
export function requireFeature(config: FeatureConfig, name: string, email: string | undefined) {
  if (!featureEnabled(config, name, email)) throw new AccessError(404, 'Not found.');
}
