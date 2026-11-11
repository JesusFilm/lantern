import { createRemoteJWKSet, customFetch, jwtVerify } from "jose";
import { normalizeEmail } from "./admission.js";
import type { IdentityProvider } from "./identity.js";

export const jesusFilmIssuer = "https://auth.jesusfilm.org/api/auth";

/** Public authorization-code client: PKCE binds the code; tokens stay on the server. */
export function jesusFilmProvider(clientId: string, origin: string, dependencies: {
  issuer?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
} = {}): IdentityProvider {
  const issuer = dependencies.issuer ?? jesusFilmIssuer;
  const request = dependencies.fetch ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? 5000;
  const callback = `${origin}/auth/jesusfilm/callback`;
  const keys = createRemoteJWKSet(new URL(`${issuer}/jwks`), {
    timeoutDuration: timeoutMs,
    [customFetch]: (url, options) => request(url, { ...options, redirect: "error" }),
  });
  return {
    authorizationUrl(state, nonce, challenge) {
      const url = new URL(`${issuer}/oauth2/authorize`);
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", prompt: "login",
        scope: "openid profile:read email:read", state, nonce, code_challenge: challenge, code_challenge_method: "S256" }).toString();
      return url.href;
    },
    async exchange(code, verifier, nonce) {
      try {
        const response = await request(`${issuer}/oauth2/token`, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: callback, code, code_verifier: verifier }),
        });
        if (!response.ok) throw new Error();
        const text = await response.text();
        if (text.length > 65536) throw new Error();
        const tokens: unknown = JSON.parse(text);
        if (!tokens || typeof tokens !== "object" || !("id_token" in tokens) || typeof tokens.id_token !== "string" || tokens.id_token.length > 16384) throw new Error();
        const { payload } = await jwtVerify(tokens.id_token, keys, {
          issuer, audience: clientId, algorithms: ["EdDSA", "RS256", "ES256"],
          requiredClaims: ["sub", "exp", "iat", "nonce"], maxTokenAge: "10m", clockTolerance: 5,
        });
        if ((payload.azp !== undefined && payload.azp !== clientId) ||
          (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId) ||
          !payload.sub || payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== "string" ||
          payload["https://jesusfilm.org/claims/actor_type"] !== "human") throw new Error();
        const email = normalizeEmail(payload.email);
        return { sub: `jesusfilm:${payload.sub}`, email, name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email };
      } catch { throw new Error("Jesus Film sign-in could not be verified."); }
    },
  };
}
