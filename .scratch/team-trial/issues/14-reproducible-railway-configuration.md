Kind: ticket
ID: team-trial/14
Title: Make Railway deployment configuration reproducible
Milestone: M06
Type: task
Status: ready-for-agent
Blocked by: 04
Implementation: Repository app pre-deploy migration removed; scoped runner commands and transition prepared; effective hosted setup outstanding
Slice: Hosted team trial

---
## Outcome

Replace the assumption that uploading railway.json configures a new service with a reviewed, reproducible source of deployment settings and drift verification.

## Acceptance

- [ ] Reconcile and merge sanitized setup evidence/runbook changes currently local to the setup worktree. Capture actual stage settings and intended production settings without secrets. Do not treat local documentation as merged evidence.
- [ ] Verify current Railway-supported configuration mechanisms and choose an authoritative repository-managed approach (evaluate Infrastructure as Code). Document any unavoidable dashboard steps and how drift is detected.
- [ ] Cover Dockerfile/build, start command, separate human-invoked migration runner, healthcheck/timeout/restart policy, explicit environment identity and disabled independent autodeploy. Keep secrets and resource references environment-specific; do not embed credentials.
- [ ] Verify configuration on staging, including successful compiled migration and exact-revision/deployment health headers. Fail or block delivery when required effective settings are missing; merely finding railway.json is insufficient.
- [ ] Prepare and review production configuration without deploying or migrating production. Account for ticket 13's separate migration/runtime/admin privileges; final configuration must conform before release verification.
- [ ] Document and test migration from current dashboard settings without resetting services/data or enabling automatic delivery. Record the checked revision and effective settings.

## Local preparation — 19 October 2026

The repository app configuration no longer contains a privileged pre-deploy command.
Migration runs separately via the built command with its own credential; scope and
readiness checks are prepared. Hosted settings may still contain the historical
hook. Removing a checked-in field does not prove a dashboard override is cleared.
Verify the actual runner's access path and effective app configuration during a
separately authorized staging transition before using the production procedure in 17.

## Boundary

Local preparation and tests were authorized on 19 October; hosted configuration, credentials and deployment still require separate authorization. The first staging crash was caused by absent effective migration/health settings; the successful manual recovery does not demonstrate reproducible deployment configuration.
