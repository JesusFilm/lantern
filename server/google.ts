import { normalizeEmail } from './admission.js';
import { OAuth2Client } from 'google-auth-library';

export interface Identity { sub: string; email: string; name: string; hostedDomain: string | null }
export interface IdentityProvider {
  authorizationUrl(state: string, nonce: string, challenge: string): string;
  exchange(code: string, verifier: string, nonce: string): Promise<Identity>;
}
export function googleProvider(clientId: string, clientSecret: string, origin: string): IdentityProvider {
  const client = new OAuth2Client(clientId, clientSecret, `${origin}/auth/google/callback`);
  return {
    authorizationUrl(state, nonce, challenge) {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${origin}/auth/google/callback`,
        response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: challenge,
        code_challenge_method: 'S256', prompt: 'select_account' }).toString();
      return url.href;
    },
    async exchange(code, verifier, nonce) {
      const { tokens } = await client.getToken({ code, codeVerifier: verifier });
      if (!tokens.id_token) throw new Error('Missing Google identity.');
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload || (payload as typeof payload & { nonce?: string }).nonce !== nonce ||
          typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true ||
          (payload.hd !== undefined && (typeof payload.hd !== 'string' || !payload.hd.trim()))) {
        throw new Error('A verified Google account is required.');
      }
      return { sub: payload.sub, email: normalizeEmail(payload.email), name: payload.name || payload.email,
        hostedDomain: payload.hd?.trim().toLowerCase() ?? null };
    },
  };
}
