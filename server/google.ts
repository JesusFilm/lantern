import { OAuth2Client } from 'google-auth-library';

export interface Identity { sub: string; email: string; name: string; hostedDomain: string }
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
        code_challenge_method: 'S256', prompt: 'select_account', hd: '*' }).toString();
      return url.href;
    },
    async exchange(code, verifier, nonce) {
      const { tokens } = await client.getToken({ code, codeVerifier: verifier });
      if (!tokens.id_token) throw new Error('Missing Google identity.');
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload || (payload as typeof payload & { nonce?: string }).nonce !== nonce ||
          !payload.sub || !payload.email || !payload.email_verified || !payload.hd) {
        throw new Error('A verified Google work account is required.');
      }
      return { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.name || payload.email,
        hostedDomain: payload.hd.toLowerCase() };
    },
  };
}
