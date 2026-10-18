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
- [ ] Obtain passing staging transition/configuration and transactional failure evidence for the intended scripts/schema. Record the checked revision and resolve any remaining provider-specific runner/access prerequisites.
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
