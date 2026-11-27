import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { approveEmail, revokeEmail } from './admission.js';
import { createApp } from './app.js';
import { grantApplicationPrivileges } from './database-privileges.js';
import type { IdentityProvider } from './identity.js';
import { privilegeFixture } from './privilege-test-support.js';
import { resolveRuntime } from './runtime.js';
import { migrate } from './schema.js';

const issuer = 'https://auth.jesusfilm.org/api/auth';
const departmentId = '66877b44-9fd7-48ec-862c-d39ecad6c3b1';
const archivedId = 'de33218a-259c-46d6-b282-e8d33528c506';
const departments = [{ id: departmentId, name: 'Synthetic Engineering' }];

async function fixture(environment: 'stage' | 'production', settings: NodeJS.ProcessEnv, testDisabledVerifier = false) {
  const db = await privilegeFixture();
  const server = createServer();
  async function close() {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close();
  }
  try {
    await migrate(db.migration);
    await grantApplicationPrivileges(db.migration, db.roles);
    await db.admin.query(
      "INSERT INTO departments(id,name,deleted_at) VALUES ($1,'Synthetic Engineering',NULL),($2,'Archived Design',now())",
      [departmentId, archivedId],
    );
    for (const person of ['owner', 'member', 'other']) await approveEmail(db.admin, person + '@example.test');
    const provider: IdentityProvider = {
      authorizationUrl: state => '/auth/jesusfilm/callback?' + new URLSearchParams({ state, code: nextAccount }),
      exchange: async code => ({ sub: 'jesusfilm:' + code, name: code, email: code + '@example.test' }),
    };
    let nextAccount = '';
    await once(server.listen(0, '127.0.0.1'), 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const origin = 'http://127.0.0.1:' + address.port;
    const appOrigin = 'https://lantern.example.test';
    const config = resolveRuntime({
      LANTERN_ENV: environment,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://unused',
      APP_ORIGIN: appOrigin,
      AUTH_CLIENT_ID: 'synthetic-browser-client',
      ...settings,
    });
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const jwk = { ...await exportJWK(publicKey), kid: 'owner-api-test', alg: 'EdDSA' };
    let jwksRequests = 0;
    const jwksFetch: typeof fetch = async url => {
      jwksRequests++;
      assert.equal(String(url), issuer + '/jwks');
      return Response.json({ keys: [jwk] });
    };
    const ownerApi = config.ownerApi ?? (testDisabledVerifier
      ? { environment: 'staging' as const, ownerEmails: new Set(['owner@example.test']) }
      : undefined);
    server.on('request', createApp(db.runtime, {
      origin: config.origin,
      features: config.features,
      flagOwnerEmail: config.flagOwnerEmail,
      provider,
      ownerApi: ownerApi && { ...ownerApi, fetch: jwksFetch },
    }, { canonicalRedirect: environment === 'production' }));

    function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
      return new Promise<Response>((resolve, reject) => {
        const sent = httpRequest(origin + path, {
          method: init.method, headers: { Host: new URL(appOrigin).host, ...init.headers },
        }, incoming => {
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
          incoming.on('error', reject);
          incoming.on('end', () => {
            const headers = new Headers();
            for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
              headers.append(incoming.rawHeaders[i]!, incoming.rawHeaders[i + 1]!);
            }
            const status = incoming.statusCode!;
            resolve(new Response(status === 204 ? null : Buffer.concat(chunks).toString(), { status, headers }));
          });
        });
        sent.on('error', reject);
        sent.end(init.body);
      });
    }
    async function signIn(who: 'owner' | 'member' | 'other') {
      nextAccount = who;
      const start = await request('/auth/jesusfilm');
      assert.equal(start.status, 302);
      const login = start.headers.get('set-cookie')?.split(';')[0];
      assert.ok(login);
      const callback = await request(start.headers.get('location')!, { headers: { Cookie: login } });
      assert.equal(callback.headers.get('location'), '/');
      const session = callback.headers.getSetCookie().find(cookie => cookie.startsWith('__Host-lantern-session='))?.split(';')[0];
      assert.ok(session);
      return session;
    }
    function sign(claims: Record<string, unknown> = {}, key = privateKey) {
      return new SignJWT({
        iss: issuer,
        aud: [appOrigin + '/mcp', issuer + '/oauth2/userinfo'],
        sub: 'owner',
        exp: Math.floor(Date.now() / 1000) + 300,
        scope: 'openid lantern:admin',
        'https://jesusfilm.org/claims/environment': 'staging',
        'https://jesusfilm.org/claims/app': 'lantern-mcp',
        ...claims,
      }).setProtectedHeader({ alg: 'EdDSA', kid: 'owner-api-test' }).sign(key);
    }
    return { appOrigin, close, db, request, sign, signIn, jwksRequests: () => jwksRequests };
  } catch (error) {
    await close();
    throw error;
  }
}

const bearer = (token: string) => ({ Authorization: 'Bearer ' + token });
const ownerSettings = { LANTERN_FEATURES: 'owner-api=on', LANTERN_ADMIN_API_OWNER_EMAILS: ' Other@Example.test, OWNER@example.test ' };

test('a linked owner without browser approval or membership can list only active department IDs and names through REST', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');
  await revokeEmail(f.db.admin, 'owner@example.test');

  const response = await f.request('/api/v1/departments', { headers: bearer(await f.sign()) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { departments });
  assert.equal(f.jwksRequests(), 1);
});

const rpc = (method: string, params?: unknown, id: number | string | undefined = 1) => ({
  jsonrpc: '2.0', id, method, params,
});

function mcpRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
  };
}

test('MCP guides a signed-out client to JFP One and exposes the shared read to the linked owner', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');

  const initialize = rpc('initialize', {
    protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' },
  });
  const anonymous = await f.request('/mcp', mcpRequest(initialize));
  assert.equal(anonymous.status, 401);
  const challenge = `Bearer resource_metadata="${f.appOrigin}/.well-known/oauth-protected-resource", scope="lantern:admin"`;
  assert.equal(anonymous.headers.get('www-authenticate'), challenge);
  assert.equal((await f.request('/api/v1/departments')).headers.get('www-authenticate'), challenge);
  const metadata = await f.request('/.well-known/oauth-protected-resource');
  assert.equal(metadata.status, 200);
  assert.deepEqual(await metadata.json(), {
    resource: f.appOrigin + '/mcp', authorization_servers: [issuer],
    scopes_supported: ['lantern:admin'], bearer_methods_supported: ['header'],
  });
  assert.equal(f.jwksRequests(), 0);

  const token = bearer(await f.sign());
  const send = (body: unknown) => f.request('/mcp', mcpRequest(body, token));
  const initial = await send(initialize);
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), {
    jsonrpc: '2.0', id: 1,
    result: { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'lantern', version: '0.1.0' } },
  });
  const ready = await send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(ready.status, 202);
  assert.equal(await ready.text(), '');
  const tools = await send(rpc('tools/list', undefined, 'catalogue'));
  assert.equal(tools.status, 200);
  const listing = await tools.json() as {
    id: string;
    result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
  };
  assert.equal(listing.id, 'catalogue');
  assert.deepEqual(listing.result.tools.map(tool => tool.name), ['departments.list']);
  assert.equal(listing.result.tools[0]?.annotations.readOnlyHint, true);

  const result = await send(rpc('tools/call', { name: 'departments.list', arguments: {} }, 0));
  assert.equal(result.status, 200);
  const message = await result.json() as {
    id: number;
    result: { structuredContent: unknown; content: [{ text: string }] };
  };
  assert.equal(message.id, 0);
  assert.deepEqual(message.result.structuredContent, { departments });
  assert.deepEqual(JSON.parse(message.result.content[0].text), { departments });
  assert.equal(f.jwksRequests(), 1, 'the published key set is reused between requests');
});

test('both owner adapters accept the Lantern resource alone or paired only with JFP One UserInfo', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');
  const resource = f.appOrigin + '/mcp';
  const userInfo = issuer + '/oauth2/userinfo';
  for (const aud of [resource, [resource], [resource, userInfo], [userInfo, resource]]) {
    const headers = bearer(await f.sign({ aud }));
    const rest = await f.request('/api/v1/departments', { headers });
    const mcp = await f.request('/mcp', mcpRequest(rpc('tools/call', { name: 'departments.list' }), headers));
    assert.equal(rest.status, 200);
    assert.deepEqual(await rest.json(), { departments });
    assert.equal(mcp.status, 200);
    const result = await mcp.json() as { result: { structuredContent: unknown } };
    assert.deepEqual(result.result.structuredContent, { departments });
  }
  for (const aud of [
    userInfo, [userInfo, 'https://other.example.test/mcp'],
    [resource, resource], [resource, userInfo, 'https://other.example.test/mcp'],
    [resource, userInfo + '/'], [resource, 'https://other.example.test/api/auth/oauth2/userinfo'],
  ]) {
    const headers = bearer(await f.sign({ aud }));
    for (const result of [
      await f.request('/api/v1/departments', { headers }),
      await f.request('/mcp', mcpRequest(rpc('tools/list'), headers)),
    ]) {
      assert.equal(result.status, 401);
      assert.deepEqual(await result.json(), { error: 'A valid JFP One access token is required.' });
    }
  }
});

test('owner endpoints refuse invalid tokens and accounts without exposing departments', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');
  await f.signIn('member');
  await f.db.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES(gen_random_uuid(),'legacy','other@example.test','Legacy account')");

  const { privateKey: wrongKey } = await generateKeyPair('EdDSA');
  const cases: { label: string; claims?: JWTPayload; key?: typeof wrongKey; status?: number }[] = [
    { label: 'wrong signature', key: wrongKey },
    { label: 'wrong issuer', claims: { iss: 'https://other.example.test' } },
    { label: 'wrong audience', claims: { aud: f.appOrigin + '/api/v1' } },
    { label: 'multiple audiences', claims: { aud: [f.appOrigin + '/mcp', 'https://other.example.test/mcp'] } },
    { label: 'expired', claims: { exp: 1 } },
    { label: 'missing expiry', claims: { exp: undefined } },
    { label: 'missing scope', claims: { scope: undefined }, status: 403 },
    { label: 'similar scope', claims: { scope: 'openid lantern:admin:read' }, status: 403 },
    { label: 'wrong environment', claims: { 'https://jesusfilm.org/claims/environment': 'local' } },
    { label: 'wrong app', claims: { 'https://jesusfilm.org/claims/app': 'admin-mcp' } },
    { label: 'missing app', claims: { 'https://jesusfilm.org/claims/app': undefined } },
    { label: 'missing subject', claims: { sub: undefined } },
    { label: 'unknown subject with owner email claim', claims: { sub: 'unknown', email: 'owner@example.test', email_verified: true }, status: 403 },
    { label: 'legacy account without namespaced subject', claims: { sub: 'legacy' }, status: 403 },
    { label: 'linked non-owner', claims: { sub: 'member', email: 'owner@example.test', email_verified: true }, status: 403 },
  ];
  for (const { label, claims, key, status = 401 } of cases) {
    const headers = bearer(await f.sign(claims, key));
    const rest = await f.request('/api/v1/departments', { headers });
    const mcp = await f.request('/mcp', mcpRequest(rpc('tools/call', { name: 'departments.list' }), headers));
    for (const response of [rest, mcp]) {
      assert.equal(response.status, status, label);
      const body = await response.json();
      assert.ok(body && typeof body === 'object', label);
      assert.deepEqual(Object.keys(body), ['error'], label);
      if (status === 401) assert.match(response.headers.get('www-authenticate') ?? '', /resource_metadata=/, label);
    }
  }
});

test('signed malformed subjects are rejected before querying linked accounts', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  // A lookup would fail with 503 while the account table is unavailable.
  await f.db.migration.query('ALTER TABLE users RENAME TO unavailable_users');
  for (const sub of [42, true, ['owner'], { id: 'owner' }, '', '  ']) {
    const headers = bearer(await f.sign({ sub }));
    const rest = await f.request('/api/v1/departments', { headers });
    const mcp = await f.request('/mcp', mcpRequest(rpc('tools/list'), headers));
    for (const result of [rest, mcp]) {
      assert.equal(result.status, 401);
      assert.match(result.headers.get('www-authenticate') ?? '', /resource_metadata=/);
      assert.deepEqual(await result.json(), { error: 'A valid JFP One access token is required.' });
    }
  }
});

test('an empty API owner list grants nobody access, independently of the feature-flag page owner', async t => {
  const f = await fixture('stage', { LANTERN_FEATURES: 'owner-api=on', LANTERN_FLAG_OWNER_EMAIL: 'owner@example.test' });
  t.after(f.close);
  await f.signIn('owner');
  const headers = bearer(await f.sign());
  assert.equal((await f.request('/api/v1/departments', { headers })).status, 403);
  assert.equal((await f.request('/mcp', mcpRequest(rpc('tools/list'), headers))).status, 403);
});

test('the MCP endpoint validates origins, protocol versions and tool requests', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');
  const token = bearer(await f.sign());

  for (const headers of [{ ...token, Origin: 'https://foreign.example.test' }, { ...token, Host: 'foreign.example.test' }]) {
    assert.equal((await f.request('/mcp', mcpRequest(rpc('tools/list'), headers))).status, 403);
  }
  assert.equal(f.jwksRequests(), 0);
  const stream = await f.request('/mcp', { headers: token });
  assert.equal(stream.status, 405);
  assert.equal(stream.headers.get('allow'), 'POST');

  const unsupported = await f.request('/mcp', mcpRequest(rpc('tools/list'), { ...token, 'MCP-Protocol-Version': '1900-01-01' }));
  assert.equal(unsupported.status, 400);
  const malformed = await f.request('/mcp', { ...mcpRequest({}, token), body: '{' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json() as { error: { code: number } }).error.code, -32700);
  const batch = await f.request('/mcp', mcpRequest([rpc('tools/list')], token));
  assert.equal(batch.status, 400);
  assert.equal((await batch.json() as { error: { code: number } }).error.code, -32600);

  for (const params of [{ name: 'departments.create' }, { name: 'departments.list', arguments: { owner: true } }]) {
    const refused = await f.request('/mcp', mcpRequest(rpc('tools/call', params), token));
    assert.deepEqual(await refused.json(), {
      jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'Use departments.list without arguments.' },
    });
  }
});

test('flag-off requests on the canonical host return 404 before JWKS, origin checks or body parsing', async t => {
  for (const environment of ['production', 'stage'] as const) {
    const f = await fixture(environment, environment === 'stage'
      ? { LANTERN_FEATURES: 'owner-api=off', LANTERN_ADMIN_API_OWNER_EMAILS: 'owner@example.test' }
      : {}, environment === 'stage');
    await t.test(environment, async check => {
      check.after(f.close);
      const health = await f.request('/health');
      assert.equal(health.status, 200);
      assert.equal(health.headers.get('x-lantern-schema'), '20');
      for (const headers of [{}, bearer(await f.sign())]) {
        const attempts = [
          await f.request('/api/v1/departments', { headers }),
          await f.request('/mcp', { ...mcpRequest({}, headers), body: '{' }),
          await f.request('/mcp', { headers }),
          await f.request('/.well-known/oauth-protected-resource', { headers }),
        ];
        for (const response of attempts) {
          assert.equal(response.status, 404);
          assert.equal(response.headers.get('www-authenticate'), null);
          assert.deepEqual(await response.json(), { error: 'Not found.' });
        }
      }
      if (environment === 'production') {
        const alias = { Host: 'alternate.example.test' };
        for (const path of ['/api/v1/departments', '/mcp', '/.well-known/oauth-protected-resource']) {
          const response = await f.request(path + '?probe=1', path === '/mcp'
            ? { ...mcpRequest({}, alias), body: '{' }
            : { headers: alias });
          assert.equal(response.status, 308);
          assert.equal(response.headers.get('location'), f.appOrigin + path + '?probe=1');
        }
      }
      assert.equal(f.jwksRequests(), 0);
    });
  }
});

test('browser admission and origin checks, feature-report ownership and team bearer routes hold with the owner flag on or off', async t => {
  for (const enabled of [false, true]) {
    const f = await fixture(enabled ? 'stage' : 'production', {
      ...(enabled ? ownerSettings : {}),
      LANTERN_FEATURES: 'team-api=on,owner-api=' + (enabled ? 'on' : 'off'),
      LANTERN_FLAG_OWNER_EMAIL: 'member@example.test',
    });
    await t.test(enabled ? 'stage on' : 'production off', async check => {
      check.after(f.close);
      const document = await f.request('/');
      assert.equal(document.status, 302);
      assert.equal(document.headers.get('location'), '/auth/jesusfilm');
      const owner = await f.signIn('owner');
      const member = await f.signIn('member');
      await f.db.admin.query(
        "INSERT INTO memberships(user_id,department_id,role) SELECT id,$1,'member' FROM users WHERE google_sub='jesusfilm:member'",
        [departmentId],
      );
      const session = { Cookie: member };
      const jfp = bearer(await f.sign());
      const apiOwnerRead = await f.request('/api/v1/departments', { headers: { Cookie: owner } });
      assert.equal(apiOwnerRead.status, enabled ? 401 : 404);
      const sessionRead = await f.request('/api/session', { headers: session });
      assert.equal(sessionRead.status, 200);
      const sessionData = await sessionRead.json() as { user: { email: string } };
      assert.equal(sessionData.user.email, 'member@example.test');
      assert.equal((await f.request('/ops/feature-flags', { headers: { Cookie: owner } })).status, 403);
      const report = await f.request('/ops/feature-flags', { headers: session });
      assert.equal(report.status, 200);
      assert.match(await report.text(), new RegExp('<th scope="row">owner-api</th><td>' + (enabled ? 'on' : 'off') + '</td>'));

      const patch = (headers: Record<string, string>) => f.request('/api/account', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...session, ...headers }, body: '{"name":"Changed"}',
      });
      assert.equal((await patch({ Origin: 'https://foreign.example.test' })).status, 403);
      assert.equal((await patch({ Origin: f.appOrigin, ...jfp })).status, 401);
      assert.equal((await patch({ Origin: f.appOrigin })).status, 200);

      const create = await f.request('/api/team-api-tokens', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...session, Origin: f.appOrigin }, body: '{"name":"Synthetic TV"}',
      });
      assert.equal(create.status, 201);
      const created = await create.json() as { token: string };
      const tv = bearer(created.token);
      const team = '/api/v1/team-updates?date=2026-11-19';
      assert.equal((await f.request(team, { headers: tv })).status, 200);
      for (const path of [team, '/api/v1/github-avatars/octocat']) {
        const refused = await f.request(path, { headers: { ...session, ...jfp } });
        assert.equal(refused.status, 401);
        assert.equal(refused.headers.get('www-authenticate'), 'Bearer realm="Lantern team API"');
      }
      assert.equal((await patch({ Origin: f.appOrigin, ...tv })).status, 401);
      assert.equal((await f.request('/api/guide', { headers: { ...session, ...jfp } })).status, 401);
      assert.equal((await f.request('/ops/feature-flags', { headers: { ...session, ...jfp } })).status, 401);
      for (const response of [
        await f.request('/api/v1/departments', { headers: { Cookie: owner, ...tv } }),
        await f.request('/mcp', mcpRequest(rpc('tools/list'), { Cookie: owner, ...tv })),
      ]) assert.equal(response.status, enabled ? 401 : 404);

      await revokeEmail(f.db.admin, 'member@example.test');
      assert.equal((await f.request('/ops/feature-flags', { headers: session })).status, 401);
      assert.equal((await f.request(team, { headers: tv })).status, 401);
      assert.equal(f.jwksRequests(), 0, 'the legacy routes and opaque team token never contact JFP One JWKS');
    });
  }
});

test('MCP returns a sanitized 415 for unsupported encoding or charset', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');
  const token = bearer(await f.sign());
  for (const headers of [
    { ...token, 'Content-Encoding': 'x-private-encoding' },
    { ...token, 'Content-Type': 'application/json; charset=x-private-charset' },
  ]) {
    const result = await f.request('/mcp', mcpRequest(rpc('tools/list'), headers));
    assert.equal(result.status, 415);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await result.json(), { error: 'Unsupported MCP request encoding or charset.' });
  }
});

test('both owner adapters refuse an ambiguous normalized email while identity recovery is pending', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');
  const headers = bearer(await f.sign());
  const browse = () => Promise.all([
    f.request('/api/v1/departments', { headers }),
    f.request('/mcp', mcpRequest(rpc('tools/call', { name: 'departments.list' }), headers)),
  ]);
  const expectDenied = async () => {
    for (const result of await browse()) {
      assert.equal(result.status, 403);
      assert.deepEqual(await result.json(), { error: 'Lantern owner access is required.' });
    }
  };

  await f.db.admin.query(`INSERT INTO auth_identity_candidates(subject,email,verified_at)
    VALUES ('jesusfilm:owner','owner@example.test',now()),
           ('jesusfilm:other-subject','owner@example.test',now()-interval '2 days')`);
  for (const result of await browse()) assert.equal(result.status, 200);
  await f.db.admin.query("UPDATE auth_identity_candidates SET verified_at=now() WHERE subject='jesusfilm:other-subject'");
  await expectDenied();
  await f.db.admin.query("DELETE FROM auth_identity_candidates WHERE subject='jesusfilm:other-subject'");

  await f.db.admin.query(`INSERT INTO users(id,google_sub,email,name)
    VALUES(gen_random_uuid(),'jesusfilm:duplicate',' OWNER@Example.test ','Synthetic duplicate')`);
  await expectDenied();
});

test('owner API preview requires both owner and preview allowlists across REST and MCP', async t => {
  const f = await fixture('stage', {
    LANTERN_FEATURES: 'owner-api=preview',
    LANTERN_ADMIN_API_OWNER_EMAILS: 'owner@example.test, other@example.test',
    LANTERN_PREVIEW_EMAILS: ' OWNER@Example.test, member@example.test ',
  });
  t.after(f.close);
  for (const account of ['owner', 'other', 'member'] as const) await f.signIn(account);
  assert.equal((await f.request('/.well-known/oauth-protected-resource')).status, 200);
  for (const [sub, status] of [['owner', 200], ['other', 404], ['member', 403]] as const) {
    const headers = bearer(await f.sign({ sub }));
    const rest = await f.request('/api/v1/departments', { headers });
    const mcp = await f.request('/mcp', mcpRequest(rpc('tools/call', { name: 'departments.list' }), headers));
    assert.equal(rest.status, status);
    assert.equal(mcp.status, status);
    if (status === 200) {
      assert.deepEqual(await rest.json(), { departments });
      const body = await mcp.json() as { result: { structuredContent: unknown } };
      assert.deepEqual(body.result.structuredContent, { departments });
    } else {
      const error = status === 404 ? 'Not found.' : 'Lantern owner access is required.';
      for (const response of [rest, mcp]) assert.deepEqual(await response.json(), { error });
    }
  }
});

test('MCP negotiates only supported versions and refuses the legacy batching version header', async t => {
  const f = await fixture('stage', ownerSettings);
  t.after(f.close);
  await f.signIn('owner');
  const token = bearer(await f.sign());
  for (const [requested, selected] of [
    ['2025-03-26', '2025-11-25'],
    ['2025-06-18', '2025-06-18'],
    ['2025-11-25', '2025-11-25'],
  ] as const) {
    const response = await f.request('/mcp', mcpRequest(rpc('initialize', { protocolVersion: requested }), token));
    assert.equal(response.status, 200);
    const body = await response.json() as { result: { protocolVersion: string } };
    assert.equal(body.result.protocolVersion, selected);
    const listing = await f.request('/mcp', mcpRequest(rpc('tools/list'), { ...token, 'MCP-Protocol-Version': selected }));
    assert.equal(listing.status, 200);
  }
  const legacy = await f.request('/mcp', mcpRequest(rpc('tools/list'), { ...token, 'MCP-Protocol-Version': '2025-03-26' }));
  assert.equal(legacy.status, 400);
  assert.deepEqual(await legacy.json(), { error: 'Unsupported MCP protocol version.' });
});
