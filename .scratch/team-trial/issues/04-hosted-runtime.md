Kind: ticket
ID: team-trial/04
Title: Prepare hosted runtime, required CI and gated stage delivery
Milestone: M06
Type: task
Status: ready-for-agent
Blocked by: None
Implementation: Not started
Slice: Hosted team trial

---
## Outcome

A reviewed commit can build, migrate and start with Railway-injected environment variables, while the existing local workflow continues to work.

## Acceptance

- [ ] Compiled server starts without a repository .env file or tsx/dev dependencies at runtime; supports supplied HOST/PORT and serves built React assets. Preserve npm local workflows.
- [ ] Stage and production configurations enforce NODE_ENV=production, LOCAL_ACCESS disabled, explicit HTTPS origin/Google configuration and safe configuration failures. Provide an explicit server-owned environment identity for the access policy; NODE_ENV=production alone does not distinguish stage from production. Missing/invalid identity must fail closed for personal-account admission. Health/readiness works through the public service with no sensitive response data.
- [ ] Provide compiled migration and backend-operations entrypoints; migrations are repeatable and serialized, preserve existing data and fail a release safely. Document the rollout order for later access/lock migrations.
- [ ] Add GitHub Actions checks on PRs targeting main and on merged main revisions: typecheck, browser/HTTP tests against isolated real PostgreSQL and production build, with suitable Node/browser/database setup. Document exact required check names and repository-rule setup. No personnel data or secrets in logs/artifacts.
- [ ] Prepare automatic stage deployment gated on successful CI for that same main SHA. Failed, cancelled or absent checks cannot deploy; prevent a separate Railway merge trigger bypassing the gate. Preserve the chosen SHA throughout deployment, migration and health readiness. Live credentials and rule activation belong to environment setup.
- [ ] Prepare post-deployment stage smoke/E2E automation, synthetic QA-data handling and sanitized evidence tied to deployment/SHA. Failures block promotion. Distinguish automated checks from real-Google/manual acceptance; do not add authentication bypasses or require unattended interaction with Google consent screens.
- [ ] Verify pipeline failure paths and revision binding: failing checks stop deployment; a newer main commit cannot substitute for the checked SHA; stage smoke failure leaves production untouched. Document how setup verifies actual repository rules and deployed gates.
- [ ] TDD exercises deployed startup with injected variables/no .env, real database migration/restart/persistence and configuration failures. Preserve local production-mode rejection regressions.
- [ ] Write commands/configuration and release runbook for separate environments, exact-commit stage deployment, explicit manual production promotion after passing stage evidence, production autodeploy off, rollback compatibility and backup/restore checks. Validate platform details against the linked research/current official docs.

## Boundaries

No live provisioning, credentials, billing changes or data migration in this code ticket. 05 performs environment setup. First implementation priority. Can run independently of approved access; integrate its migration entrypoint with 01/03 before stage acceptance. [Research](../../../docs/research/railway-team-trial.md).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
