import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { coachingFixture, draft } from './coach-test-support.js';
import { createApp } from './app.js';
import { hash } from './access.js';
import type { RegisteredUser, SessionView } from '../shared/access.js';

async function recoveryFixture() {
  const f = await coachingFixture();
  const directory = await mkdtemp(join(tmpdir(), 'lantern-auth-recovery-'));
  const duplicate = randomUUID();
  await f.admin.query("INSERT INTO users VALUES($1,'jesusfilm:verified-lead','lead@example.test','New profile')", [duplicate]);
  await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')", [hash('duplicate'), duplicate]);
  const mapping = { accountId: f.ids.lead, expectedSubject: f.ids.lead, authSubject: 'verified-lead', email: 'lead@example.test', duplicateAccountId: duplicate };
  const input = join(directory, 'mapping.json'), plan = join(directory, 'plan.json');
  await writeFile(input, JSON.stringify(mapping), { mode: 0o600 });
  const command = (...args: string[]) => promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/operations.ts', ...args], { env: {
    ...process.env, LANTERN_ENV: 'local', ADMIN_DATABASE_URL: f.admin.options.connectionString,
    LANTERN_DB_NAME: f.databaseName, LANTERN_DB_SCHEMA: 'lantern', LANTERN_DB_RUNTIME_ROLE: f.roles.runtime,
    LANTERN_DB_MIGRATION_ROLE: f.roles.migration, LANTERN_DB_ADMIN_ROLE: f.roles.admin,
  } });
  return { ...f, duplicate, mapping, input, plan, directory, command, async close() { await f.close(); await rm(directory, { recursive: true, force: true }); } };
}

test('planned administrative recovery preserves the original account and focus, removes only the empty duplicate, and revokes both sessions', async () => {
  const f = await recoveryFixture();
  const server = createServer();
  try {
    const response = await f.request('lead', '/api/focuses', 'POST', draft);
    assert.equal(response.status, 201);
    const focus = await response.json();
    const before = (await f.admin.query('SELECT * FROM position_focuses WHERE id=$1', [focus.id])).rows;
    const preview = await f.command('plan-auth-recovery', f.input, f.plan);
    assert.doesNotMatch(preview.stdout, /lead@example|verified-lead|duplicate/);
    assert.equal((await stat(f.plan)).mode & 0o777, 0o600);
    assert.equal((await f.request('lead', '/api/focuses')).status, 200, 'planning does not revoke access');
    assert.equal((await f.admin.query('SELECT id FROM users WHERE id=$1', [f.duplicate])).rowCount, 1);
    assert.doesNotMatch(await readFile(f.plan, 'utf8'), new RegExp(hash('duplicate')));
    await f.command('apply-auth-recovery', f.plan);
    await f.command('apply-auth-recovery', f.plan);
    assert.equal((await f.request('lead', '/api/focuses')).status, 401);
    assert.equal((await f.request('duplicate', '/api/focuses')).status, 401);
    assert.deepEqual((await f.admin.query('SELECT * FROM position_focuses WHERE id=$1', [focus.id])).rows, before);
    assert.equal((await f.admin.query('SELECT id FROM users WHERE id=$1', [f.duplicate])).rowCount, 0);

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    server.on('request', createApp(f.runtime, { origin, provider: {
      authorizationUrl: state => `/auth/jesusfilm/callback?state=${state}&code=test`,
      exchange: async () => ({ sub: 'jesusfilm:verified-lead', email: 'lead@example.test', name: 'From JFP' }),
    } }));
    const start = await fetch(origin + '/auth/jesusfilm', { redirect: 'manual' });
    const callback = await fetch(origin + start.headers.get('location'), { redirect: 'manual', headers: { Cookie: start.headers.getSetCookie()[0]!.split(';')[0]! } });
    const cookie = callback.headers.getSetCookie().find(value => value.startsWith('lantern-session='))!.split(';')[0]!;
    const view = await (await fetch(origin + '/api/session', { headers: { Cookie: cookie } })).json() as SessionView;
    assert.equal(view.user?.id, f.ids.lead);
    assert.equal(view.user?.name, 'lead');
    assert.equal(view.department?.role, 'career-lead');
    assert.equal((await fetch(`${origin}/api/focuses/${focus.id}`, { headers: { Cookie: cookie } })).status, 200);
    const users = await (await fetch(origin + '/api/department/registered-users', { headers: { Cookie: cookie } })).json() as RegisteredUser[];
    assert.equal(users.filter((user: { email: string }) => user.email === 'lead@example.test').length, 1);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await f.close();
  }
});

test('recovery refuses stale, conflicting and populated plans without changing accounts or sessions', async t => {
  for (const scenario of ['wrong-target', 'wrong-email', 'wrong-binding', 'third-account', 'duplicate-history', 'runtime-role', 'write-failure', 'unapproved']) {
    await t.test(scenario, async () => {
      const f = await recoveryFixture();
      try {
        await f.command('plan-auth-recovery', f.input, f.plan);
        if (scenario === 'wrong-target') {
          const plan = JSON.parse(await readFile(f.plan, 'utf8')); plan.target.database = 'different';
          await writeFile(f.plan, JSON.stringify(plan));
        }
        if (scenario === 'wrong-email') await f.admin.query("UPDATE users SET email='changed@example.test' WHERE id=$1", [f.ids.lead]);
        if (scenario === 'wrong-binding') await f.admin.query("UPDATE users SET google_sub='jesusfilm:someone-else' WHERE id=$1", [f.ids.lead]);
        if (scenario === 'third-account') await f.admin.query("INSERT INTO users VALUES($1,'jesusfilm:third','lead@example.test','Third')", [randomUUID()]);
        if (scenario === 'unapproved') await f.admin.query("DELETE FROM approved_emails WHERE email='lead@example.test'");
        if (scenario === 'duplicate-history') {
          // Future cascading references must also prevent a destructive repair.
          await f.migration.query(`CREATE TABLE additional_history(user_id uuid REFERENCES users(id) ON DELETE CASCADE);
            GRANT SELECT,INSERT ON additional_history TO ${f.roles.admin}`);
          await f.admin.query('INSERT INTO additional_history VALUES($1)', [f.duplicate]);
        }
        if (scenario === 'write-failure') await f.migration.query(`CREATE FUNCTION refuse_binding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Private synthetic failure'; END $$;
          CREATE TRIGGER refuse_binding BEFORE UPDATE OF google_sub ON users FOR EACH ROW EXECUTE FUNCTION refuse_binding()`);
        const before = (await f.admin.query('SELECT * FROM users ORDER BY id')).rows;
        const sessions = (await f.admin.query('SELECT * FROM sessions ORDER BY token_hash')).rows;
        if (scenario === 'runtime-role') {
          const { applyAuthRecovery } = await import('./auth-recovery.js');
          await assert.rejects(applyAuthRecovery(f.runtime, JSON.parse(await readFile(f.plan, 'utf8'))), /Auth recovery refused/);
        } else await assert.rejects(f.command('apply-auth-recovery', f.plan), error => {
          assert.match(String(error), /Auth recovery refused/);
          assert.doesNotMatch(String(error), /Private synthetic failure|lead@example/);
          return true;
        });
        assert.deepEqual((await f.admin.query('SELECT * FROM users ORDER BY id')).rows, before);
        assert.deepEqual((await f.admin.query('SELECT * FROM sessions ORDER BY token_hash')).rows, sessions);
      } finally { await f.close(); }
    });
  }
});

test('recovery retains former membership and supports a verified account with no duplicate', async () => {
  const f = await recoveryFixture();
  try {
    await f.admin.query('UPDATE memberships SET deleted_at=now() WHERE user_id=$1', [f.ids.lead]);
    const before = (await f.admin.query('SELECT * FROM memberships WHERE user_id=$1', [f.ids.lead])).rows;
    await f.admin.query('DELETE FROM sessions WHERE user_id=$1', [f.duplicate]);
    await f.admin.query('DELETE FROM users WHERE id=$1', [f.duplicate]);
    const { duplicateAccountId: _, ...mapping } = f.mapping;
    await writeFile(f.input, JSON.stringify(mapping));
    await f.command('plan-auth-recovery', f.input, f.plan);
    await f.command('apply-auth-recovery', f.plan);
    assert.deepEqual((await f.admin.query('SELECT * FROM memberships WHERE user_id=$1', [f.ids.lead])).rows, before);
    assert.equal((await f.admin.query('SELECT google_sub FROM users WHERE id=$1', [f.ids.lead])).rows[0].google_sub, 'jesusfilm:verified-lead');
  } finally { await f.close(); }
});

test('session cutover is private, target-bound, refuses stale plans and requires fresh sign-in', async () => {
  const f = await recoveryFixture();
  try {
    await f.command('plan-auth-session-cutover', f.plan);
    const plan = JSON.parse(await readFile(f.plan, 'utf8'));
    assert.equal(plan.count, 5);
    assert.doesNotMatch(await readFile(f.plan, 'utf8'), /token_hash|duplicate|lead@example/);
    await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')", [hash('new-session'), f.ids.peer]);
    await assert.rejects(f.command('apply-auth-session-cutover', f.plan), /Auth recovery refused/);
    assert.equal((await f.request('lead', '/api/focuses')).status, 200);
    await rm(f.plan);
    await f.command('plan-auth-session-cutover', f.plan);
    await f.command('apply-auth-session-cutover', f.plan);
    await f.command('apply-auth-session-cutover', f.plan);
    assert.equal((await f.request('lead', '/api/focuses')).status, 401);
    assert.equal((await f.request('duplicate', '/api/focuses')).status, 401);
    assert.equal((await f.admin.query('SELECT id FROM users')).rowCount, 5);
    assert.equal((await f.admin.query('SELECT user_id FROM memberships')).rowCount, 4);
    await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')", [hash('fresh-after-cutover'), f.ids.peer]);
    await assert.rejects(f.command('apply-auth-session-cutover', f.plan), /Auth recovery refused/);
    assert.equal((await f.request('fresh-after-cutover', '/api/focuses')).status, 200);
  } finally { await f.close(); }
});

test('an administrator can plan recovery by email using the JFP identity already registered in Lantern', async () => {
  const f = await recoveryFixture();
  try {
    await f.command('plan-auth-recovery-by-email', ' LEAD@EXAMPLE.TEST ', f.plan);
    const plan = JSON.parse(await readFile(f.plan, 'utf8'));
    assert.equal(plan.mapping.accountId, f.ids.lead);
    assert.equal(plan.mapping.duplicateAccountId, f.duplicate);
    assert.equal(plan.mapping.authSubject, 'verified-lead');
    assert.equal(plan.summary.department, 'Engineering');
    assert.equal(plan.summary.role, 'career-lead');
    await f.command('apply-auth-recovery', f.plan);
    assert.equal((await f.admin.query('SELECT google_sub FROM users WHERE id=$1', [f.ids.lead])).rows[0].google_sub, 'jesusfilm:verified-lead');
  } finally { await f.close(); }
});
