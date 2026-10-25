import { createDatabase } from './database.js';
import { databaseRoleConfig, type DatabaseRoles } from './database-privileges.js';
import { verifyDatabase } from './database-verification.js';
import { assertOperatorEndpoint } from './operator-target.js';
const [scope,option,...extra] = process.argv.slice(2);
if (!['runtime','migration','admin'].includes(scope ?? '') || (option !== undefined && option !== '--expect-empty') || extra.length) throw new Error('Usage: verify-database runtime|migration|admin [--expect-empty]');
const variable = scope === 'runtime' ? 'DATABASE_URL' : scope === 'migration' ? 'MIGRATION_DATABASE_URL' : 'ADMIN_DATABASE_URL';
const connection = process.env[variable];
if (!connection) throw new Error(`${variable} is required.`);
assertOperatorEndpoint(connection, process.env.LANTERN_DB_EXPECTED_ENDPOINT);
const config = databaseRoleConfig();
const db = createDatabase(connection);
try {
  await verifyDatabase(db,config,scope as keyof DatabaseRoles,option === '--expect-empty');
  console.log('Read-only database scope verification passed. No application records were printed.');
} catch {
  console.error('Database verification failed. Keep the application inactive and investigate using the operator procedure.');
  process.exitCode = 1;
} finally { await db.end(); }
