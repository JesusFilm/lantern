import { lanternEnvironment } from './runtime.js';
import { privilegeFixture } from './privilege-test-support.js';
import type { SessionView } from '../shared/access.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import type { Identity } from './google.js';
import { setupDepartment, removeMember } from './membership.js';
import { migrate } from './schema.js';
import { approveEmail, revokeEmail, approvedEmails } from './admission.js';

async function fixture(work: (db: pg.Pool) => Promise<void>) {
  const schema = `admission_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  try { await migrate(db); await work(db); }
  finally { await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
}

test('operator approvals are exact, normalized, persistent, unique and removable', async () => {
  await fixture(async db => {
    assert.deepEqual(await approvedEmails(db), []);
    await approveEmail(db, ' Person@Example.Test ');
    await approveEmail(db, 'person@example.test');
    await approveEmail(db, "o'connor@example.test");
    await migrate(db);
    assert.deepEqual(await approvedEmails(db), ["o'connor@example.test", 'person@example.test']);
    await assert.rejects(approveEmail(db, '*@example.test'));
    await assert.rejects(approveEmail(db, 'not an email'));
    await revokeEmail(db, ' PERSON@EXAMPLE.TEST ');
    await revokeEmail(db, 'person@example.test');
    assert.deepEqual(await approvedEmails(db), ["o'connor@example.test"]);
  });
});

async function httpFixture(db: pg.Pool, work: (request: (path: string, cookie?: string, body?: unknown) => Promise<Response>, login: (identity: Identity, extra?: string) => Promise<{ response: Response; cookie: string }>) => Promise<void>, environment?: string) {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  lanternEnvironment(environment);
  let identity: Identity;
  server.on('request', createApp(db, { origin, provider: {
    authorizationUrl: state => `/auth/google/callback?state=${state}&code=test`,
    exchange: async () => { if (identity.sub === 'provider-failure') throw new Error('secret provider detail'); return identity; },
  } }));
  const request = (path: string, cookie = '', body?: unknown) => fetch(origin + path, {
    redirect: 'manual', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  try {
    await work(request, async (next, extra = '') => {
      identity = next;
      const start = await request('/auth/google');
      const response = await request(start.headers.get('location')! + extra, start.headers.get('set-cookie')!.split(';')[0]);
      const cookie = response.headers.get('set-cookie')?.match(/lantern-session=[^;]+/)?.[0] ?? '';
      return { response, cookie };
    });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
const workIdentity = { sub: 'work-sub', email: 'person@example.test', name: 'Person', hostedDomain: 'example.test' };
test('Google callback requires exact email approval before registration and rechecks active sessions', async () => {
  await fixture(async db => {
    await db.query("INSERT INTO allowed_domains VALUES('example.test')");
    await httpFixture(db, async (request, login) => {
      const denied = await login(workIdentity, '&role=career-lead&owner=someone&environment=stage');
      assert.equal(denied.response.headers.get('location'), '/?signInError=1');
      assert.equal(denied.cookie, '');
      await approveEmail(db, 'other@example.test');
      assert.equal((await login(workIdentity)).cookie, '');
      await approveEmail(db, ' PERSON@EXAMPLE.TEST ');
      const allowed = await login({ ...workIdentity, email: 'Person@Example.Test' });
      assert.ok(allowed.cookie);
      const session = await (await request('/api/session', allowed.cookie)).json() as SessionView;
      assert.equal(session.user!.email, 'person@example.test');
      assert.equal(session.department, undefined);
      assert.equal((await request('/api/guide', allowed.cookie)).status, 403);
      await revokeEmail(db, workIdentity.email);
      assert.equal((await (await request('/api/session', allowed.cookie)).json() as SessionView).user, null);
      assert.equal((await request('/api/guide', allowed.cookie)).status, 401);
      await approveEmail(db, workIdentity.email);
      assert.equal((await (await request('/api/session', (await login(workIdentity)).cookie)).json() as SessionView).user!.id, session.user!.id);
    });
  });
});

test('environment configuration defaults restrictively and rejects invalid identities', () => {
  assert.equal(lanternEnvironment(undefined), 'production');
  for (const value of ['', 'test', 'Production', ' stage ']) assert.throws(() => lanternEnvironment(value));
});
for (const environment of ['local', 'stage', 'production', undefined]) {
  test(`${environment ?? 'omitted'} admits exact approved emails regardless of hosted domain`, async () => {
    await fixture(async db => {
      await approveEmail(db, 'personal@gmail.com');
      await approveEmail(db, workIdentity.email);
      await httpFixture(db, async (request, login) => {
        for (const identity of [
          { sub: 'personal', email: 'personal@gmail.com', name: 'Personal', hostedDomain: null },
          workIdentity,
          { ...workIdentity, hostedDomain: 'unlisted.test' },
        ]) {
          const result = await login(identity, '&environment=stage&LANTERN_ENV=stage');
          assert.ok(result.cookie);
          assert.equal((await (await request('/api/session', result.cookie)).json() as SessionView).user!.email, identity.email);
          assert.equal((await request('/api/guide', result.cookie)).status, 403);
        }
        assert.equal((await login({ ...workIdentity, email: 'unapproved@example.test' })).cookie, '');
      }, environment);
    });
  });
}

test('stage lead assigns approved personal members; revoked eligibility and forged authority are denied', async () => {
  await fixture(async db => {
    await db.query("INSERT INTO allowed_domains VALUES('example.test')");
    await approveEmail(db, workIdentity.email);
    await approveEmail(db, 'member@gmail.com');
    await httpFixture(db, async (request, login) => {
      const lead = await login(workIdentity);
      await revokeEmail(db, workIdentity.email);
      await assert.rejects(setupDepartment(db, 'Team', workIdentity.email));
      await approveEmail(db, workIdentity.email);
      await setupDepartment(db, 'Team', workIdentity.email);
      const personal = { sub: 'member', email: 'member@gmail.com', name: 'Member', hostedDomain: null };
      const member = await login(personal);
      const userId = (await (await request('/api/session', member.cookie)).json() as SessionView).user!.id;
      for (const field of ['role', 'owner', 'departmentId', 'environment', 'admissionPolicy', 'LANTERN_ENV']) {
        assert.equal((await request('/api/department/members', lead.cookie, { userId, [field]: 'stage' })).status, 400);
      }
      await revokeEmail(db, personal.email);
      assert.equal((await request('/api/department/members', lead.cookie, { userId })).status, 403);
      await approveEmail(db, personal.email);
      assert.equal((await request('/api/department/members', lead.cookie, { userId })).status, 204);
      assert.equal((await (await request('/api/session', member.cookie)).json() as SessionView).department!.role, 'member');
      const focus = await request('/api/focuses', member.cookie, { title: 'Retained draft', start: '2026-01-01', end: '2026-12-31', sections: [] });
      assert.equal(focus.status, 201);
      const id = (await focus.json() as { id: string }).id;
      await migrate(db); // Repeat migration with accounts, sessions, membership and a retained document.
      await revokeEmail(db, personal.email);
      assert.equal((await request(`/api/focuses/${id}`, member.cookie)).status, 401);
      await approveEmail(db, personal.email);
      assert.equal((await request(`/api/focuses/${id}`, (await login(personal)).cookie)).status, 200);
      await removeMember(db, userId);
      await revokeEmail(db, personal.email); await approveEmail(db, personal.email);
      assert.equal((await request('/api/department/members', lead.cookie, { userId })).status, 409);
      assert.equal((await request(`/api/focuses/${id}`, (await login(personal)).cookie)).status, 403);
    }, 'stage');
  });
});

test('operator command adds, lists and removes approvals without interpolating email SQL', async () => {
  const fixture = await privilegeFixture();
  try {
    await migrate(fixture.migration, fixture.roles);
    const run = (...args: string[]) => promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/operations.ts', ...args], {
      env: { ...process.env, ADMIN_DATABASE_URL:fixture.admin.options.connectionString!,
        LANTERN_DB_NAME:fixture.databaseName, LANTERN_DB_SCHEMA:'lantern',
        LANTERN_DB_RUNTIME_ROLE:fixture.roles.runtime, LANTERN_DB_MIGRATION_ROLE:fixture.roles.migration, LANTERN_DB_ADMIN_ROLE:fixture.roles.admin },
    });
    await run('approve-email', "o'connor@example.test");
    assert.match((await run('list-approved-emails')).stdout, /o'connor@example.test/);
    await run('remove-approved-email', "o'connor@example.test");
    assert.doesNotMatch((await run('list-approved-emails')).stdout, /o'connor/);
    await assert.rejects(run('approve-email', '*@example.test'));
  } finally { await fixture.close(); }
});

test('provider and database failures fail closed with safe feedback; failed session creation is atomic', async () => {
  await fixture(async db => {
    await approveEmail(db, workIdentity.email);
    await db.query("INSERT INTO allowed_domains VALUES('example.test')");
    await httpFixture(db, async (request, login) => {
      const failedProvider = await login({ ...workIdentity, sub: 'provider-failure' });
      assert.equal(failedProvider.response.headers.get('location'), '/?signInError=1');
      assert.equal(failedProvider.cookie, '');
      await db.query(`CREATE FUNCTION reject_session() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'secret database detail'; END $$;
        CREATE TRIGGER reject_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session()`);
      const failedWrite = await login(workIdentity);
      assert.equal(failedWrite.response.status, 503);
      assert.equal(failedWrite.cookie, '');
      assert.doesNotMatch(await failedWrite.response.text(), /secret/);
      await db.query('DROP TRIGGER reject_session ON sessions');
      // Public setup cannot find a partially registered account after the failed login.
      await assert.rejects(setupDepartment(db, 'Team', workIdentity.email));
      const valid = await login(workIdentity);
      await db.query('ALTER TABLE approved_emails RENAME TO unavailable_approvals');
      assert.equal((await request('/api/guide', valid.cookie)).status, 503);
      assert.equal((await login(workIdentity)).response.status, 503);
      await db.query('ALTER TABLE unavailable_approvals RENAME TO approved_emails');
      assert.ok((await (await request('/api/session', valid.cookie)).json() as SessionView).user);
    });
  });
});

test('production permits approved personal leads and members and rechecks revoked email eligibility', async () => {
  await fixture(async db => {
    const personal = { sub: 'lead-personal', email: 'lead@gmail.com', name: 'Lead', hostedDomain: null };
    await approveEmail(db, personal.email); await approveEmail(db, workIdentity.email);
    await httpFixture(db, async (request, login) => {
      const lead = await login(personal);
      await setupDepartment(db, 'Team', personal.email);
      const member = await login(workIdentity);
      const userId = (await (await request('/api/session', member.cookie)).json() as SessionView).user!.id;
      await revokeEmail(db, workIdentity.email);
      assert.equal((await request('/api/department/members', lead.cookie, { userId })).status, 403);
      await approveEmail(db, workIdentity.email);
      assert.equal((await request('/api/department/members', lead.cookie, { userId })).status, 204);
      assert.equal((await request('/api/guide', member.cookie)).status, 200);
      await revokeEmail(db, workIdentity.email);
      assert.equal((await request('/api/guide', member.cookie)).status, 401);
    }, 'production');
  });
});

test('runtime remains usable after legacy domain storage and overload are removed', async () => {
  const f = await privilegeFixture();
  try {
    await migrate(f.migration, f.roles);
    await approveEmail(f.admin, 'person@example.test');
    // Rehearse the next release's destructive DDL against this compatibility app.
    await f.migration.query('DROP FUNCTION enroll_member(uuid,text,boolean); ALTER TABLE users DROP COLUMN hosted_domain; DROP TABLE allowed_domains');
    const { assertRuntimePrivileges } = await import('./database-privileges.js');
    const { assertSchemaReady } = await import('./schema.js');
    const { verifyDatabase } = await import('./database-verification.js');
    await assertRuntimePrivileges(f.runtime);
    await assertSchemaReady(f.runtime);
    await verifyDatabase(f.runtime, {...f.roles, expectedDatabase:f.databaseName, schema:'lantern'}, 'runtime');
    await httpFixture(f.runtime, async (request, login) => {
      const signedIn = await login(workIdentity);
      assert.ok(signedIn.cookie);
      await setupDepartment(f.admin, 'Synthetic team', workIdentity.email);
      assert.equal((await request('/api/guide', signedIn.cookie)).status, 200);
    }, 'production');
  } finally { await f.close(); }
});
