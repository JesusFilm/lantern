# Hosted team trial implementation breakdown

Updated 19 October 2026: Jaco approved simplification after both session handoffs.
This replaces the earlier automated-delivery prerequisites for the initial trial.

## Current state

The later Mac-session handoff and sanitized records report staging revision
`3349636a031d86b90c534e71e4a02d416a8f7df7`, schema 3, separate runtime/migration/admin
roles and removal of the application pre-deploy migration hook. Preserve those
controls and data; the older pending build/tunnel/transfer handoff is superseded.
Single-member persistence, revocation/restoration and lead read-only checks are
recorded. Two-member live acceptance is parked and unpassed; request no new
accounts or resume that case without Jaco's instruction.

PR #12 contains bounded configuration preflight and evidence; it is open with
passing CI, not merged. Production remains inactive and automatic staging delivery
off. This decision authorizes local scope/documentation changes, not deployment,
production access, schema resets or reversal of working controls.

## Trial operating model

Use passing PR/main CI, manual staging acceptance of an exact revision, and one
human-run production release procedure. [The runbook](../../docs/operations/hosted-release.md)
is the release checklist. Jaco executes production steps; agents prepare and rehearse
commands and support sanitized results. Reuse applicable rehearsal evidence;
repeat checks when code, schema, configuration or an unresolved failure warrants it.

Keep authenticated identity, owner/lead authorization, privacy tests, restricted
runtime credentials, separate privileged runners and synthetic agent environments.
Keep existing access policy and sanitized operation records. No custom encryption,
RLS project, general admin framework or provider-owner exclusion project is added.
Jaco remains the trusted provider owner; agent/production separation must still be
verified. Emergency policy remains available without a separate ceremony rehearsal.

## Delivery queue

| Ticket | Remaining scope | Dependencies |
| --- | --- | --- |
| 01 / 02 / 04 | Preserve delivered identity, lead reads, runtime and CI | Delivered foundations |
| 03 | Confirm and lock remains required product scope | 02 |
| 05 | Finish bounded environment/authentication readiness | 01, 04 |
| 13 | Verify concrete access boundaries; prepare usable enrollment/removal operations; preserve completed stage roles | 12; production findings supplied by 17 |
| 14 | Review bounded preflight/configuration and evidence in PR #12; IaC is deferred | 04 |
| 06 | Manual functional/privacy acceptance of selected revision; parked two-member case remains unresolved | 02, 03, 05, 13, 14 |
| 17 | Database checkpoint within the single release procedure; prepared scripts retained | Applicable staging proof and separate human authorization |
| 07 | Human-run release of the accepted revision, verification and sanitized record | 06, 17 |
| 11 / 15 | Promotion convenience and automated release machinery deferred; not trial blockers | Future explicit resumption |
| 16 | Backups deferred until dogfooding/value decision | Future explicit approval |

No requirement to adopt IaC, maintain Google session secrets in CI, produce an
automated stage artifact, or rehearse automated promotion-gate failures for this
trial. Existing workflows retain their checks but remain unused for trial delivery;
do not fabricate artifacts or weaken their code to bypass them.

## Release checkpoints

1. Finish feature work and review/merge the intended code through normal CI.
2. Manually deploy the checked revision to staging when authorized. Record its SHA,
   deployment/schema and practical acceptance. Preserve current evidence where applicable.
3. Prepare the single release record and exact commands. Ticket 17 is its database
   checkpoint, not a second acceptance program. Database preparation can precede
   final feature acceptance if separately authorized; application activation cannot.
4. Jaco executes production preparation and then separately authorized activation
   after required acceptance. Verify intended behavior, record results and cleanup.

Two-member acceptance remains an outstanding launch requirement while parked;
manual delivery does not turn partial acceptance into a pass. Confirmation/locking
also remains required. No narrower draft-only trial has been approved.

## Backup decision

No staging backups or production backups now. Ticket 16 is deferred until dogfooding
is complete and Jaco determines value. Keep transactional failure handling and
schema-compatible code rollback. No backup recovery promise or destructive reset
is authorized. Reconsideration is not automatic backup activation.
