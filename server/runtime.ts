import {resolveCoachConfig} from './coach-provider.js';
export type LanternEnvironment = 'local' | 'stage' | 'production';
export function lanternEnvironment(environment: string | undefined): LanternEnvironment {
  if (environment === undefined) return 'production';
  if (environment === 'local' || environment === 'stage' || environment === 'production') return environment;
  throw new Error('LANTERN_ENV must be local, stage or production.');
}

export function resolveRuntime(env: NodeJS.ProcessEnv = process.env) {
  const environment = lanternEnvironment(env.LANTERN_ENV);
  const hosted = env.LANTERN_ENV === 'stage' || env.LANTERN_ENV === 'production' || env.NODE_ENV === 'production';
  if (hosted && env.NODE_ENV !== 'production') throw new Error('Hosted environments require NODE_ENV=production.');
  const connectionString = env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const port = Number(env.PORT ?? 4391);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  const host = env.HOST ?? (hosted ? '0.0.0.0' : '127.0.0.1');
  if (env.LOCAL_ACCESS && !['0', '1'].includes(env.LOCAL_ACCESS)) throw new Error('Invalid LOCAL_ACCESS.');
  const localAccess = env.LOCAL_ACCESS === '1';
  if (localAccess && (hosted || !['127.0.0.1', 'localhost', '::1'].includes(host))) throw new Error('LOCAL_ACCESS requires a loopback host and a non-production environment.');
  const origin = env.APP_ORIGIN ?? (hosted ? '' : `http://${host}:${port}`);
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error('Invalid APP_ORIGIN.'); }
  if (parsed.origin !== origin || (parsed.protocol !== 'https:' && (hosted || parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)))) throw new Error('APP_ORIGIN must be HTTPS when hosted, or HTTP loopback locally.');
  const clientId = env.GOOGLE_CLIENT_ID, clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (env.LANTERN_HOSTING_ONLY && !['0', '1'].includes(env.LANTERN_HOSTING_ONLY)) throw new Error('Invalid LANTERN_HOSTING_ONLY.');
  const hostingOnly = env.LANTERN_HOSTING_ONLY === '1';
  if (hostingOnly && (environment !== 'stage' || clientId || clientSecret)) throw new Error('Hosting-only mode requires stage without identity provider credentials.');
  if ((hosted && !hostingOnly && (!clientId || !clientSecret)) || !!clientId !== !!clientSecret) throw new Error('Set both Google client credentials.');
  return { coach:resolveCoachConfig(env), environment, hosted, connectionString, port, host, localAccess, origin, clientId, clientSecret, hostingOnly };
}
