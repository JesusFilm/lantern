export interface Identity { sub: string; email: string; name: string }
export interface IdentityProvider {
  authorizationUrl(state: string, nonce: string, challenge: string): string;
  exchange(code: string, verifier: string, nonce: string): Promise<Identity>;
}
