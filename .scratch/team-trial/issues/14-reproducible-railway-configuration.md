Kind: ticket
ID: team-trial/14
Title: Make Railway deployment configuration reproducible
Milestone: M06
Type: task
Status: ready-for-agent
Blocked by: 04
Implementation: Not started; planning only
Slice: Hosted team trial

---
## Outcome

Replace the assumption that uploading railway.json configures a new service with a reviewed, reproducible source of deployment settings and drift verification.

## Acceptance

- [ ] Reconcile and merge sanitized setup evidence/runbook changes currently local to the setup worktree. Capture actual stage settings and intended production settings without secrets. Do not treat local documentation as merged evidence.
- [ ] Verify current Railway-supported configuration mechanisms and choose an authoritative repository-managed approach (evaluate Infrastructure as Code). Document any unavoidable dashboard steps and how drift is detected.
- [ ] Cover Dockerfile/build, start command, pre-deploy migration, healthcheck/timeout/restart policy, explicit environment identity and disabled independent autodeploy. Keep secrets and resource references environment-specific; do not embed credentials.
- [ ] Verify configuration on staging, including successful compiled migration and exact-revision/deployment health headers. Fail or block delivery when required effective settings are missing; merely finding railway.json is insufficient.
- [ ] Prepare and review production configuration without deploying or migrating production. Account for ticket 13's separate migration/runtime/admin privileges; final configuration must conform before release verification.
- [ ] Document and test migration from current dashboard settings without resetting services/data or enabling automatic delivery. Record the checked revision and effective settings.

## Boundary

Future implementation only after separate authorization. The first staging crash was caused by absent effective migration/health settings; the successful manual recovery does not demonstrate reproducible deployment configuration.
