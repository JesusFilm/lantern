import { createDatabase } from './database.js';
import { bootstrapDatabaseRoles, databaseRoleConfig } from './database-privileges.js';
if (!process.env.BOOTSTRAP_DATABASE_URL) throw new Error('BOOTSTRAP_DATABASE_URL is required.');
const config = databaseRoleConfig();
const db = createDatabase(process.env.BOOTSTRAP_DATABASE_URL);
try {
  await bootstrapDatabaseRoles(db, config);
  console.log('Created isolated NOLOGIN roles and application schema. Configure login credentials privately before migration.');
} catch { console.error('Bootstrap failed; transaction rolled back.'); process.exitCode = 1; }
finally { await db.end(); }
