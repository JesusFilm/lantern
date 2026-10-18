Kind: ticket
ID: team-trial/16
Title: Establish backup policy and rehearse recovery
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 05, 13, 14
Implementation: Local synthetic transaction reversal and pg_dump/pg_restore rehearsal completed; hosted backups and full recovery acceptance outstanding
Slice: Hosted team trial

---
## Outcome

Demonstrate recovery before production personnel data is collected, with privileges and configuration matching the approved operational design.

## Acceptance

- [ ] Choose recovery owner, RPO/RTO, actual provider-supported backup schedule/retention, encryption, protected storage, access and cost approval. A suggested policy is not a configured backup.
- [ ] Configure and verify the approved backup mechanism under separately authorized execution. Use a scoped backup/recovery identity consistent with 13; protect dump contents and audit recovery access.
- [ ] Back up synthetic authenticated stage records and restore into a new empty isolated target, never over stage, production or existing local data. Verify membership and saved focus content using normal authenticated application behavior; use the final candidate schema for release acceptance.
- [ ] Record backup identifier, source SHA/schema, restoration duration, observed recovery gap, verification results and target retention/disposal decision. Do not put dumps, tokens or personal data in Git or public CI artifacts.
- [ ] Rehearse schema-compatible application rollback and document migration recovery separately. Test logical restore versus provider volume/PITR claims separately; neither substitutes for the other.
- [ ] Specify first-release handling when production is empty and pre-release backups for later releases where data exists. Carry the resulting evidence into 06/07; changed migration/recovery assumptions require revalidation.

## Local rehearsal — 19 October 2026

The [transition procedure](../../../docs/operations/database-transition.md) includes
transaction rollback, reversal before migration, and an actual synthetic PostgreSQL
17 dump/restore into a new isolated database followed by role transfer, migration and
restricted-runtime HTTP read. This proves the local logical path only. It does not
configure backup retention, prove provider snapshots/PITR, meet an RPO/RTO, or replace
the authenticated stage/hosted rehearsal. Ticket 17 must consume applicable recovery
proof before human production database preparation; ticket 07 still requires full
release recovery acceptance before collecting personnel data.

## Boundary

Local synthetic recovery preparation was authorized on 19 October. Hosted recovery remains separately authorized work. No hosted backup purchase, permission change, database restore, destructive cleanup or production activation occurs in this preparation session. Local disposable synthetic dump/restore is the rehearsal described above.
