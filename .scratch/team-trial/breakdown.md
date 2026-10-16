# Hosted team trial implementation breakdown

Reconciled 16 October 2026 after authenticated staging proof and the production-readiness review. This is a planning update, not authorization to execute the queue.

## Current delivery decision — 16 October 2026

Authenticated staging is live on checked main revision `8e4cd805e9e5c88dea534823859191627ee8402c`, with schema version 2. Real Google work/personal login, member draft save/reload and career-lead read-only access have been observed. [Activation and workflow evidence](../../docs/operations/staging-activation-evidence.md) records this bounded manual proof; it is not full stage acceptance or automated release evidence. Google setup resumed successfully; the earlier hosting-only/provider-pause route is historical.

Production remains inactive and `STAGE_DELIVERY_ENABLED` remains unset/false. This reconciliation authorizes planning only: no code implementation, credentials, permissions, infrastructure, workflow runs or delivery activation. Future execution requires a separate instruction; ticket readiness alone does not grant it.

The existing `ci.yml` stage job and `promote.yml` manual promotion workflow are merged. Stage automation lacks its token and two ordinary-member session secrets; no passing stage artifact exists. Ticket 11 is optional promotion-UI simplification, not a prerequisite for the existing explicit SHA/run workflow. Confirm-and-lock (03), full acceptance, recovery and production access governance remain required. A narrower draft-only production pilot would require an explicit scope change.

Manual release promotion still requires one authorized operator, not a separate reviewer. Production **data-change** approval and emergency-access policy are unresolved in ticket 12; do not infer them from that release-promotion decision.

## Dependency order

| Order | Ticket | Current state | Blocked by |
| --- | --- | --- | --- |
| Delivered foundations | [01 approved access](issues/01-approved-access.md), [02 lead reads](issues/02-lead-member-focuses.md), [04 runtime/CI](issues/04-hosted-runtime.md) | Merged; bounded manual staging proof recorded | None |
| First: policy decision | [12 production access policy](issues/12-production-access-policy.md) | Requires operator decisions; no controls claimed | None |
| Parallel feature work | [03 confirm and lock](issues/03-confirm-and-lock.md) | Not implemented | 02 |
| Parallel configuration work | [14 reproducible Railway configuration](issues/14-reproducible-railway-configuration.md) | Not implemented; reconcile local evidence and dashboard drift | 04 |
| Parallel setup completion | [05 environments and Google setup](issues/05-railway-environments.md) | Stage active; production prepared/inactive; incomplete setup acceptance | 01, 04 |
| After policy | [13 enforce access governance](issues/13-enforce-production-access-governance.md) | Blocked on policy; implementation choices unresolved | 12 |
| After setup, controls and configuration | [15 automated release verification](issues/15-verify-automated-release-gates.md) | Existing workflows need credentials, two member sessions and live gate proof | 05, 13, 14 |
| In parallel with release verification | [16 recovery readiness](issues/16-backup-restore-readiness.md) | Backup policy and isolated rehearsal outstanding | 05, 13, 14 |
| Convergence on final candidate | [06 real-account stage acceptance](issues/06-stage-verification.md) | Partial save/read proof only; all prerequisites required | 02, 03, 05, 13, 15, 16 |
| Last, separately authorized | [07 production promotion](issues/07-production-promotion.md) | Existing workflow; actual activation not performed | 06 |
| Optional/deferred | [11 promotion input simplification](issues/11-simplify-manual-promotion.md) | Proposed convenience only | No prerequisite for 07 |

Ticket 10 retains provider setup findings; remaining environment-specific verification is owned by 05 and production login acceptance by 07. Ticket 09 records the superseded hosting-only route. Do not reopen the provider decision or deploy hosting-only mode merely because historical records mention them.

Ticket 05 owns environment readiness, not final release approval. Ticket 15 owns automation and failure-gate verification; 16 owns recovery. Their links from 05 are handoffs, not reverse dependencies. This prevents a bootstrap cycle: staging already exists, real sessions are acquired there, then automated delivery can be verified after separate authorization. Production credentials/privileged operations remain gated by 13 even if earlier resource preparation is complete.

## Release path and evidence

1. Complete reviewed feature/control/configuration changes with required PR tests; merge the currently local setup evidence and runbook reconciliation through review. Existing workflows are already merged; Renovate is unrelated.
2. On the final merged candidate, obtain successful same-SHA CI and automated staging receipt/readiness/smoke artifact under 15. Earlier manual proof or a previous revision's artifact cannot substitute.
3. Complete 06 using a real lead and at least two ordinary members: authoring, read access, confirmation/lock, isolation, denial/revocation, persistence and newcomer usability. Bind recovery and governance verification to the applicable configuration/schema; rerun affected checks after changes.
4. An authorized operator inspects the protected acceptance record and explicitly dispatches the existing SHA/run promotion workflow only after 07's preflight. The URL input alone is not proof its contents passed. Production credentials and migration settings must be verified before dispatch; authenticated production acceptance happens after controlled activation and before inviting the trial group.

No production deployment, ordinary data repair or privilege grant is authorized by this document. Release promotion's one-operator decision is separate from ticket 12's unresolved data-change approval policy. No silent reduction to a draft-only trial; that requires a new scope decision. Later product milestones and admin UI remain deferred.
