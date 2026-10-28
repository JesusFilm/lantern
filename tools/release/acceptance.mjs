import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateHostedMigrationTarget } from './settings.mjs';
import { runAcceptanceBrowser, ACCEPTANCE_CHECKS, ENABLED_ACCEPTANCE_CHECKS } from './acceptance-browser.mjs';
import { acceptanceDiagnostics, persistAcceptanceDiagnostics } from './acceptance-diagnostics.mjs';

class AcceptanceFailure extends Error {
  constructor(checkpoint) { super(`Staging acceptance failed [${checkpoint}].`); this.checkpoint = checkpoint; }
}

function target(env) {
  assert.equal(env.RELEASE_TARGET, 'stage');
  assert.match(env.RELEASE_SHA ?? '', /^[a-f0-9]{40}$/);
  const origin = new URL(env.APP_ORIGIN);
  assert.equal(origin.protocol, 'https:');
  assert.equal(origin.origin, env.APP_ORIGIN);
  assert.ok(env.EXPECTED_DEPLOYMENT_ID);
  for (const name of ['EXPECTED_SCHEMA_VERSION', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT']) {
    assert.match(env[name] ?? '', /^[1-9][0-9]*$/);
    assert.ok(Number.isSafeInteger(Number(env[name])));
  }
}

// The execution callback owns the journey AND its fixture cleanup. Only its
// successful completion can produce evidence; no browser state is retained.
export async function acceptanceEvidence(env, readiness, execute, { fetch = globalThis.fetch, onDiagnostic } = {}) {
  let checkpoint = 'configuration';
  const diagnostics = acceptanceDiagnostics(env, onDiagnostic);
  diagnostics.report();
  try {
    target(env);
    assert.equal(readiness.readiness, 'passed');
    for (const [field, value] of Object.entries({
      sha: env.RELEASE_SHA, target: 'stage', deployment: env.EXPECTED_DEPLOYMENT_ID,
      schemaVersion: Number(env.EXPECTED_SCHEMA_VERSION), runId: env.GITHUB_RUN_ID,
    })) assert.equal(readiness[field], value);
    async function health() {
      const response = await fetch(env.APP_ORIGIN + '/health', { redirect: 'error', signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-lantern-revision'), env.RELEASE_SHA);
      assert.equal(response.headers.get('x-lantern-deployment'), env.EXPECTED_DEPLOYMENT_ID);
      assert.equal(response.headers.get('x-lantern-schema'), env.EXPECTED_SCHEMA_VERSION);
      assert.deepEqual(await response.json(), { status: 'ok', database: 'ok' });
    }
    checkpoint = 'stage-health-before';
    diagnostics.report({ checkpoint });
    await health();
    checkpoint = 'journey-and-cleanup';
    diagnostics.report({ checkpoint, journey: 'unknown', journeyCheckpoint: 'journey', cleanup: 'unknown' });
    const checks = await execute(update => diagnostics.report(Object.fromEntries(
      ['journey', 'journeyCheckpoint', 'cleanup'].filter(key => Object.hasOwn(update, key)).map(key => [key, update[key]]),
    )));
    const coaching = checks.includes('coaching-enabled-journey') ? 'enabled' : 'disabled';
    assert.deepEqual(checks, coaching === 'enabled' ? ENABLED_ACCEPTANCE_CHECKS : ACCEPTANCE_CHECKS);
    diagnostics.report({ journey: 'passed', journeyCheckpoint: 'complete', cleanup: 'passed' });
    checkpoint = 'stage-health-after';
    diagnostics.report({ checkpoint });
    await health();
    return {
      sha: env.RELEASE_SHA, target: 'stage', deployment: env.EXPECTED_DEPLOYMENT_ID,
      schemaVersion: Number(env.EXPECTED_SCHEMA_VERSION), runId: env.GITHUB_RUN_ID,
      runAttempt: Number(env.GITHUB_RUN_ATTEMPT), readiness: 'passed',
      acceptance: 'passed', cleanup: 'passed', acceptanceSuiteVersion: 3, coaching, checks,
    };
  } catch (error) {
    if (checkpoint === 'journey-and-cleanup' && error instanceof Error) {
      const journey = [...ACCEPTANCE_CHECKS, ...ENABLED_ACCEPTANCE_CHECKS, 'browser-close'].find(code =>
        error.message === `Staging acceptance failed [${code}].`);
      const fixture = new Map([
        ['ACCEPTANCE_FIXTURE_UNSAFE', 'fixture-scope'],
        ['ACCEPTANCE_FIXTURE_BUSY', 'fixture-busy'],
        ['ACCEPTANCE_FIXTURE_FAILED', 'fixture-lifecycle'],
      ]).get(error.code);
      checkpoint = journey ?? fixture ?? checkpoint;
    }
    diagnostics.report({ checkpoint });
    throw new AcceptanceFailure(checkpoint);
  }
}

async function run(env) {
  let directory, database, evidence, failure;
  const diagnostics = acceptanceDiagnostics(env, persistAcceptanceDiagnostics);
  diagnostics.report();
  try {
    target(env);
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), env.RELEASE_SHA);
    for (const name of ['DATABASE_URL', 'ADMIN_DATABASE_URL', 'BOOTSTRAP_DATABASE_URL']) assert.ok(!env[name]);
    const { url, certificate } = validateHostedMigrationTarget(env, 'stage', env.MIGRATION_DATABASE_CA);
    assert.ok(url.password);
    assert.equal(url.hash, '');
    const readiness = JSON.parse(await readFile('release-evidence.json', 'utf8'));
    directory = await mkdtemp(join(tmpdir(), 'lantern-acceptance-ca-'));
    const certificatePath = join(directory, 'ca.pem');
    await writeFile(certificatePath, certificate.toString(), { mode: 0o600 });
    // Match the migration runner's pinned database CA policy. The public proxy
    // hostname differs from the database certificate's private hostname.
    url.searchParams.set('sslmode', 'verify-ca');
    url.searchParams.set('uselibpqcompat', 'true');
    url.searchParams.set('sslrootcert', certificatePath);
    const { createDatabase } = await import('../../dist/server/database.js');
    const { assertDatabaseTarget } = await import('../../dist/server/database-privileges.js');
    const { withAcceptanceFixture } = await import('./acceptance-fixture.mjs');
    evidence = await acceptanceEvidence(env, readiness, async report => {
      report({ journey: 'not-reached', journeyCheckpoint: 'not-reached', cleanup: 'not-reached' });
      database = createDatabase(url.href);
      await assertDatabaseTarget(database, {
        database: env.LANTERN_DB_NAME, schema: 'lantern', role: 'lantern_stage_migration',
      });
      return withAcceptanceFixture(database, fixture => runAcceptanceBrowser({
        origin: env.APP_ORIGIN, sessions: fixture.sessions, runId: fixture.runId,
      }), { onProgress: report });
    }, { onDiagnostic: snapshot => diagnostics.report(snapshot) });
  } catch (error) {
    failure = error instanceof AcceptanceFailure ? error : new AcceptanceFailure('configuration');
    diagnostics.report({ checkpoint: failure.checkpoint });
  } finally {
    // Neither shutdown failure may mask the journey/cleanup result or prevent the
    // other resource from closing. Raw database/filesystem errors stay private.
    for (const close of [() => database?.end(), () => directory && rm(directory, { recursive: true, force: true })]) {
      try { await close(); }
      catch {
        if (!failure) {
          failure = new AcceptanceFailure('shutdown');
          diagnostics.report({ checkpoint: 'shutdown' });
        }
      }
    }
  }
  if (failure) throw failure;
  try {
    await writeFile('stage-acceptance.json', JSON.stringify(evidence, null, 2), { mode: 0o600, flag: 'wx' });
  } catch {
    diagnostics.report({ checkpoint: 'evidence-write' });
    throw new AcceptanceFailure('evidence-write');
  }
  diagnostics.report({ checkpoint: 'complete', passingEvidenceProduced: true });
  console.log('Authenticated staging acceptance and fixture cleanup passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await run(process.env); }
  catch (error) {
    console.error((error instanceof AcceptanceFailure ? error.message : 'Staging acceptance failed [shutdown].') + ' No passing evidence recorded.');
    process.exitCode = 1;
  }
}
