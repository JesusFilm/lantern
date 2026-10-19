import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// One-shot private-network runner; never used as the application start command.
try {
  if (process.env.LANTERN_ENV !== 'stage' || process.env.RAILWAY_ENVIRONMENT_ID !== '8e19675b-08a2-4bfb-9762-fd6d8561fcfd') throw new Error('Stage required');
  const { sha } = JSON.parse(readFileSync('release.json', 'utf8')) as { sha: string };
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Checked revision required');
  const result = spawnSync(process.execPath, ['dist/server/migrate.js'], { env: process.env, stdio: 'pipe' });
  if (result.status !== 0) throw new Error('Migration failed');
  console.log(`LANTERN_STAGE_MIGRATION_COMPLETE:${sha}`);
} catch {
  console.error('Staging migration failed; application deployment must not proceed.');
  process.exitCode = 1;
}
