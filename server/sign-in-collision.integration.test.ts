import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { createApp } from "./app.js";
import { coachingFixture, draft } from "./coach-test-support.js";
import type { SessionView } from "../shared/access.js";

test("an unmatched Auth subject cannot create a second account for an existing member's email", async () => {
  const f = await coachingFixture();
  const server = createServer();
  try {
    const created = await f.request("lead", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const focus = await created.json();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    server.on("request", createApp(f.runtime, {
      origin,
      provider: {
        authorizationUrl: state => `/auth/jesusfilm/callback?state=${state}&code=test`,
        exchange: async () => ({ sub: "jesusfilm:new-lead-subject", email: "lead@example.test", name: "Lead from Auth" }),
      },
    }));
    const start = await fetch(origin + "/auth/jesusfilm", { redirect: "manual" });
    const callback = await fetch(origin + start.headers.get("location"), {
      redirect: "manual", headers: { Cookie: start.headers.getSetCookie()[0]!.split(";")[0]! },
    });
    const sessionCookie = callback.headers.getSetCookie().find(value => value.startsWith("lantern-session="))?.split(";")[0] ?? "";
    const result = await (await fetch(origin + "/api/session", { headers: { Cookie: sessionCookie } })).json() as SessionView;
    // First establish the reported symptom without assuming email proves identity.
    assert.ok(!result.user || result.user.id === f.ids.lead,
      `Sign-in created a duplicate account without the existing department (department present: ${!!result.department}).`);
    assert.equal(callback.headers.get("location"), "/?signInError=1", "unmatched identity requires explicit recovery");
    assert.equal(sessionCookie, "");
    assert.equal((await f.admin.query("SELECT id FROM users WHERE email='lead@example.test'")).rowCount, 1);
    const original = await (await f.request("lead", "/api/session")).json() as SessionView;
    assert.equal(original.user?.id, f.ids.lead);
    assert.equal(original.department?.role, "career-lead");
    assert.equal((await f.request("lead", `/api/focuses/${focus.id}`)).status, 200);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await f.close();
  }
});

test('a lead cannot enroll an unresolved duplicate through HTTP or the runtime database function', async () => {
  const f = await coachingFixture();
  try {
    const { randomUUID } = await import('node:crypto');
    const duplicate = randomUUID();
    await f.admin.query("INSERT INTO users VALUES($1,'jesusfilm:duplicate-peer','peer@example.test','Duplicate')", [duplicate]);
    const result = await f.request('lead', '/api/department/members', 'POST', { userId: duplicate });
    assert.equal(result.status, 409);
    await assert.rejects(f.runtime.query('SELECT enroll_member($1,$2)', [f.ids.lead, duplicate]), { code: 'P0409' });
    const users = await (await f.request('lead', '/api/department/registered-users')).json();
    assert.equal(users.find((user: { id: string }) => user.id === duplicate).status, 'identity-conflict');
    assert.equal(users.find((user: { id: string }) => user.id === f.ids.peer).status, 'identity-conflict');
    assert.equal((await f.admin.query('SELECT user_id FROM memberships WHERE user_id=$1', [duplicate])).rowCount, 0);
  } finally { await f.close(); }
});

async function signInFixture() {
  const f = await coachingFixture();
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const identities = new Map<string, import('./identity.js').Identity>();
  server.on('request', createApp(f.runtime, { origin, provider: {
    authorizationUrl: state => `/auth/jesusfilm/callback?state=${state}&code=test`,
    exchange: async code => identities.get(code)!,
  } }));
  async function login(sub: string, email: string) {
    const { randomUUID } = await import('node:crypto');
    const code = randomUUID(); identities.set(code, { sub, email, name: 'From JFP' });
    const start = await fetch(origin + '/auth/jesusfilm', { redirect: 'manual' });
    const callback = new URL(start.headers.get('location')!, origin); callback.searchParams.set('code', code);
    const response = await fetch(callback, { redirect: 'manual', headers: { Cookie: start.headers.getSetCookie()[0]!.split(';')[0]! } });
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('lantern-session='))?.split(';')[0] ?? '';
    const session = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json() as SessionView;
    return { response, cookie, session };
  }
  return { ...f, login, async close() {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await f.close();
  } };
}

test('concurrent first sign-ins cannot create two accounts for one approved email', async () => {
  const f = await signInFixture();
  try {
    await f.admin.query("INSERT INTO approved_emails VALUES('fresh@example.test')");
    const results = await Promise.all([f.login('jesusfilm:first', 'fresh@example.test'), f.login('jesusfilm:second', ' FRESH@EXAMPLE.TEST ')]);
    assert.deepEqual(results.map(result => !!result.cookie).sort(), [false, true]);
    assert.equal((await f.admin.query("SELECT id FROM users WHERE lower(btrim(email))='fresh@example.test'")).rowCount, 1);
    const winner = results.find(result => result.cookie)!;
    const subject = (await f.admin.query('SELECT google_sub FROM users WHERE id=$1', [winner.session.user!.id])).rows[0].google_sub;
    const again = await Promise.all([f.login(subject, 'fresh@example.test'), f.login(subject, 'fresh@example.test')]);
    assert.ok(again.every(result => result.session.user?.id === winner.session.user!.id));
  } finally { await f.close(); }
});

test('normalized collisions, pre-existing duplicates and conflicting email changes never transfer authority', async () => {
  const f = await signInFixture();
  try {
    await f.admin.query("UPDATE users SET email=' Lead@Example.Test ' WHERE id=$1", [f.ids.lead]);
    assert.equal((await f.login('jesusfilm:unknown', 'lead@example.test')).cookie, '');
    const { randomUUID } = await import('node:crypto');
    await f.admin.query("INSERT INTO users VALUES($1,'jesusfilm:existing-duplicate','lead@example.test','Duplicate')", [randomUUID()]);
    assert.equal((await f.login('jesusfilm:existing-duplicate', 'lead@example.test')).cookie, '');
    assert.equal((await f.request('lead', '/api/focuses')).status, 200, 'collision refusal preserves existing sessions until coordinated cutover');
    const original = await (await f.request('lead', '/api/session')).json() as SessionView;
    assert.equal(original.department?.role, 'career-lead');
    assert.equal((await f.login(f.ids.member, 'peer@example.test')).cookie, '');
    assert.equal((await f.admin.query('SELECT email FROM users WHERE id=$1', [f.ids.member])).rows[0].email, 'member@example.test');
    assert.equal((await f.login('jesusfilm:unapproved', 'unapproved@example.test')).cookie, '');
  } finally { await f.close(); }
});

test('a refused verified JFP sign-in supplies a private, expiring recovery plan discoverable by email', async () => {
  const f = await signInFixture();
  try {
    const { planAuthRecoveryByEmail, applyAuthRecovery } = await import('./auth-recovery.js');
    await assert.rejects(planAuthRecoveryByEmail(f.admin, 'lead@example.test'));
    assert.equal((await f.login('jesusfilm:verified-attempt', 'lead@example.test')).cookie, '');
    const plan = await planAuthRecoveryByEmail(f.admin, ' LEAD@EXAMPLE.TEST ');
    assert.equal(plan.mapping.accountId, f.ids.lead);
    assert.equal(plan.mapping.duplicateAccountId, undefined);
    assert.equal(plan.summary.department, 'Engineering');
    assert.ok(plan.candidateVerifiedAt);
    await f.admin.query("UPDATE auth_identity_candidates SET verified_at=now()-interval '2 days'");
    await assert.rejects(applyAuthRecovery(f.admin, plan), /Auth recovery refused/);
    assert.equal((await f.request('lead', '/api/focuses')).status, 200);
    assert.equal((await f.login('jesusfilm:verified-attempt', 'lead@example.test')).cookie, '');
    const fresh = await planAuthRecoveryByEmail(f.admin, 'lead@example.test');
    await applyAuthRecovery(f.admin, fresh);
    const signedIn = await f.login('jesusfilm:verified-attempt', 'lead@example.test');
    assert.equal(signedIn.session.user?.id, f.ids.lead);
    assert.equal(signedIn.session.department?.role, 'career-lead');
    assert.equal((await f.admin.query('SELECT subject FROM auth_identity_candidates')).rowCount, 0);
  } finally { await f.close(); }
});

test('email lookup refuses multiple original accounts or multiple verified JFP identities', async () => {
  const f = await signInFixture();
  try {
    const { planAuthRecoveryByEmail } = await import('./auth-recovery.js');
    await f.login('jesusfilm:first-attempt', 'lead@example.test');
    await f.login('jesusfilm:second-attempt', 'lead@example.test');
    await assert.rejects(planAuthRecoveryByEmail(f.admin, 'lead@example.test'));
    await f.admin.query("DELETE FROM auth_identity_candidates WHERE subject='jesusfilm:second-attempt'");
    const { randomUUID } = await import('node:crypto');
    await f.admin.query("INSERT INTO users VALUES($1,'legacy-ambiguous','lead@example.test','Another original')", [randomUUID()]);
    await assert.rejects(planAuthRecoveryByEmail(f.admin, 'lead@example.test'));
    assert.equal((await f.request('lead', '/api/focuses')).status, 200);
  } finally { await f.close(); }
});

test('a newly conflicting verified identity makes an already reviewed recovery plan stale', async () => {
  const f = await signInFixture();
  try {
    const { planAuthRecoveryByEmail, applyAuthRecovery } = await import('./auth-recovery.js');
    await f.login('jesusfilm:first-reviewed', 'lead@example.test');
    const plan = await planAuthRecoveryByEmail(f.admin, 'lead@example.test');
    await f.login('jesusfilm:later-conflict', 'lead@example.test');
    await assert.rejects(applyAuthRecovery(f.admin, plan), /Auth recovery refused/);
    assert.equal((await f.request('lead', '/api/focuses')).status, 200);
    assert.equal((await f.admin.query('SELECT google_sub FROM users WHERE id=$1', [f.ids.lead])).rows[0].google_sub, f.ids.lead);
  } finally { await f.close(); }
});
