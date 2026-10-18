Kind: ticket
ID: team-trial/16
Title: Reconsider production backups after dogfooding establishes value
Milestone: M06
Type: task
Status: deferred
Blocked by: Dogfooding completed and application value determined by Jaco
Implementation: Deferred by explicit decision on 19 October 2026; no staging backups and no production backups at this point
Slice: Hosted team trial

---
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

## Future acceptance — not a dogfooding prerequisite

- [ ] After dogfooding and the value decision, ask Jaco whether to proceed with production backups.
- [ ] If authorized, propose production recovery ownership, RPO/RTO, storage/access, retention and costs; record the approved policy.
- [ ] Prepare and rehearse the approved production backup/restore procedure with synthetic local data. Jaco executes production operations and reports sanitized verification under operator assistance.
- [ ] Record actual backup configuration and restore evidence, including deletion handling and retention. Do not infer activation from this ticket or its future trigger.

## Historical evidence

Local disposable PostgreSQL 17 transaction reversal and logical dump/restore were
rehearsed before this decision. On 19 October the staging API reported no volume
backups and PITR disabled; no snapshot was created. Jaco reported the staging
schema-2 preflight passed (nine public tables, destination schema absent). Production
backup configuration was not inspected by agents. This change authorizes no deletion
of an existing backup, production access, deployment or data reset.
