import { lanternEnvironment } from './runtime.js';
import { prepareLocalAccount } from './local-access.js';
import { assertDatabaseTarget, databaseRoleConfig } from './database-privileges.js';
import { approveEmail, revokeEmail, approvedEmails } from './admission.js';
import { createDatabase } from './database.js';
import { assertSchemaReady } from './schema.js';
import { removeMember, setupDepartment } from './membership.js';

if (!process.env.ADMIN_DATABASE_URL) throw new Error('ADMIN_DATABASE_URL is required.');
lanternEnvironment(process.env.LANTERN_ENV);
const config = databaseRoleConfig();
const db = createDatabase(process.env.ADMIN_DATABASE_URL);
try {
  await assertDatabaseTarget(db, {database:config.expectedDatabase,schema:config.schema,role:config.admin});
  await assertSchemaReady(db);
  const [operation, ...args] = process.argv.slice(2);
  if (operation === 'local-account' && !args.length) {
    const host = new URL(process.env.ADMIN_DATABASE_URL).hostname;
    if (process.env.LANTERN_ENV !== 'local' || !['127.0.0.1','localhost','[::1]'].includes(host)) throw new Error('Synthetic account preparation requires local loopback PostgreSQL.');
    await prepareLocalAccount(db);
  }
  else if (operation === 'setup' && args.length === 2) await setupDepartment(db, args[0]!, args[1]!);
  else if (operation === 'remove-member' && args.length === 1) await removeMember(db, args[0]!);
  else if (operation === 'approve-email' && args.length === 1) await approveEmail(db, args[0]!);
  else if (operation === 'remove-approved-email' && args.length === 1) await revokeEmail(db, args[0]!);
  else if (operation === 'list-approved-emails' && !args.length) console.log((await approvedEmails(db)).join('\n'));
  else throw new Error('Usage: npm run access:ops -- local-account | setup DEPARTMENT REGISTERED_LEAD_EMAIL | remove-member USER_UUID | approve-email EMAIL | remove-approved-email EMAIL | list-approved-emails');
  console.log('Operation completed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Operation failed.');
  process.exitCode = 1;
} finally { await db.end(); }
