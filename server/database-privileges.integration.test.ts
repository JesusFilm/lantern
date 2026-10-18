import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, assertSchemaReady } from './schema.js';
import { grantApplicationPrivileges } from './database-privileges.js';
import { approveEmail, approvedEmails } from './admission.js';

import { privilegeFixture } from './privilege-test-support.js';

test('separate database roles migrate and administer while runtime is denied DDL and administrative writes', async () => {
  const fixture = await privilegeFixture();
  const { migration, runtime, admin, roles } = fixture;
  try {
    await migrate(migration);
    await grantApplicationPrivileges(migration, roles);
    await assertSchemaReady(runtime);
    await approveEmail(admin, 'synthetic@example.test');
    assert.deepEqual(await approvedEmails(runtime), ['synthetic@example.test']);
    for (const sql of [
      'CREATE TABLE forbidden(id integer)', 'CREATE TABLE public.forbidden(id integer)',
      'CREATE TEMP TABLE forbidden(id integer)', 'CREATE SCHEMA forbidden',
      'ALTER TABLE users ADD COLUMN forbidden text', 'DROP TABLE memberships',
      'TRUNCATE users CASCADE', "CREATE ROLE forbidden", `SET ROLE ${roles.migration}`, `SET ROLE ${roles.admin}`,
      "INSERT INTO approved_emails VALUES ('forbidden@example.test')", 'DELETE FROM allowed_domains',
      "INSERT INTO departments VALUES (gen_random_uuid(),'forbidden',NULL)",
      "INSERT INTO memberships VALUES (gen_random_uuid(),gen_random_uuid(),'career-lead',NULL)",
      "UPDATE memberships SET role='career-lead'", 'DELETE FROM memberships',
      'UPDATE schema_migrations SET version=99',
    ]) await assert.rejects(runtime.query(sql), { code: '42501' }, sql);
    await assert.rejects(migrate(runtime), { code: '42501' });
    await assert.rejects(admin.query('ALTER TABLE users ADD COLUMN forbidden text'), { code: '42501' });
    await migration.query('CREATE TABLE future_private(id integer)');
    await assert.rejects(runtime.query('SELECT * FROM future_private'), { code: '42501' });
    await migration.query('CREATE FUNCTION future_private_function() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$');
    await assert.rejects(runtime.query('SELECT future_private_function()'), { code: '42501' });
  } finally { await fixture.close(); }
});

test('runtime enrollment only adds approved ordinary members and cannot restore, transfer or promote them', async () => {
  const fixture = await privilegeFixture();
  const { migration, runtime, admin, roles } = fixture;
  try {
    await migrate(migration); await grantApplicationPrivileges(migration, roles);
    const { configureDomains, setupDepartment, addMember, membership, removeMember } = await import('./membership.js');
    const { registerSession } = await import('./accounts.js');
    await configureDomains(admin, ['example.test']);
    const ids: string[] = [];
    for (const name of ['lead', 'member', 'other']) {
      await approveEmail(admin, `${name}@example.test`);
      assert.equal(await registerSession(runtime, {sub:name,email:`${name}@example.test`,hostedDomain:'example.test',name}, name, undefined), true);
      ids.push((await admin.query('SELECT id FROM users WHERE google_sub=$1', [name])).rows[0].id);
    }
    const [lead, member, other] = ids as [string,string,string];
    await setupDepartment(admin, 'Synthetic team', 'lead@example.test');
    await assert.rejects(addMember(runtime, other, member), {status:403});
    await Promise.all([addMember(runtime, lead, member), addMember(runtime, lead, member)]);
    assert.equal((await membership(runtime, member))?.role, 'member');
    await assert.rejects(runtime.query("UPDATE memberships SET role='career-lead' WHERE user_id=$1", [member]), {code:'42501'});
    await removeMember(admin, member);
    await assert.rejects(addMember(runtime, lead, member), {status:409});
    assert.equal(await membership(runtime, member), undefined);
    await admin.query('DELETE FROM approved_emails WHERE email=$1', ['other@example.test']);
    await assert.rejects(addMember(runtime, lead, other), {status:403});
    await assert.rejects(addMember(runtime, lead, 'not-a-user'), {status:400});
  } finally { await fixture.close(); }
});

test('privileged commands reject a wrong database, schema, role or elevated login before doing work', async () => {
  const fixture = await privilegeFixture();
  try {
    const { assertDatabaseTarget } = await import('./database-privileges.js');
    const expected = { database: fixture.databaseName, schema: 'lantern', role: fixture.roles.migration };
    await assertDatabaseTarget(fixture.migration, expected);
    await assert.rejects(assertDatabaseTarget(fixture.migration, {...expected, database:'wrong'}));
    await assert.rejects(assertDatabaseTarget(fixture.migration, {...expected, schema:'public'}));
    await assert.rejects(assertDatabaseTarget(fixture.runtime, expected));
    await assert.rejects(assertDatabaseTarget(fixture.bootstrap, {...expected, role:'career_lead'}));
  } finally { await fixture.close(); }
});

test('runtime readiness refuses elevated or administrative connections', async () => {
  const fixture = await privilegeFixture();
  try {
    const { assertRuntimePrivileges } = await import('./database-privileges.js');
    await migrate(fixture.migration, fixture.roles);
    await assertRuntimePrivileges(fixture.runtime);
    await assert.rejects(assertRuntimePrivileges(fixture.admin));
    await assert.rejects(assertRuntimePrivileges(fixture.migration));
    await assert.rejects(assertRuntimePrivileges(fixture.bootstrap));
  } finally { await fixture.close(); }
});

test('reapplying the grant allowlist removes stray column grants as well as table grants', async () => {
  const fixture = await privilegeFixture();
  try {
    await migrate(fixture.migration, fixture.roles);
    await fixture.migration.query(`GRANT UPDATE (role) ON memberships TO "${fixture.roles.runtime}"`);
    await migrate(fixture.migration, fixture.roles);
    await assert.rejects(fixture.runtime.query("UPDATE memberships SET role='career-lead'"), {code:'42501'});
  } finally { await fixture.close(); }
});

test('bootstrap rejects a wrong target or existing role without modifying the existing setup', async () => {
  const fixture = await privilegeFixture();
  try {
    const { bootstrapDatabaseRoles } = await import('./database-privileges.js');
    const config = {...fixture.roles, expectedDatabase:fixture.databaseName, schema:'lantern'};
    await assert.rejects(bootstrapDatabaseRoles(fixture.bootstrap, {...config, expectedDatabase:'wrong_target'}));
    await assert.rejects(bootstrapDatabaseRoles(fixture.bootstrap, config));
    await migrate(fixture.migration, fixture.roles);
    await approveEmail(fixture.admin, 'still-working@example.test');
    assert.deepEqual(await approvedEmails(fixture.runtime), ['still-working@example.test']);
  } finally { await fixture.close(); }
});

test('migration refuses elevated target roles and rolls back schema work', async () => {
  const fixture = await privilegeFixture();
  try {
    await fixture.bootstrap.query(`ALTER ROLE "${fixture.roles.runtime}" CREATEDB`);
    await assert.rejects(migrate(fixture.migration, fixture.roles));
    assert.equal((await fixture.migration.query("SELECT to_regclass('schema_migrations') AS relation")).rows[0].relation, null);
  } finally { await fixture.close(); }
});
