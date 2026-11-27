import { json, Router, type NextFunction, type Request, type Response } from 'express';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import type { Pool } from 'pg';
import { requireFeature, type FeatureConfig } from './features.js';
import { jesusFilmIssuer } from './jesusfilm.js';
import { linkedOwner, type OwnerPrincipal } from './owner-administration.js';
import { handleOwnerMcp } from './owner-mcp-http.js';
import { AccessError } from './membership.js';

export interface OwnerApiConfig {
  environment: 'local' | 'staging';
  ownerEmails: ReadonlySet<string>;
  fetch?: typeof fetch;
}

const scope = 'lantern:admin';
const metadataPath = '/.well-known/oauth-protected-resource';
const departmentsPath = '/api/v1/departments';
const mcpPath = '/mcp';
const paths = [departmentsPath, mcpPath, metadataPath];

export function ownerApiRoutes(db: Pool, origin: string, features: FeatureConfig | undefined, config: OwnerApiConfig | undefined) {
  const router = Router();
  router.all(paths, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const state = features?.states.get('owner-api');
  if (!config || !features || !state || state === 'off') {
    router.all(paths, (_req, res) => { res.status(404).json({ error: 'Not found.' }); });
    return router;
  }

  const resource = origin + mcpPath;
  const challenge = `Bearer resource_metadata="${origin + metadataPath}", scope="${scope}"`;
  const keys = createRemoteJWKSet(new URL(jesusFilmIssuer + '/jwks'), {
    timeoutDuration: 5000,
    [customFetch]: (url, options) => (config.fetch ?? fetch)(url, { ...options, redirect: 'error' }),
  });
  const { host } = new URL(origin);

  const requireOwner = async (req: Request, res: Response) => {
    const token = /^Bearer +([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(req.headers.authorization ?? '')?.[1];
    let payload;
    if (token && token.length <= 16384) {
      try {
        ({ payload } = await jwtVerify(token, keys, {
          issuer: jesusFilmIssuer, audience: resource, requiredClaims: ['sub', 'exp'],
          algorithms: ['EdDSA', 'RS256', 'ES256'],
        }));
      } catch { /* Authentication failures share the same response. */ }
    }
    const audience = payload?.aud;
    if (!payload?.sub || (Array.isArray(audience) && audience.length !== 1) ||
        payload['https://jesusfilm.org/claims/environment'] !== config.environment ||
        payload['https://jesusfilm.org/claims/app'] !== 'lantern-mcp') {
      res.set('WWW-Authenticate', challenge).status(401).json({ error: 'A valid JFP One access token is required.' });
      return;
    }
    if (typeof payload.scope !== 'string' || !payload.scope.split(' ').includes(scope)) {
      res.set('WWW-Authenticate', challenge + ', error="insufficient_scope"').status(403).json({ error: 'The JFP One access token needs the Lantern admin scope.' });
      return;
    }
    const owner = await linkedOwner(db, config.ownerEmails, payload.sub);
    requireFeature(features, 'owner-api', owner.email);
    return owner;
  };

  router.get(departmentsPath, async (req, res) => {
    const owner = await requireOwner(req, res);
    if (owner) res.json(await owner.listDepartments());
  });
  router.get(metadataPath, (_req, res) => {
    res.json({ resource, authorization_servers: [jesusFilmIssuer], scopes_supported: [scope], bearer_methods_supported: ['header'] });
  });
  router.all(mcpPath, (req, _res, next) => {
    // MCP is independent of cookies and accepts requests from native clients
    // without an Origin. Reject foreign origins and rebinding to a local host.
    if (req.headers.host?.toLowerCase() !== host || (req.headers.origin !== undefined && req.headers.origin !== origin)) {
      throw new AccessError(403, 'Request origin is not allowed.');
    }
    next();
  });
  type McpResponse = Response<unknown, { owner: OwnerPrincipal }>;
  router.post(mcpPath, async (req: Request, res: McpResponse, next: NextFunction) => {
    const owner = await requireOwner(req, res);
    if (owner) {
      res.locals.owner = owner;
      next();
    }
  }, json({ limit: '64kb', strict: false }), (req: Request, res: McpResponse) => handleOwnerMcp(req, res, res.locals.owner),
  (error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } });
    } else if (error && typeof error === 'object' && 'status' in error && error.status === 413) {
      res.status(413).json({ error: 'MCP request is too large.' });
    } else next(error);
  });
  router.all(mcpPath, (_req, res) => { res.set('Allow', 'POST').sendStatus(405); });
  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (!(error instanceof AccessError)) return next(error);
    res.status(error.status).json({ error: error.message });
  });
  return router;
}
