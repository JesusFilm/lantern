Kind: ticket
ID: team-trial/17
Title: Prepare and verify the production database while the application remains inactive
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: Staging transition and transactional failure checks; explicit human execution authorization
Implementation: Empty-database path and guided procedure prepared and locally rehearsed; production execution not authorized or performed
Slice: Hosted team trial

---
## Role in the release procedure

This is the database checkpoint of ticket 07’s single guided release procedure. Reuse applicable local/staging rehearsal evidence; repeat only affected checks after changes or failures. Preserve the separate sanitized execution result. No new production execution is authorized by the simplification.

## Outcome

Production has its own runtime, migration and administrative roles and the complete
reviewed schema, verified before application activation. No stage accounts, approvals,
sessions or documents are copied. Jaco executes; agents prepare, rehearse and guide
all checkpoints under the operator-assistance procedure.

## Ordering — agreed 19 October 2026

Prepare/rehearse the populated-stage transition and empty-production path together.
After staging role/configuration transition and transactional failure checks, obtain separate
human authorization for this database-only step. Keep the production app inactive.
Ticket 07 owns later deployment, enrollment and user acceptance after 06 and this
ticket. Do not wait for 06 to prepare an empty database: the production findings
here feed the access verification in 13. Dependencies are the rehearsed slices of
13/14, not closure of those tickets; this avoids a circular release gate.

## Acceptance

- [x] Provide an explicit empty-database bootstrap that refuses existing application objects, followed by the separate versioned migration runner.
- [x] Rehearse separate roles, complete schema creation and zero participant/content records locally with synthetic fixtures; no stage copying.
- [x] Provide read-only checks for the three credential scopes and an optional empty-data checkpoint.
- [x] Prepare the [guided procedure](../../../docs/operations/database-transition.md) and a sanitized planned entry in [production changes](../../../docs/operations/production-changes.md).
- [x] Staging transition/configuration and transactional failure evidence is recorded for revision `3349636a031d86b90c534e71e4a02d416a8f7df7`; see the hosted execution entry below.
- [ ] Before production execution, verify that this evidence still covers the intended scripts/schema and resolve production-specific runner/access prerequisites. Repeat affected checks only if the candidate or configuration changed.
- [ ] Jaco explicitly authorizes database-only execution, privately confirms the production endpoint and empty state, reviews the version/digest and planned record, and performs the prepared role/password steps.
- [ ] Jaco runs the reviewed migration sequence with its separate credential. Runtime service receives neither migration/admin credentials nor provider-owner credentials. No application deployment occurs here.
- [ ] Jaco reports the expected table/ledger/ownership/role checks and empty-data verification. Record actual results and any recovery as applied/failed, attributed to him.
- [ ] Record reported task-specific access cleanup and event-based access review. Carry evidence into 13, 06 and 07; unknown provider boundaries still block activation.

## Boundary

The 19 October instruction authorizes local preparation, tests and ticket updates,
not production execution. Production has no application tables according to Jaco's
prior report; repeat the private empty-state check at execution. If data now exists,
stop: this fresh path is inappropriate and does not authorize removal. Schema 3 is
the current rehearsal baseline; later migrations require staging/transactional failure verification
and a refreshed production handoff before they are applied. No launch date is set.

## Backup decision — 19 October 2026

No staging backups; production backups deferred until dogfooding is complete and
Jaco has determined application value. [Ticket 16](16-backup-restore-readiness.md)
is deferred and does not block this ticket. Transaction checks and data-preserving
failure handling remain required; no reset or deletion is authorized by this decision.

## Hosted staging execution — 19 October 2026

Jaco authorized the staging continuation and delegated the Mac-side execution to
chat 01a1512a-7e60-7483-98e8-b7c719d95485. Revision
`3349636a031d86b90c534e71e4a02d416a8f7df7` passed CI run `39172627684` and was
built on the Mac. The staging app was stopped, three separate stage roles were
created, and the nine existing tables were transferred with unchanged row counts.
An intentionally incorrect inventory was rejected and rollback/source integrity
verified before the successful transfer. The separate migration login applied
version 3; migration, admin and runtime scope verification all passed. Runtime
DDL, ledger updates and approval deletion were denied with PostgreSQL 42501.

The staging-only environment patch removed the hosted pre-deploy migration hook.
The app now has only its runtime database URL, with no bootstrap/migration/admin
URL variables. Manual deployment `fc083756-f5e7-4936-8d1c-29e9bff5641d` succeeded;
public health returned 200 with the exact revision, deployment and schema 3.
Unauthenticated focus access returned 401, Google sign-in redirected to Google,
and the existing authenticated browser session survived reload. No backups were
created, no production execution occurred, and automatic staging delivery remains
disabled (the enabling repository variable is absent).

Evidence: [sanitized execution record](../../../docs/operations/staging-transition-2026-10-19.json).
Full authenticated release acceptance remains open: two ordinary-member Google
sessions, cross-member denial, enrollment, revocation and save/reload checks.
Production setup still requires separate human authorization/execution. These
results do not close the complete provider-isolation or application-launch gate.

## Adopted simplification — 19 October 2026

Jaco approved the simplification described in the [current breakdown](../breakdown.md). Use the revised acceptance above and the [manual release procedure](../../../docs/operations/hosted-release.md). Historical execution notes remain evidence, not instructions to repeat completed work. Production execution remains separately authorized; two-member acceptance stays parked.
