# Hosted team trial implementation breakdown

Updated 19 October 2026 after PR #9 merged and authorization to prepare both database
paths locally. This records preparation, not hosted execution authorization.

## Current delivery decision — 19 October 2026

Authenticated staging remains on the previously recorded schema-2 deployment;
no hosted switch has occurred. Production resources exist but its app remains
inactive. Jaco reported no application tables there. Automatic staging delivery
stays disabled. Earlier staging proof is bounded manual evidence, not final acceptance.

Ticket 12 policy is agreed. PR #9 implemented and tested the local role split and
required agent support through human production execution. The next local slice
prepares a data-preserving staging transfer and a fresh production database in
parallel, with recovery and target checks. No hosted credentials are installed by
this work. Ticket 13 still owns full effective-access enforcement.

The explicit sequence is: local rehearsal of both database paths → separately
authorized staging role/runner transition and verification → separately authorized
human production database preparation under 17, with the app inactive → final
acceptance under 06 → separately authorized application activation/enrollment under 07.
Production database readiness is a distinct checkpoint, not an implicit side effect
of deployment. Confirmation/locking (03), transactional failure handling, configuration and release-gate
proof remain required for full launch; no draft-only scope reduction is implied.

## Dependency order

| Order | Ticket | Current state | Blocked by |
| --- | --- | --- | --- |
| Delivered foundations | [01 approved access](issues/01-approved-access.md), [02 lead reads](issues/02-lead-member-focuses.md), [04 runtime/CI](issues/04-hosted-runtime.md) | Merged; bounded manual staging proof recorded | None |
| Agreed policy | [12 production access policy](issues/12-production-access-policy.md) | Policy merged; effective-access inventory incomplete | None |
| Parallel feature work | [03 confirm and lock](issues/03-confirm-and-lock.md) | Not implemented | 02 |
| Parallel configuration work | [14 reproducible Railway configuration](issues/14-reproducible-railway-configuration.md) | Separate local migration command; app hook removed in preparation; hosted runner/settings unverified | 04 |
| Parallel setup completion | [05 environments and Google setup](issues/05-railway-environments.md) | Stage active; production prepared/inactive; incomplete setup acceptance | 01, 04 |
| Access controls | [13 enforce access governance](issues/13-enforce-production-access-governance.md) | Local role split merged; transition prepared; hosted verification outstanding | 12 |
| After setup, controls and configuration | [15 automated release verification](issues/15-verify-automated-release-gates.md) | Existing workflows need credentials, two member sessions and live gate proof | 05, 13, 14 |
| Deferred until value established | [16 production backups](issues/16-backup-restore-readiness.md) | No staging backups; production backups deferred | Dogfooding complete and Jaco’s value decision |
| Convergence on final candidate | [06 real-account stage acceptance](issues/06-stage-verification.md) | Partial save/read proof only; all prerequisites required | 02, 03, 05, 13, 15 |
| Database-only, separately authorized | [17 production database readiness](issues/17-production-database-readiness.md) | Empty-path preparation/rehearsal; human execution outstanding; app stays inactive | Staging transition and transactional failure checks; no dependency on 06 |
| Last, separately authorized | [07 production promotion](issues/07-production-promotion.md) | Existing workflow; actual activation not performed | 06, 17 |
| Optional/deferred | [11 promotion input simplification](issues/11-simplify-manual-promotion.md) | Proposed convenience only | No prerequisite for 07 |

Ticket 10 retains provider setup findings; remaining environment-specific verification is owned by 05 and production login acceptance by 07. Ticket 09 records the superseded hosting-only route. Do not reopen the provider decision or deploy hosting-only mode merely because historical records mention them.

Ticket 05 owns environment readiness, not final release approval. Ticket 15 owns automation and failure-gate verification; 16 is deferred production backup planning, not a dogfooding gate. Their links from 05 are handoffs, not reverse dependencies. This prevents a bootstrap cycle: staging already exists, real sessions are acquired there, then automated delivery can be verified after separate authorization. Production credentials/privileged operations require the applicable 13 safeguards and Jaco's explicit authorization. Ticket 17 supplies production database verification back to 13; it does not require ticket 13 to claim that verification before the database exists.

## Release path and evidence

1. Complete reviewed feature/control/configuration changes with required PR tests; merge the currently local setup evidence and runbook reconciliation through review. Existing workflows are already merged; Renovate is unrelated.
2. On the final merged candidate, obtain successful same-SHA CI and automated staging receipt/readiness/smoke artifact under 15. Earlier manual proof or a previous revision's artifact cannot substitute.
3. After staging transition and transactional failure checks, complete 17's human-run, separately authorized production database checkpoint while the app stays inactive. This may proceed before final feature acceptance. If the final release needs newer migrations, rehearse and apply those through the same guided process and refresh evidence.
4. Complete 06 using a real lead and at least two ordinary members: authoring, read access, confirmation/lock, isolation, denial/revocation, persistence and newcomer usability. Bind recovery and governance verification to the applicable configuration/schema; rerun affected checks after changes.
5. An authorized operator inspects the protected acceptance record and explicitly dispatches the existing SHA/run promotion workflow only after 07's preflight. The URL input alone is not proof its contents passed. Production credentials and migration settings must be verified before dispatch; authenticated production acceptance happens after controlled activation and before inviting the trial group.

No production deployment, ordinary data repair or privilege grant is authorized by this document. Ticket 12 assigns approval/execution to Jaco, with mandatory agent preparation and guidance; no second approver is required. No silent reduction to a draft-only trial; that requires a new scope decision. Later product milestones and admin UI remain deferred.

## Backup decision — 19 October 2026

Jaco explicitly declined backups for staging and production at this point. Do not
create staging snapshots, logical dumps or backup schedules as part of this rollout.
Production backups are deferred until dogfooding is complete and Jaco has determined
the application's value; that milestone triggers reconsideration, not automatic
backup activation. Ticket 16 is deferred and does not block initial database setup,
acceptance or dogfooding. A later production backup proposal needs explicit approval.

Continue target/permission checks, transactional migrations, failure diagnosis and
schema-compatible application rollback. Before migration 3, the rehearsed table
transfer reversal remains available under its documented conditions. There is no
backup-based data recovery promise during this period. A destructive reset, data
removal or rebuild still requires a separate explicit decision; declining backups
does not authorize discarding existing records. Earlier local synthetic dump/restore
results remain historical evidence, not authorization for hosted backups.
