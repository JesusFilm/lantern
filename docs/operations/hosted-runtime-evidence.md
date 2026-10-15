# Hosted runtime implementation evidence

Date: 15 October 2026. Branch: `codex/hosted-runtime-ci`. Planning/base revision: `ef74bcbb9172094b694132838bd1ab71dc9129bd` from fetched `origin/main`. Worktree: `/home/jacobuntu/Ops/worktrees/lantern-hosted-runtime-ci`. Primary checkout remained clean at the baseline; existing PostgreSQL service was reused only through uniquely named test schemas, dropped after each test. No live deployment, provisioning, secret/rule changes or participant data was used.

## Verified locally

- Node 24.21.0: `npm run typecheck` and `npm run build` pass.
- Full PostgreSQL/HTTP/browser suite: `npm test` with DATABASE_URL injected and no `.env`; 53 tests pass, none skipped/cancelled.
- New configuration tests first failed without the runtime interface, then passed with restrictive default identity and invalid/unsafe configuration rejection.
- New migration test first failed without readiness support, then passed: empty-schema denial, concurrent migration, repeat execution and retained operator data. Additional tests verify transactional DDL rollback and bounded lock-contention failure.
- Compiled production-only package: fresh temporary directory, `npm ci --omit=dev --ignore-scripts`, no `.env`; compiled migration/operator/start commands run, React assets and HTTP denial work, restart works, missing schema/configuration fails startup and lost required schema fails readiness. Local persisted profile survives repeated compiled migrations and restart.
- Release gates were exercised red → green for missing implementation and deployment receipt parsing. Failure/cancelled/skipped/missing checks, different SHA, wrong repository/workflow/event/run state, missing stage evidence and wrong target/failed Railway receipt all reject.
- Stage smoke runs against a real local HTTPS service, real Chromium and an isolated real PostgreSQL schema. Two synthetic member sessions exercise draft creation/read/reload and cross-member denial; expired sessions reject. TLS fixture trust is injected only by the test; deployed automation retains normal HTTPS verification.
- Production Docker build succeeded using the multi-stage Dockerfile and a generated baseline stamp. This local image is build validation, not a released candidate or live stage evidence. Production dependency packaging is also independently exercised by the compiled runtime test.
- Both GitHub workflows pass actionlint 1.7.7. JavaScript entrypoints pass syntax checking; `git diff --check` passes.

The tests use fixed synthetic values and isolated schemas. No browser captures, live API responses, session values or database dumps are release artifacts. Existing browser regression captures remain local repository test behavior; the workflow does not upload them.

## Outstanding live evidence — ticket 05 and later

None of these are claimed by local tests: Railway stage/production resources and scoped tokens; Google clients/callbacks and local/stage/production login; repository required-check rules and production environment reviewers; disabled independent Railway deployment triggers; actual CLI receipt/readiness headers; two approved QA member sessions; practical newcomer/lead/locking acceptance; backup retention policy and isolated restore rehearsal; production promotion and human production smoke.

The [release runbook](hosted-release.md) lists required variables/secrets, exact required check names, target-specific operator commands, real failure-path drills, evidence retention, manual approval responsibilities and recovery procedures.

## Integration seams

1. Authentication consumes the typed `LanternEnvironment`/`resolveRuntime().environment` in `server/runtime.ts`. Omission means `production`; invalid identity throws. Both hosted environments use production NODE_ENV. Thread this identity into approved-access configuration when integrating that branch; authentication files were intentionally untouched here.
2. `server/schema.ts` owns the transaction-scoped migration lock and version ledger. Tickets 01/03 must add subsequent numbered steps outside the version-1 guard, and update readiness/schema reporting together. Do not append upgrades to the already-applied baseline block.
3. `createApp` has an optional third runtime-readiness argument; its existing authentication-config argument remains intact. `server/index.ts` resolves runtime before opening the database.
4. `server/operations.ts` now checks schema readiness instead of migrating implicitly. Extend its existing dispatch with approved-access operations after the explicit compiled migration step.
5. The isolated smoke fixture currently seeds baseline users/domains/sessions. When approved-access changes its required storage, update that fixture with synthetic approvals under the real new policy; do not add a runtime bypass. Stage cookies still come from normal Google login.
6. Integrate this branch before approved access. Re-run all tests and a new stage delivery after integration; evidence for this branch alone does not cover the combined release.

## First PR execution

PR #3 triggered GitHub Actions before merge, confirming that this private repository can run the checks. The first run passed typecheck/build but exposed an existing browser-test race: it reloaded immediately after clicking Save, before the HTTP write finished. A 300ms delay at the real HTTP boundary reproduced the same lost-edit assertion locally. Waiting for the save dialog to close (the application's confirmed-save signal) fixes the test while preserving its persistence assertions; the delayed scenario and typecheck pass locally. The profile-save/reload test now waits for the same signal. No application behavior or authorization was changed.
