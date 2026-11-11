import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "./app.js";
import { coachingFixture, draft } from "./coach-test-support.js";
import type { Identity } from "./identity.js";
import type { SessionView } from "../shared/access.js";

test("an explicit administrative Auth match preserves one account, documents and authority without enabling runtime relinking", async () => {
  const f = await coachingFixture();
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  let identity: Identity = { sub: "jesusfilm:other-person", email: "peer@example.test", name: "Peer" };
  server.on("request", createApp(f.runtime, {
    origin,
    provider: { authorizationUrl: state => `/auth/jesusfilm/callback?state=${state}&code=test`, exchange: async () => identity },
  }));
  async function login() {
    const start = await fetch(origin + "/auth/jesusfilm", { redirect: "manual" });
    const response = await fetch(origin + start.headers.get("location"), { redirect: "manual", headers: { Cookie: start.headers.get("set-cookie")!.split(";")[0]! } });
    const cookie = response.headers.getSetCookie().find(value => value.startsWith("lantern-session="))?.split(";")[0] ?? "";
    const session = await (await fetch(origin + "/api/session", { headers: { Cookie: cookie } })).json() as SessionView;
    return { response, cookie, session };
  }
  try {
    const created = await f.request("lead", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const focus = await created.json();
    const peer = await login();
    assert.notEqual(peer.session.user?.id, f.ids.peer, "matching other emails does not migrate accounts");
    assert.equal(peer.session.department, undefined);

    const link = (subject: string, email = "lead@example.test") => promisify(execFile)(process.execPath, ["--import", "tsx", "server/operations.ts", "link-auth", f.ids.lead, subject, email], { env: {
      ...process.env, LANTERN_ENV: "local", ADMIN_DATABASE_URL: f.admin.options.connectionString,
      LANTERN_DB_NAME: f.databaseName, LANTERN_DB_SCHEMA: "lantern", LANTERN_DB_RUNTIME_ROLE: f.roles.runtime,
      LANTERN_DB_MIGRATION_ROLE: f.roles.migration, LANTERN_DB_ADMIN_ROLE: f.roles.admin,
    } });
    await assert.rejects(link("stable-lead", "peer@example.test"));
    await link("stable-lead");
    await link("stable-lead");
    await assert.rejects(link("different-subject"));
    identity = { sub: "jesusfilm:stable-lead", email: "lead@example.test", name: "Lead from Auth" };
    await f.migration.query(`CREATE FUNCTION reject_auth_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic session failure'; END $$;
      CREATE TRIGGER reject_auth_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_auth_session()`);
    assert.equal((await login()).response.status, 503);
    await f.migration.query("DROP TRIGGER reject_auth_session ON sessions; DROP FUNCTION reject_auth_session()");
    const linked = await login();
    assert.equal(linked.response.headers.get("location"), "/");
    assert.equal(linked.session.user?.id, f.ids.lead);
    assert.equal(linked.session.user?.name, "lead", "existing profile is preserved");
    assert.equal(linked.session.department?.role, "career-lead");
    assert.equal((await fetch(`${origin}/api/focuses/${focus.id}`, { headers: { Cookie: linked.cookie } })).status, 200);
    assert.equal((await login()).session.user?.id, f.ids.lead, "repeat sign-in uses the stable subject");
    identity = { ...identity, sub: "jesusfilm:another-subject" };
    assert.equal((await login()).session.department, undefined, "a different Auth subject cannot inherit authority by email");
    identity = { ...identity, sub: "jesusfilm:stable-lead", email: "unapproved@example.test" };
    assert.equal((await login()).response.headers.get("location"), "/?signInError=1");
    assert.equal((await fetch(origin + "/auth/google", { redirect: "manual" })).status, 404);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    await f.close();
  }
});
