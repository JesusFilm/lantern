import { appendFileSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Fixed vocabulary only: browser errors can contain application data and tokens.
const journeyCheckpoints = [
  'configuration', 'authenticated-identities', 'department-direction', 'mission-image',
  'focus-authoring-persistence', 'authorization-isolation', 'stale-and-forged-writes',
  'lead-confirmation-lock', 'account-and-guide', 'browser-errors', 'session-revocation',
  'browser-close', 'review-requests-and-notes', 'coaching-disabled-manual', 'coaching-enabled-journey',
];

export function safeJourneyCheckpoint(error) {
  return journeyCheckpoints.find(code => error?.message === `Staging acceptance failed [${code}].`) ?? 'journey';
}

const outcomes = ['passed', 'failed', 'unknown', 'not-reached'];
const checkpoints = [...journeyCheckpoints, 'journey', 'complete', 'not-reached', 'unknown',
  'stage-health-before', 'stage-health-after', 'journey-and-cleanup', 'fixture-scope',
  'fixture-busy', 'fixture-lifecycle', 'shutdown', 'evidence-write'];
const safeId = value => /^[1-9][0-9]*$/.test(value ?? '') && Number.isSafeInteger(Number(value));

export function acceptanceDiagnostics(env, onDiagnostic = () => {}) {
  let state = {
    type: 'acceptance-diagnostics',
    sha: /^[a-f0-9]{40}$/.test(env.RELEASE_SHA ?? '') ? env.RELEASE_SHA : 'unknown',
    runId: safeId(env.GITHUB_RUN_ID) ? env.GITHUB_RUN_ID : 'unknown',
    runAttempt: safeId(env.GITHUB_RUN_ATTEMPT) ? Number(env.GITHUB_RUN_ATTEMPT) : 'unknown',
    journey: 'not-reached', journeyCheckpoint: 'not-reached', cleanup: 'not-reached',
    checkpoint: 'configuration', passingEvidenceProduced: false,
  };
  return {
    report(update = {}) {
      for (const key of ['journey', 'cleanup']) {
        if (Object.hasOwn(update, key)) state[key] = outcomes.includes(update[key]) ? update[key] : 'unknown';
      }
      for (const key of ['journeyCheckpoint', 'checkpoint']) {
        if (Object.hasOwn(update, key)) state[key] = checkpoints.includes(update[key]) ? update[key] : 'unknown';
      }
      if (Object.hasOwn(update, 'passingEvidenceProduced')) state.passingEvidenceProduced = update.passingEvidenceProduced === true;
      // Reporting must never prevent fixture cleanup or replace an existing failure.
      try { onDiagnostic({ ...state }); } catch {}
      return { ...state };
    },
  };
}

export function persistAcceptanceDiagnostics(diagnostic, path = 'stage-acceptance-diagnostics.json') {
  // A killed runner leaves the last complete phase snapshot, never partial JSON.
  writeFileSync(`${path}.tmp`, JSON.stringify(diagnostic, null, 2), { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

export function acceptanceSummary(env, diagnostic, { stepOutcome } = {}) {
  const diagnostics = acceptanceDiagnostics(env);
  const identity = diagnostics.report();
  const matches = diagnostic?.type === 'acceptance-diagnostics' &&
    ['sha', 'runId', 'runAttempt'].every(key => identity[key] !== 'unknown' && diagnostic[key] === identity[key]);
  const fallback = stepOutcome === 'skipped' ? 'not-reached' : 'unknown';
  const state = diagnostics.report(matches && stepOutcome !== 'skipped' ? diagnostic : {
    journey: fallback, journeyCheckpoint: fallback, cleanup: fallback, checkpoint: fallback,
  });
  const produced = state.passingEvidenceProduced && state.journey === 'passed' &&
    state.cleanup === 'passed' && state.checkpoint === 'complete';
  return [
    '### Staging acceptance diagnostics', '',
    `- Candidate SHA: \`${state.sha}\``,
    `- CI run / attempt: \`${state.runId}\` / \`${state.runAttempt}\``,
    `- Journey: **${state.journey}** (safe checkpoint: \`${state.journeyCheckpoint}\`)`,
    `- Fixture cleanup: **${state.cleanup}**`,
    `- Runner checkpoint: \`${state.checkpoint}\``,
    `- Passing promotion evidence produced: **${produced ? 'yes' : 'no'}**`,
    '', 'Diagnostic summary only; never promotion evidence.', '',
  ].join('\n');
}

// Runs even after acceptance failed or was skipped, and needs no npm dependencies.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let diagnostic;
  try { diagnostic = JSON.parse(readFileSync('stage-acceptance-diagnostics.json', 'utf8')); } catch {}
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, acceptanceSummary(process.env, diagnostic, {
      stepOutcome: process.env.ACCEPTANCE_STEP_OUTCOME,
    }));
  } catch {
    console.error('Staging acceptance diagnostic summary could not be written.');
    process.exitCode = 1;
  }
}
