import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from './database.js';
import { bootstrapDatabaseRoles } from './database-privileges.js';

// Privilege tests need a disposable DATABASE, since PUBLIC database grants cannot
// safely be changed inside a schema shared with other test runs.
export async function privilegeFixture() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Privilege tests require local synthetic PostgreSQL');
  const owner = createDatabase(url.href);
  const suffix = randomUUID().replaceAll('-', '');
  const databaseName = `privilege_${suffix}`;
  const roles = { runtime: `run_${suffix}`, migration: `mig_${suffix}`, admin: `ops_${suffix}` };
  const password = randomUUID();
  await owner.query(`CREATE DATABASE ${databaseName}`);
  url.pathname = `/${databaseName}`;
  const bootstrap = createDatabase(url.href);
  const pools: ReturnType<typeof createDatabase>[] = [];
  async function close() {
    await Promise.all(pools.map(pool => pool.end()));
    await bootstrap.end();
    await owner.query(`DROP DATABASE ${databaseName} WITH (FORCE)`);
    for (const role of Object.values(roles)) await owner.query(`DROP ROLE IF EXISTS ${role}`);
    await owner.end();
  }
  try {
    await bootstrapDatabaseRoles(bootstrap, { expectedDatabase: databaseName, schema: 'lantern', ...roles });
    for (const role of Object.values(roles)) await bootstrap.query(`ALTER ROLE ${role} LOGIN PASSWORD '${password}'`);
    function connection(role: string) {
      const connection = new URL(url); connection.username = role; connection.password = password;
      connection.searchParams.set('options', '-c search_path=lantern');
      const pool = createDatabase(connection.href); pools.push(pool); return pool;
    }
    const migration = connection(roles.migration), runtime = connection(roles.runtime), admin = connection(roles.admin);
    return { bootstrap, migration, runtime, admin, roles, databaseName, close };
  } catch (error) { await close(); throw error; }
}

