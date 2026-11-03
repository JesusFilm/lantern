import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coachingFixture } from './coach-test-support.js';

const root = '/api/ai-members';
test('eligible ordinary members manage private profiles with independent revisions and strict ownership', async () => {
  const f = await coachingFixture(undefined, { aiMemberManagerEmails: new Set(['member@example.test', 'peer@example.test']) });
  try {
    assert.equal((await (await f.request('member', '/api/session')).json()).canManageAiMembers, true);
    assert.equal((await (await f.request('lead', '/api/session')).json()).canManageAiMembers, false);
    assert.equal((await f.request('lead', root)).status, 403);
    assert.equal((await f.request('member', root, 'POST', { name: 'Helper', ownerUserId: f.ids.peer })).status, 400);
    const response = await f.request('member', root, 'POST', { name: 'Helper', purpose: 'Review synthetic changes' });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.profileRevision, 1);
    assert.equal(created.lastRetrievedAt, null);
    assert.deepEqual((await (await f.request('member', root)).json()).map((m: any) => m.id), [created.id]);
    assert.deepEqual(await (await f.request('peer', root)).json(), []);
    assert.equal((await f.request('peer', root + '/' + created.id)).status, 404);
    assert.equal((await f.request('peer', root + '/' + created.id, 'PATCH', { name: 'Stolen', purpose: '', profileRevision: 1 })).status, 404);
    const path = root + '/' + created.id;
    assert.equal((await f.request('member', path, 'PATCH', { name: '', purpose: '', profileRevision: 1 })).status, 400);
    const edited = await (await f.request('member', path, 'PATCH', { name: 'Reviewer', purpose: '', profileRevision: 1 })).json();
    assert.equal(edited.name, 'Reviewer');
    assert.equal(edited.profileRevision, 2);
    assert.equal((await f.request('member', path, 'PATCH', { name: 'Old', purpose: '', profileRevision: 1 })).status, 409);
    assert.equal((await f.request('peer', path, 'DELETE')).status, 404);
    assert.equal((await f.request('member', path, 'DELETE')).status, 204);
    assert.equal((await f.request('member', path)).status, 404);
  } finally { await f.close(); }
});

test('focus saves replace ordered content only when changed, reject stale versions, and cascade with member deletion', async () => {
  const f = await coachingFixture(undefined, { aiMemberManagerEmails: new Set(['member@example.test', 'peer@example.test']) });
  try {
    const member = await (await f.request('member', root, 'POST', { name: 'Planner' })).json();
    const path = root + '/' + member.id;
    assert.equal((await (await f.request('member', path)).json()).focus, null);
    const content = { objective: 'Improve synthetic release reliability', goals: ['By December, review three failures.', 'Publish two runbooks.'] };
    assert.equal((await f.request('member', path + '/focus', 'PUT', { ...content, goals: [], version: 0 })).status, 400);
    assert.equal((await f.request('peer', path + '/focus', 'PUT', { ...content, version: 0 })).status, 404);
    const first = await f.request('member', path + '/focus', 'PUT', { ...content, version: 0 });
    assert.equal(first.status, 200);
    const saved = await first.json();
    assert.equal(saved.focus.version, 1);
    assert.deepEqual(saved.focus.goals, content.goals);
    assert.equal(saved.profileRevision, 1);
    const unchanged = await (await f.request('member', path + '/focus', 'PUT', { ...content, version: 1 })).json();
    assert.deepEqual(unchanged.focus, saved.focus);
    assert.equal((await f.request('member', path + '/focus', 'PUT', { ...content, version: 0 })).status, 409);
    const next = await (await f.request('member', path + '/focus', 'PUT', { ...content, goals: [...content.goals].reverse(), version: 1 })).json();
    assert.equal(next.focus.version, 2);
    assert.equal((await f.request('member', path + '/focus', 'PUT', { ...content, version: 1 })).status, 409);
    assert.deepEqual((await (await f.request('member', path)).json()).focus, next.focus);
    assert.equal((await f.request('member', path, 'DELETE')).status, 204);
    assert.equal((await f.request('member', path + '/focus', 'PUT', { ...content, version: 2 })).status, 404);
    assert.equal((await f.migration.query('SELECT count(*) FROM ai_member_focuses')).rows[0].count, '0');
  } finally { await f.close(); }
});

export async function bearer(origin: string, token: string, method = 'GET', query = '') {
  return fetch(origin + '/api/ai-member/position-focus' + query, { method, headers: { Authorization: 'Bearer ' + token } }).then(r => r as Omit<Response, 'json'> & { json(): Promise<any> });
}
test('named hash-only tokens retrieve only their member and rotate/revoke permanently while telemetry preserves served versions', async () => {
  const f = await coachingFixture(undefined, { aiMemberManagerEmails: new Set(['member@example.test', 'peer@example.test']) });
  try {
    const member = await (await f.request('member', root, 'POST', { name: 'Reviewer' })).json();
    const other = await (await f.request('member', root, 'POST', { name: 'Writer' })).json();
    const path = root + '/' + member.id;
    const issued = await f.request('member', path + '/tokens', 'POST', { name: 'Morning reader' });
    assert.equal(issued.status, 201);
    const { token, secret } = await issued.json();
    assert.match(secret, /^lam_[A-Za-z0-9_-]{43}$/);
    assert.equal(token.suffix, secret.slice(-6));
    const second = await (await f.request('member', path + '/tokens', 'POST', { name: 'Backup reader' })).json();
    const before = await bearer(f.origin, secret);
    assert.equal(before.status, 404);
    assert.equal((await before.json()).code, 'focus_not_configured');
    assert.equal((await (await f.request('member', path)).json()).lastRetrievedAt, null);
    assert.equal((await f.request('peer', path + '/tokens', 'POST', { name: 'Steal' })).status, 404);
    for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await bearer(f.origin, secret, method)).status, 405);
    assert.equal((await bearer(f.origin, 'invalid')).status, 401);
    assert.equal((await fetch(f.origin + root, { headers: { Authorization: 'Bearer ' + secret } })).status, 401);
    const content = { objective: 'Catch failures', goals: ['Review three synthetic failures by December.'], version: 0 };
    await f.request('member', path + '/focus', 'PUT', content);
    const response = await bearer(f.origin, secret);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const document = await response.json();
    assert.deepEqual(Object.keys(document).sort(), ['focus', 'member']);
    assert.deepEqual(document.member, { id: member.id, name: 'Reviewer' });
    assert.deepEqual(Object.keys(document.focus).sort(), ['goals', 'objective', 'updatedAt', 'version']);
    assert.equal(document.focus.version, 1);
    assert.equal((await bearer(f.origin, secret, 'GET', '?member=' + other.id)).status, 400);
    const updated = await (await f.request('member', path + '/focus', 'PUT', { ...content, objective: 'Catch more failures', version: 1 })).json();
    assert.equal(updated.lastRetrievedVersion, 1);
    assert.ok(updated.lastRetrievedAt);
    assert.equal(updated.profileRevision, 1);
    assert.equal(updated.focus.version, 2);
    assert.equal(JSON.stringify(updated).includes(secret), false);
    assert.equal(updated.tokens.length, 2);
    // SQL credential boundary: no recoverable value anywhere in the token row.
    const stored = await f.migration.query('SELECT * FROM ai_member_tokens WHERE id=$1', [token.id]);
    assert.equal(stored.rows[0].verifier_hash.length, 64);
    assert.equal(JSON.stringify(stored.rows).includes(secret), false);
    assert.equal((await f.request('member', path + '/tokens/' + token.id + '/rotate', 'POST', { credentialRevision: 99 })).status, 409);
    const rotated = await (await f.request('member', path + '/tokens/' + token.id + '/rotate', 'POST', { credentialRevision: 1 })).json();
    assert.notEqual(rotated.secret, secret);
    assert.equal(rotated.token.credentialRevision, 2);
    assert.equal((await bearer(f.origin, secret)).status, 401);
    assert.equal((await bearer(f.origin, rotated.secret)).status, 200);
    assert.equal((await f.request('member', path + '/tokens/' + second.token.id, 'DELETE', { credentialRevision: 1 })).status, 204);
    assert.equal((await bearer(f.origin, second.secret)).status, 401);
    assert.equal((await f.request('member', path + '/tokens/' + second.token.id + '/rotate', 'POST', { credentialRevision: 1 })).status, 404);
    assert.equal((await (await f.request('member', path)).json()).lastRetrievedVersion, 2);
    await f.request('member', path, 'DELETE');
    assert.equal((await bearer(f.origin, rotated.secret)).status, 401);
    assert.equal((await f.migration.query('SELECT count(*) FROM ai_member_tokens')).rows[0].count, '0');
  } finally { await f.close(); }
});

test('current owner admission, membership and deployed allowlist suspend consumers reversibly; browser sign-out does not', async () => {
  const emails = new Set(['member@example.test']);
  const f = await coachingFixture(undefined, { aiMemberManagerEmails: emails });
  try {
    const m = await (await f.request('member', root, 'POST', { name: 'Helper' })).json();
    const path = root + '/' + m.id;
    await f.request('member', path + '/focus', 'PUT', { objective: 'Help', goals: ['Do three tasks by December.'], version: 0 });
    const a = await (await f.request('member', path + '/tokens', 'POST', { name: 'Reader' })).json();
    const b = await (await f.request('member', path + '/tokens', 'POST', { name: 'Deleted reader' })).json();
    await f.request('member', path + '/tokens/' + b.token.id, 'DELETE', { credentialRevision: 1 });
    assert.equal((await bearer(f.origin, a.secret)).status, 200);
    emails.clear();
    assert.equal((await bearer(f.origin, a.secret)).status, 401);
    assert.equal((await f.request('member', path)).status, 403);
    emails.add('member@example.test');
    assert.equal((await bearer(f.origin, a.secret)).status, 200);
    assert.equal((await bearer(f.origin, b.secret)).status, 401);
    await f.admin.query("DELETE FROM approved_emails WHERE email='member@example.test'");
    assert.equal((await bearer(f.origin, a.secret)).status, 401);
    await f.admin.query("INSERT INTO approved_emails VALUES('member@example.test')");
    await f.admin.query('UPDATE memberships SET deleted_at=now() WHERE user_id=$1', [f.ids.member]);
    assert.equal((await bearer(f.origin, a.secret)).status, 401);
    await f.admin.query('UPDATE memberships SET deleted_at=NULL WHERE user_id=$1', [f.ids.member]);
    await f.request('member', '/api/sign-out', 'POST', {});
    assert.equal((await bearer(f.origin, a.secret)).status, 200);
    assert.equal((await f.request('member', path)).status, 401);
  } finally { await f.close(); }
});

test('environment allowlist normalizes exact emails, disables when absent and rejects unsafe configuration without echoing it', async () => {
  const { resolveRuntime } = await import('./runtime.js');
  const env = { LANTERN_ENV: 'local', DATABASE_URL: process.env.DATABASE_URL };
  assert.deepEqual([...resolveRuntime(env).aiMemberManagerEmails], []);
  assert.deepEqual([...resolveRuntime({ ...env, AI_MEMBER_MANAGER_EMAILS: ' MEMBER@example.test,\npeer@example.test\n' }).aiMemberManagerEmails], ['member@example.test', 'peer@example.test']);
  for (const value of ['*@example.test', 'bad', 'member@example.test, secret-invalid-address', 'a@@example.test', 'a..b@example.test', 'a<b>@example.test', 'a'.repeat(65) + '@example.test']) {
    assert.throws(() => resolveRuntime({ ...env, AI_MEMBER_MANAGER_EMAILS: value }), (error: Error) => !error.message.includes(value) && error.message.includes('AI_MEMBER_MANAGER_EMAILS'));
  }
});

test('concurrent retrieval/save/rotation/delete serialize without stale overwrites, false telemetry or credential resurrection', async () => {
  const f = await coachingFixture(undefined, { aiMemberManagerEmails: new Set(['member@example.test']) });
  try {
    const member = await (await f.request('member', root, 'POST', { name: 'Concurrent helper' })).json();
    const path = root + '/' + member.id;
    const content = { objective: 'Version one', goals: ['Complete three synthetic tasks.'], version: 0 };
    await f.request('member', path + '/focus', 'PUT', content);
    const token = await (await f.request('member', path + '/tokens', 'POST', { name: 'Reader' })).json();
    const [retrieved, saved] = await Promise.all([
      bearer(f.origin, token.secret),
      f.request('member', path + '/focus', 'PUT', { ...content, objective: 'Version two', version: 1 }),
    ]);
    assert.equal(retrieved.status, 200); assert.equal(saved.status, 200);
    const served = await retrieved.json();
    assert.equal(served.focus.objective, served.focus.version === 1 ? 'Version one' : 'Version two');
    const latest = await (await f.request('member', path)).json();
    assert.equal(latest.lastRetrievedVersion, served.focus.version);
    assert.equal(latest.focus.version, 2);
    const writes = await Promise.all(['A', 'B'].map(objective => f.request('member', path + '/focus', 'PUT', { ...content, objective, version: 2 })));
    assert.deepEqual(writes.map(r => r.status).sort(), [200, 409]);
    const [readDuringRotation, rotated] = await Promise.all([bearer(f.origin, token.secret), f.request('member', path + '/tokens/' + token.token.id + '/rotate', 'POST', { credentialRevision: 1 })]);
    assert.ok([200, 401].includes(readDuringRotation.status));
    assert.equal(rotated.status, 200);
    const replacement = await rotated.json();
    assert.equal((await bearer(f.origin, token.secret)).status, 401);
    const [readDuringDeletion, deletion, rotation, save] = await Promise.all([
      bearer(f.origin, replacement.secret), f.request('member', path, 'DELETE'),
      f.request('member', path + '/tokens/' + token.token.id + '/rotate', 'POST', { credentialRevision: 2 }),
      f.request('member', path + '/focus', 'PUT', { ...content, version: 3 }),
    ]);
    assert.equal(deletion.status, 204);
    assert.ok([200, 401].includes(readDuringDeletion.status));
    assert.ok([200, 404].includes(rotation.status));
    assert.ok([200, 404].includes(save.status));
    assert.equal((await bearer(f.origin, replacement.secret)).status, 401);
    if (rotation.status === 200) assert.equal((await bearer(f.origin, (await rotation.json()).secret)).status, 401);
    for (const table of ['ai_members', 'ai_member_focuses', 'ai_member_tokens']) assert.equal((await f.migration.query('SELECT count(*) FROM ' + table)).rows[0].count, '0');
  } finally { await f.close(); }
});

test('consumer reports storage failure without recording retrieval and bounds per-instance requests', async () => {
  const f = await coachingFixture(undefined, { aiMemberManagerEmails: new Set(['member@example.test']) });
  try {
    const member = await (await f.request('member', root, 'POST', { name: 'Helper' })).json();
    const path = root + '/' + member.id;
    await f.request('member', path + '/focus', 'PUT', { objective: 'Help', goals: ['Three tasks'], version: 0 });
    const token = await (await f.request('member', path + '/tokens', 'POST', { name: 'Reader' })).json();
    await f.migration.query(`CREATE FUNCTION fail_telemetry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private storage diagnostic'; END $$;
      CREATE TRIGGER fail_telemetry BEFORE UPDATE ON ai_members FOR EACH ROW EXECUTE FUNCTION fail_telemetry()`);
    const failed = await bearer(f.origin, token.secret);
    assert.equal(failed.status, 503);
    assert.equal((await failed.text()).includes('private storage'), false);
    assert.equal((await (await f.request('member', path)).json()).lastRetrievedAt, null);
    await f.migration.query('DROP TRIGGER fail_telemetry ON ai_members');
    assert.equal((await bearer(f.origin, token.secret)).status, 200);
    for (let i = 0; i < 118; i++) assert.equal((await bearer(f.origin, 'invalid')).status, 401);
    const limited = await bearer(f.origin, token.secret);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('cache-control'), 'no-store');
  } finally { await f.close(); }
});

test('owner writes enforce text bounds and browser origin protection; failed storage writes leave the previous focus intact', async () => {
  const f = await coachingFixture(undefined, { aiMemberManagerEmails: new Set(['member@example.test']) });
  try {
    for (const invalid of [{ name: ' ' }, { name: 'x'.repeat(101) }, { name: 'Helper', purpose: 'x'.repeat(4001) }]) assert.equal((await f.request('member', root, 'POST', invalid)).status, 400);
    const member = await (await f.request('member', root, 'POST', { name: 'Helper' })).json();
    const path = root + '/' + member.id;
    const content = { objective: 'Saved outcome', goals: ['Saved goal'], version: 0 };
    for (const invalid of [{ ...content, objective: ' ' }, { ...content, objective: 'x'.repeat(10001) }, { ...content, goals: ['\n\t'] }, { ...content, goals: Array(101).fill('Goal') }, { ...content, goals: ['x'.repeat(10001)] }]) assert.equal((await f.request('member', path + '/focus', 'PUT', invalid)).status, 400);
    const csrf = await fetch(f.origin + path + '/focus', { method: 'PUT', headers: { Cookie: 'lantern-session=member', Origin: 'https://foreign.example.test', 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
    assert.equal(csrf.status, 403);
    const saved = await (await f.request('member', path + '/focus', 'PUT', content)).json();
    await f.migration.query(`CREATE FUNCTION reject_focus_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private diagnostic'; END $$;
      CREATE TRIGGER reject_focus_write BEFORE UPDATE ON ai_member_focuses FOR EACH ROW EXECUTE FUNCTION reject_focus_write()`);
    const failed = await f.request('member', path + '/focus', 'PUT', { ...content, objective: 'Failed edit', version: 1 });
    assert.equal(failed.status, 503);
    assert.equal((await failed.text()).includes('private diagnostic'), false);
    assert.deepEqual((await (await f.request('member', path)).json()).focus, saved.focus);
  } finally { await f.close(); }
});
