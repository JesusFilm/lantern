import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('migration and operator commands never fall back to the runtime credential', () => {
  for (const [file, variable] of [['migrate', 'MIGRATION_DATABASE_URL'], ['operations', 'ADMIN_DATABASE_URL']]) {
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: 'postgresql://unused@127.0.0.1:1/unused' };
    delete env.MIGRATION_DATABASE_URL;
    delete env.ADMIN_DATABASE_URL;
    const result = spawnSync(process.execPath, ['--import', 'tsx', `server/${file}.ts`], { env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`${variable} is required`));
  }
});

test('bootstrap requires an explicit setup mode and refuses an existing-data production mode', () => {
  const env: NodeJS.ProcessEnv = {...process.env,BOOTSTRAP_DATABASE_URL:'postgresql://unused@127.0.0.1:1/unused'};
  delete env.LANTERN_DB_SETUP_MODE;
  const missing = spawnSync(process.execPath,['--import','tsx','server/bootstrap-database.ts'],{env,encoding:'utf8'});
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/LANTERN_DB_SETUP_MODE/);
  const existing = spawnSync(process.execPath,['--import','tsx','server/bootstrap-database.ts'],{env:{...env,LANTERN_ENV:'production',LANTERN_DB_SETUP_MODE:'legacy-stage'},encoding:'utf8'});
  assert.notEqual(existing.status,0);
  assert.match(existing.stderr,/Production setup requires empty/);
});
