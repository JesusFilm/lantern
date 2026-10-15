import { createDatabase } from './database.js';
import { assertSchemaReady } from './schema.js';
import { configureDomains, removeMember, setupDepartment } from './membership.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = createDatabase(process.env.DATABASE_URL);
try {
  await assertSchemaReady(db);
  const [operation, ...args] = process.argv.slice(2);
  if (operation === 'domains' && args.length) await configureDomains(db, args);
  else if (operation === 'setup' && args.length === 2) await setupDepartment(db, args[0]!, args[1]!);
  else if (operation === 'remove-member' && args.length === 1) await removeMember(db, args[0]!);
  else throw new Error('Usage: npm run access:ops -- domains DOMAIN… | setup DEPARTMENT REGISTERED_LEAD_EMAIL | remove-member USER_UUID');
  console.log('Operation completed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Operation failed.');
  process.exitCode = 1;
} finally { await db.end(); }
