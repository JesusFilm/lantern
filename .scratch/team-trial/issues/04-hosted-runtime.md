Kind: ticket
ID: team-trial/04
Title: Prepare a reproducible hosted runtime and release checks
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
- [ ] Stage and production configurations enforce NODE_ENV=production, LOCAL_ACCESS disabled, explicit HTTPS origin/Google configuration and safe configuration failures. Health/readiness works through the public service with no sensitive response data.
- [ ] Provide compiled migration and backend-operations entrypoints; migrations are repeatable and serialized, preserve existing data and fail a release safely. Document the rollout order for later access/lock migrations.
- [ ] Add repository release checks for typecheck, browser/HTTP tests against isolated real PostgreSQL and production build, with suitable Node/browser/database setup. No personnel data or secrets in logs/artifacts.
- [ ] TDD exercises deployed startup with injected variables/no .env, real database migration/restart/persistence and configuration failures. Preserve local production-mode rejection regressions.
- [ ] Write commands/configuration and release runbook for separate environments, exact-commit stage deployment, production autodeploy off, rollback compatibility and backup/restore checks. Validate platform details against the linked research/current official docs.

## Boundaries

No live provisioning, credentials, billing changes or data migration in this code ticket. 05 performs environment setup. Can run independently of 01; integrate its migration entrypoint with 01/03 before stage acceptance. [Research](../../../docs/research/railway-team-trial.md).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
