Kind: ticket
ID: team-trial/07
Title: Promote the verified revision and open the limited trial
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 06, 17
Implementation: Explicit SHA/run promotion workflow merged; production activation not performed
Slice: Hosted team trial

---
## Current execution boundary — 16 October 2026

Real Google staging and bounded member-save/lead-read proof are recorded in [activation evidence](../../../docs/operations/staging-activation-evidence.md). Full acceptance is incomplete. Production remains inactive and automatic stage delivery remains disabled. This planning update does not authorize either activation. The dependency-ordered production prerequisites are in the [breakdown](../breakdown.md).

## Outcome

Invited participants can use the stage-verified version in production, with a traceable release and recovery procedure.

## Database readiness before activation

Ticket [17](17-production-database-readiness.md) prepares and verifies production
roles and tables while the app remains inactive. This ticket consumes that evidence
and owns the later release/enrollment decision. If the final accepted candidate
adds migrations, rehearse them and guide Jaco through applying them before startup;
do not assume an earlier database checkpoint covers a new schema.

## Acceptance

- [ ] Confirm 17 has recorded human-reported schema, role/credential and empty-data readiness, plus any subsequent migration results.
- [ ] Before dispatch, verify production-only OAuth credentials, target-scoped deployment credentials, effective migration/start/health configuration (14) and restricted access (13). Never reuse stage approvals or the personal QA member: production requires approved work accounts. Installation/activation requires a separately authorized release task.
- [ ] Use the already implemented `.github/workflows/promote.yml`; ticket 11 is optional. Inspect and record operator sign-off on the protected acceptance checklist. The workflow checks an HTTPS URL, not the truth of its contents; apply ticket 15's agreed enforcement decision.

- [ ] Require an explicit operator promotion action after successful stage verification, including same-revision CI and stage smoke/E2E evidence. Confirm successful stage acceptance evidence, target production project/service and private participant approvals. Record the exact reviewed SHA, stage deployment and checks; production autodeploy stays off.
- [ ] Capture a pre-release backup where data exists. Verify restore evidence, migration compatibility and application rollback target. Do not treat code rollback as a database rollback.
- [ ] Deploy that tested commit (or identical tested image digest) to production with production-specific secrets/database. If code changes or latest main is different, select the verified revision or return it to stage.
- [ ] On the verified production release, approve the intended work-account lead/member emails through the controlled, audited production operations verified in 13, perform initial Google login and backend lead bootstrap, and assign approved participants. Record production deployment ID/URL, revision and schema/migration result. Confirm healthy startup and safe rollback/failure handling with the prepared runbook.
- [ ] Perform authenticated production smoke checks with approved lead/member accounts: own draft save/reopen, lead read, confirmation and lock, denied outsider/member-cross-access and rejection of personal Google accounts under production policy (also covered with an email-approved personal identity in isolated production-policy tests). Keep test content disposable and isolated from real personnel records where possible.
- [ ] Record the production URL/access instructions for the invited group and a way for Jaco to collect trial feedback; no automated invitation/message sending is required.
- [ ] Close M06 only when actual stage and production evidence exists. Review observed friction before selecting M04 or other deferred work.

## Execution boundary

Requires operator-controlled production configuration and a concrete release decision. This ticket is prepared, not executed by the planning reconciliation. Preserve all current local data/services and prototype hosting.

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
