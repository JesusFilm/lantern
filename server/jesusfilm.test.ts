import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { jesusFilmProvider } from "./jesusfilm.js";

test("Jesus Film OIDC uses PKCE and verifies signed identity, issuer, audience, expiry, nonce and email", async () => {
  const keys = await generateKeyPair("EdDSA");
  const jwk = { ...await exportJWK(keys.publicKey), kid: "fixture", alg: "EdDSA" };
  let payload: Record<string, unknown> = {};
  let mode = "ok";
  let form = new URLSearchParams();
  const server = createServer(async (req, res) => {
    if (req.url === "/api/auth/jwks") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    form = new URLSearchParams(body);
    if (mode === "failure") { res.writeHead(503).end("private provider detail"); return; }
    if (mode === "malformed") { res.end("not JSON"); return; }
    const token = await new SignJWT(payload).setProtectedHeader({ alg: "EdDSA", kid: "fixture" }).sign(keys.privateKey);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(mode === "missing" ? { access_token: token } : { id_token: mode === "tampered" ? token + "invalid" : token }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const issuer = `http://127.0.0.1:${address.port}/api/auth`;
  const now = Math.floor(Date.now() / 1000);
  const base = { iss: issuer, aud: "fixture-client", sub: "fixture-sub", iat: now, exp: now + 3600,
    nonce: "fixture-nonce", email: " Person@Example.Test ", email_verified: true, name: "Person",
    "https://jesusfilm.org/claims/actor_type": "human" };
  payload = base;
  try {
    const provider = jesusFilmProvider("fixture-client", "https://lantern.example.test", { issuer });
    const url = new URL(provider.authorizationUrl("state", "fixture-nonce", "challenge"));
    assert.equal(url.origin, new URL(issuer).origin);
    assert.equal(url.pathname, "/api/auth/oauth2/authorize");
    assert.equal(url.searchParams.get("redirect_uri"), "https://lantern.example.test/auth/jesusfilm/callback");
    assert.equal(url.searchParams.get("scope"), "openid profile:read email:read");
    assert.equal(url.searchParams.get("prompt"), "login");
    assert.equal(url.searchParams.get("state"), "state");
    assert.equal(url.searchParams.get("nonce"), "fixture-nonce");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.deepEqual(await provider.exchange("code", "verifier", "fixture-nonce"), { sub: "jesusfilm:fixture-sub", email: "person@example.test", name: "Person" });
    assert.equal(form.get("code_verifier"), "verifier");
    assert.equal(form.get("client_id"), "fixture-client");
    assert.equal(form.get("client_secret"), null);
    assert.equal(form.get("redirect_uri"), url.searchParams.get("redirect_uri"));
    for (const change of [{ aud: "wrong-client" }, { azp: "different-client" }, { aud: ["fixture-client", "other-client"] }, { iss: "https://evil.test" }, { exp: now - 60 }, { exp: undefined },
      { nonce: "wrong" }, { nonce: undefined }, { email_verified: false }, { email_verified: "true" }, { email: "" }, { sub: "" },
      { "https://jesusfilm.org/claims/actor_type": "agent" }]) {
      payload = { ...base, ...change };
      await assert.rejects(provider.exchange("code", "verifier", "fixture-nonce"));
    }
    payload = base;
    for (mode of ["failure", "malformed", "missing", "tampered"]) {
      await assert.rejects(provider.exchange("code", "verifier", "fixture-nonce"), error => {
        assert.doesNotMatch(String(error), /private provider detail|eyJ/);
        return true;
      });
    }
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
