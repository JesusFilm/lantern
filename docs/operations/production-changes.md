# Production changes

No production operation is recorded as executed. The planned preparation below
has no execution date or authorization. Local synthetic tests are not production evidence.

Before each routine production administrative operation, Jaco reviews the script
and a sanitized **planned** entry, even without a PR. Preparation is not execution
authorization. Agents never access production. Retain this sanitized history for
the repository's lifetime, including archival; correct entries transparently.

Use the [operator assistance procedure](production-operator-assistance.md) to prepare and guide execution. Copy these fields for a specific authorized handoff:

- Status: planned / applied / failed
- Sanitized reason and intended environment
- Exact script version or digest and planned executor (Jaco)
- Expected effect and affected-row counts; target checks and abort conditions
- Verification and recovery plan, including backups where relevant
- Execution date and outcome (only from Jaco's sanitized report)
- Reported verification and any recovery action
- Reported console closure and removal of temporary credentials/grants
- Reported access review and any required revocation/rotation

Exclude identities, emails, person-linked IDs, conversation content, credentials,
and sensitive SQL values. Keep any necessary private supplementary record outside
Git and agent context. Do not request sensitive production output as evidence.
This is a procedural record, not an authenticated or tamper-proof audit service.

Routine work waits if a planned entry cannot be prepared. Only Jaco can invoke the
policy's emergency deferred-recording exception for active exposure, imminent data
loss or an outage that cannot reasonably wait. Complete the sanitized record,
verification and access cleanup afterward; the exception never grants agents
production access. Do not submit an organizational Changelog automatically.

## Planned: initial production database, application inactive

- Status: **planned** — preparation only; execution separately authorized after staging transition/recovery proof. Tracked by team-trial/17.
- Reason/environment: establish the complete empty Lantern production schema and separate runtime, migration and administrative privileges before application activation.
- Script version: source-bundle SHA-256 `185e56a469eb42e1efc6b04bde1a778e0cc2d50302bfb2caf480fa71e9f3001e` (algorithm and file list below). Build from the reviewed merged revision; refresh this record if scripts change.
- Planned executor: Jaco, guided checkpoint by checkpoint under [operator assistance](production-operator-assistance.md) and the [database procedure](database-transition.md). Agents have no production access.
- Intended effect: bootstrap exactly three distinct NOLOGIN roles and one dedicated schema in a transaction; privately set passwords/enable those three logins; run versioned migrations in a separate transaction. Expected final state: nine tables owned by migration, exactly three ledger rows (versions 1/2/3), zero rows in all eight application tables. No stage data copied; no enrollment or app deployment.
- Target/abort checks: independently confirm production provider/project/endpoint privately; match expected URL endpoint, database and owner; require empty mode, no existing non-system relations/routines, new role/schema names, correct migration identity. Stop on any mismatch, unexpected object/data, failed verification or uncertain commit. Bootstrap and migrations are separate transactions; password/login setup is a separate human checkpoint.
- Verification: Jaco runs migration/admin/runtime `db:verify` separately with `--expect-empty`, verifies private credential placement and effective provider privileges, and reports only sanitized pass/fail/counts. Local rehearsal does not establish production enforcement.
- Recovery: production app stays inactive throughout. For failed/uncertain setup, inspect state privately before retry; agent prepares/rehearses the diagnosis or correction. No automatic teardown, deletion or stage restore. If existing data is discovered, stop the empty path and prepare a separately reviewed backup/recovery operation. Staging's logical restore/reversal proof is a prerequisite; it is not a claim that production backups are configured.
- Execution authorization/date/outcome: **pending — not executed**.
- Reported verification/recovery action: pending Jaco's sanitized report.
- Reported console closure and removal of temporary credentials/grants: pending. Closing a session alone does not revoke access; normal owner recovery powers remain explicitly trusted.
- Reported access review and credential revocation/rotation: pending; perform before later activation and on membership/responsibility changes.

Recompute the source-bundle digest from the repository root (GNU `sha256sum`);
the outer digest includes each filename and content digest in this exact order:

```sh
sha256sum \
  package-lock.json \
  package.json \
  server/bootstrap-database.ts \
  server/database-privileges.ts \
  server/database-transition.ts \
  server/database-verification.ts \
  server/database.ts \
  server/enrollment-migration.ts \
  server/migrate.ts \
  server/operator-target.ts \
  server/schema.ts \
  server/transition-database.ts \
  server/verify-database.ts \
  tsconfig.server.json | sha256sum
```
