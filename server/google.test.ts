import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { OAuth2Client } from 'google-auth-library';
import { googleProvider } from './google.js';

test('Google adapter validates signed identities, audience, issuer, expiry, nonce and verified email claims', async (t) => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const now = Math.floor(Date.now() / 1000);
  const base = { iss: 'https://accounts.google.com', aud: 'fixture-client', sub: 'fixture-sub',
    iat: now, exp: now + 3600, email: 'person@example.test', email_verified: true, hd: 'example.test', nonce: 'fixture-nonce' };
  let payload: Record<string, unknown> = base;
  let tamper = false;
  t.mock.method(OAuth2Client.prototype, 'getToken', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${header}.${body}`;
    const signature = sign('RSA-SHA256', Buffer.from(data), keys.privateKey).toString('base64url');
    return { tokens: { id_token: `${data}.${tamper ? 'invalid' : signature}` } };
  });
  t.mock.method(OAuth2Client.prototype, 'getFederatedSignonCertsAsync', async () => ({
    certs: { fixture: keys.publicKey.export({ type: 'spki', format: 'pem' }) }, format: 'PEM',
  }));
  const provider = googleProvider('fixture-client', 'fixture-secret', 'https://lantern.example.test');
  const authorization = new URL(provider.authorizationUrl('state', 'fixture-nonce', 'challenge'));
  assert.equal(authorization.origin, 'https://accounts.google.com');
  assert.equal(authorization.searchParams.get('redirect_uri'), 'https://lantern.example.test/auth/google/callback');
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.equal((await provider.exchange('code', 'verifier', 'fixture-nonce')).sub, 'fixture-sub');
  for (const change of [{ aud: 'wrong-client' }, { iss: 'https://evil.test' }, { exp: now - 3600 },
    { nonce: 'wrong' }, { email_verified: false }, { email_verified: 'true' }, { email: '' }, { sub: '' }]) {
    payload = { ...base, ...change };
    await assert.rejects(provider.exchange('code', 'verifier', 'fixture-nonce'));
  }
  payload = { ...base, email: ' Personal@Gmail.Com ', hd: undefined };
  const personal = await provider.exchange('code', 'verifier', 'fixture-nonce');
  assert.equal(personal.email, 'personal@gmail.com');
  assert.equal('hostedDomain' in personal, false);
  for (const hd of ['unlisted.test', '', 42]) {
    payload = { ...base, hd };
    assert.equal((await provider.exchange('code', 'verifier', 'fixture-nonce')).email, base.email);
  }
  assert.equal(authorization.searchParams.has('hd'), false);
  payload = base; tamper = true;
  await assert.rejects(provider.exchange('code', 'verifier', 'fixture-nonce'));
});
