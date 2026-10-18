import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { createDatabase } from './database.js';
import { databaseRoleConfig, identifier } from './database-privileges.js';
import { inspectLegacyDatabase, transferLegacyDatabase, validateLegacyCounts } from './database-transition.js';
import { assertOperatorEndpoint } from './operator-target.js';

const connection = process.env.BOOTSTRAP_DATABASE_URL;
if (!connection) throw new Error('BOOTSTRAP_DATABASE_URL is required.');
if (!['local','stage'].includes(process.env.LANTERN_ENV ?? '')) throw new Error('Existing-data transfer is restricted to local or stage.');
assertOperatorEndpoint(connection, process.env.LANTERN_DB_EXPECTED_ENDPOINT);
const sourceOwner = process.env.LANTERN_DB_SOURCE_OWNER;
if (!sourceOwner) throw new Error('LANTERN_DB_SOURCE_OWNER is required.');
identifier(sourceOwner);
const target = {...databaseRoleConfig(), sourceSchema:'public', sourceOwner};
const [action,path,...extra] = process.argv.slice(2);
if (!['inspect','apply','reverse'].includes(action ?? '') || !path || !isAbsolute(path) || extra.length) throw new Error('Usage: transition-database inspect|apply|reverse /private/inventory.json');
const db = createDatabase(connection);
try {
  if (action === 'inspect') {
    const expectedRows = await inspectLegacyDatabase(db,target);
    await writeFile(path, JSON.stringify({format:1,environment:process.env.LANTERN_ENV,endpoint:process.env.LANTERN_DB_EXPECTED_ENDPOINT,target,expectedRows},null,2)+'\n', {mode:0o600,flag:'wx'});
    console.log('Private inventory saved. Review target and counts before authorizing apply.');
  } else {
    const plan: unknown = JSON.parse(await readFile(path,'utf8'));
    if (!plan || typeof plan !== 'object' || !('format' in plan) || plan.format !== 1
      || !('environment' in plan) || plan.environment !== process.env.LANTERN_ENV
      || !('endpoint' in plan) || plan.endpoint !== process.env.LANTERN_DB_EXPECTED_ENDPOINT
      || !('target' in plan) || JSON.stringify(plan.target) !== JSON.stringify(target)
      || !('expectedRows' in plan)) throw new Error('Inventory target mismatch.');
    validateLegacyCounts(plan.expectedRows);
    await transferLegacyDatabase(db,target,plan.expectedRows,action === 'reverse' ? 'reverse' : 'forward');
    console.log('Transfer committed and row counts verified. Keep the application stopped until the next checkpoint.');
  }
} catch {
  console.error('No transfer success recorded. Keep the application stopped; verify database state before retry or recovery.');
  process.exitCode = 1;
} finally { await db.end(); }
