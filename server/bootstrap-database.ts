import { assertOperatorEndpoint } from './operator-target.js';
import { createDatabase } from './database.js';
import { bootstrapDatabaseRoles, databaseRoleConfig } from './database-privileges.js';
if (!process.env.BOOTSTRAP_DATABASE_URL) throw new Error('BOOTSTRAP_DATABASE_URL is required.');
const mode = process.env.LANTERN_DB_SETUP_MODE;
if (!['empty','legacy-stage'].includes(mode ?? '')) throw new Error('LANTERN_DB_SETUP_MODE must be empty or legacy-stage.');
if (process.env.LANTERN_ENV === 'production' && mode !== 'empty') throw new Error('Production setup requires empty mode.');
if (!['local','stage','production'].includes(process.env.LANTERN_ENV ?? '')) throw new Error('Explicit LANTERN_ENV is required.');
assertOperatorEndpoint(process.env.BOOTSTRAP_DATABASE_URL,process.env.LANTERN_DB_EXPECTED_ENDPOINT);
if (!process.env.LANTERN_DB_SOURCE_OWNER) throw new Error('LANTERN_DB_SOURCE_OWNER is required.');
const config = databaseRoleConfig();
const db = createDatabase(process.env.BOOTSTRAP_DATABASE_URL);
try {
  await bootstrapDatabaseRoles(db, {...config, requireEmpty:mode === 'empty', expectedOwner:process.env.LANTERN_DB_SOURCE_OWNER});
  console.log('Created isolated NOLOGIN roles and application schema. Configure login credentials privately before migration.');
} catch { console.error('No bootstrap success recorded. Keep the application inactive; verify database state before retry or recovery.'); process.exitCode = 1; }
finally { await db.end(); }
