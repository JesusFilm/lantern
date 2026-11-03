import assert from 'node:assert/strict';
import { test } from 'node:test';
import { privilegeFixture } from './privilege-test-support.js';
import { assertSchemaReady, migrate } from './schema.js';
import { assertRuntimePrivileges } from './database-privileges.js';
import { verifyDatabase } from './database-verification.js';
import { randomUUID } from 'node:crypto';

test('schema 10 upgrades schema 9 additively, verifies restricted grants and rejects changes to ownership and relationships', async () => {
  const f = await privilegeFixture();
  try {
    await migrate(f.migration, f.roles);
    await f.migration.query('DROP TABLE ai_member_tokens,ai_member_focuses,ai_members; DELETE FROM schema_migrations WHERE version=10');
    const owner = randomUUID();
    await f.admin.query("INSERT INTO users VALUES($1,'synthetic-sub','owner@example.test','Owner')", [owner]);
    await assert.rejects(assertSchemaReady(f.runtime));
    await migrate(f.migration, f.roles);
    await migrate(f.migration, f.roles);
    await assertSchemaReady(f.runtime);
    for (const scope of ['runtime', 'admin', 'migration'] as const) await verifyDatabase(f[scope], { ...f.roles, expectedDatabase: f.databaseName, schema: 'lantern' }, scope);
    assert.equal((await f.runtime.query('SELECT name FROM users WHERE id=$1', [owner])).rows[0].name, 'Owner');
    const member = randomUUID();
    await f.runtime.query("INSERT INTO ai_members(id,owner_user_id,name) VALUES($1,$2,'Helper')", [member, owner]);
    for (const sql of [
      "UPDATE ai_members SET owner_user_id=gen_random_uuid()", 'UPDATE ai_members SET id=gen_random_uuid()',
      'UPDATE ai_member_focuses SET ai_member_id=gen_random_uuid()', 'UPDATE ai_member_tokens SET ai_member_id=gen_random_uuid()',
      'UPDATE ai_member_tokens SET id=gen_random_uuid()', 'UPDATE ai_member_tokens SET name=\'forged\'',
      'CREATE TABLE unauthorized(id integer)', "UPDATE memberships SET role='career-lead'",
    ]) await assert.rejects(f.runtime.query(sql), { code: '42501' }, sql);
    await assert.rejects(f.admin.query('DELETE FROM users WHERE id=$1', [owner]), { code: '23503' });
    for (const goals of [[], [42], [''], ['   '], ['\t\n']]) {
      await assert.rejects(f.runtime.query('INSERT INTO ai_member_focuses(ai_member_id,objective,goals,version) VALUES($1,$2,$3,1)', [member, 'Outcome', JSON.stringify(goals)]), { code: '23514' });
    }
    await f.migration.query('CREATE TABLE private_later(secret text)');
    await assert.rejects(f.runtime.query('SELECT * FROM private_later'), { code: '42501' });
    await f.migration.query(`GRANT UPDATE(owner_user_id) ON ai_members TO "${f.roles.runtime}"`);
    await assert.rejects(assertRuntimePrivileges(f.runtime));
    await migrate(f.migration, f.roles);
    await assertRuntimePrivileges(f.runtime);
  } finally { await f.close(); }
});
