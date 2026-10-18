import { createDatabase } from './database.js';
import { migrate } from './schema.js';
import { assertDatabaseTarget, databaseRoleConfig } from './database-privileges.js';
if (!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL is required.');
const config = databaseRoleConfig();
const database = createDatabase(process.env.MIGRATION_DATABASE_URL);
try {
  await assertDatabaseTarget(database, { database: config.expectedDatabase, schema: config.schema, role: config.migration });
  await migrate(database, {runtime:config.runtime,migration:config.migration,admin:config.admin});
  console.log('Migrations and privilege grants complete.');
} catch { console.error('No migration success recorded. Keep the application inactive; verify the ledger before retry or recovery.'); process.exitCode = 1; }
finally { await database.end(); }
