import { readFile, stat, writeFile } from 'node:fs/promises';
import { planAuthRecovery, planAuthRecoveryByEmail, applyAuthRecovery, planAuthSessionCutover, applyAuthSessionCutover } from './auth-recovery.js';
import { lanternEnvironment } from './runtime.js';
import { linkJesusFilmIdentity } from './auth-link.js';
import { prepareLocalAccount } from './local-access.js';
import { assertDatabaseTarget, databaseRoleConfig } from './database-privileges.js';
import { approveEmail, revokeEmail, approvedEmails } from './admission.js';
import { createDatabase } from './database.js';
import { assertSchemaReady } from './schema.js';
import { removeMember, setupDepartment } from './membership.js';

async function privateJson(path: string) {
  if ((await stat(path)).mode & 0o077) throw new Error('Recovery input must be a private file (mode 600).');
  try { return JSON.parse(await readFile(path, 'utf8')) as unknown; }
  catch { throw new Error('Recovery input must be valid JSON.'); }
}
async function writePlan(path: string, plan: unknown) {
  await writeFile(path, JSON.stringify(plan, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Private recovery plan written. Review before applying.');
}

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
  else if (operation === 'plan-auth-recovery-by-email' && args.length === 2) await writePlan(args[1]!, await planAuthRecoveryByEmail(db, args[0]!));
  else if (operation === 'plan-auth-recovery' && args.length === 2) await writePlan(args[1]!, await planAuthRecovery(db, await privateJson(args[0]!)));
  else if (operation === 'apply-auth-recovery' && args.length === 1) await applyAuthRecovery(db, await privateJson(args[0]!));
  else if (operation === 'plan-auth-session-cutover' && args.length === 1) await writePlan(args[0]!, await planAuthSessionCutover(db));
  else if (operation === 'apply-auth-session-cutover' && args.length === 1) await applyAuthSessionCutover(db, await privateJson(args[0]!));
  else if (operation === 'link-auth' && args.length === 3) await linkJesusFilmIdentity(db, args[0]!, args[1]!, args[2]!);
  else if (operation === 'approve-email' && args.length === 1) await approveEmail(db, args[0]!);
  else if (operation === 'remove-approved-email' && args.length === 1) await revokeEmail(db, args[0]!);
  else if (operation === 'list-approved-emails' && !args.length) console.log((await approvedEmails(db)).join('\n'));
  else throw new Error('Usage: npm run access:ops -- local-account | setup DEPARTMENT REGISTERED_LEAD_EMAIL | remove-member USER_UUID | link-auth USER_UUID AUTH_SUBJECT VERIFIED_EMAIL | plan-auth-recovery-by-email EMAIL PLAN_JSON | plan-auth-recovery MAPPING_JSON PLAN_JSON | apply-auth-recovery PLAN_JSON | plan-auth-session-cutover PLAN_JSON | apply-auth-session-cutover PLAN_JSON | approve-email EMAIL | remove-approved-email EMAIL | list-approved-emails');
  console.log('Operation completed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Operation failed.');
  process.exitCode = 1;
} finally { await db.end(); }
