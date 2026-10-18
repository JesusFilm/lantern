# Database transition and production preparation

Status, 19 October 2026: prepared and rehearsed on disposable local PostgreSQL 17
with synthetic data. No hosted change or production access has occurred. Automatic
staging delivery stays disabled; production application stays inactive. Ticket 17
tracks database readiness separately from ticket 07's later application launch.

The order is: review/merge this preparation, authorize and prove the staging
transition and recovery, then separately authorize Jaco's empty production setup.
Production findings feed ticket 13; closing the whole access gate is not a circular
prerequisite for collecting those findings. Application activation still requires
all gates in tickets 06/07. Never copy staging records into production.

## Assistance and private inputs

Follow [production operator assistance](production-operator-assistance.md). The
agent prepares the reviewed revision, explains each command and expected result,
rehearses with synthetic data, and helps interpret sanitized failures. Jaco supplies
production inputs privately and executes every production command. Stop at a failed
checkpoint; the agent prepares a correction locally before Jaco retries. Do not
paste URLs, passwords, raw SQL output, records or private inventory into chat/Git.

Build the reviewed revision with `npm ci && npm run build` using Node 22.12+.
Record its commit and script digest in the execution record. Jaco verifies the
provider project, environment, database and endpoint privately before loading:

```dotenv
LANTERN_ENV=stage
LANTERN_DB_NAME=<dedicated database>
LANTERN_DB_SCHEMA=lantern
LANTERN_DB_RUNTIME_ROLE=<environment-specific runtime role>
LANTERN_DB_MIGRATION_ROLE=<environment-specific migration role>
LANTERN_DB_ADMIN_ROLE=<environment-specific admin role>
LANTERN_DB_EXPECTED_ENDPOINT=<exact URL hostname:port>
LANTERN_DB_SOURCE_OWNER=<existing provider owner role>
```

These are placeholders, not an env file to run unchanged. Use separate private
shells or mode-600 files for each credential: `BOOTSTRAP_DATABASE_URL`,
`MIGRATION_DATABASE_URL`, `ADMIN_DATABASE_URL`, and runtime `DATABASE_URL`.
Never put privileged URLs in the application service. Endpoint/name checks detect
mistakes; they do not attest provider identity or prove agent token isolation.

## 1. Populated staging: pause, transfer, migrate, verify

Separately authorize hosted work. Privately confirm data classification, the exact
source baseline (public schema, migration ledger 1 and 2), and a restorable backup.
Stop the application and all writers/migration jobs. Keep the old release and
credential configuration available privately for investigation, not automatic
reversion to owner-powered runtime. Review other schemas, extensions, grants and
provider overrides; unknown shared objects/access require investigation first.

In the owner-only shell, set `LANTERN_DB_SETUP_MODE=legacy-stage` and run:

```sh
npm run db:bootstrap
npm run db:transition -- inspect /absolute/private/stage-inventory.json
```

Bootstrap creates three NOLOGIN roles and an empty `lantern` schema. It also
revokes database PUBLIC CREATE/TEMP and public-schema CREATE; review that impact
before execution. It aborts on existing destination/role names. The inspector
accepts the known nine-table baseline, owners, column names/order and ledger,
rejecting unexpected relations, routines, custom table grants, triggers and RLS.
It does not certify every constraint/type definition or every provider privilege.
Review the private inventory's target and nine row counts against the stopped
source. The file is created exclusively with mode 600, never overwritten.

After that checkpoint:

```sh
npm run db:transition -- apply /absolute/private/stage-inventory.json
```

The transfer locks and moves the same nine tables, including their indexes and
constraints, changes ownership to migration, and verifies unchanged row counts in
one transaction. It rejects changed counts or targets. It does not copy/reset data.
Keep the app stopped while configuring role logins as below. In a separate shell
with only the migration credential and target metadata:

```sh
npm run db:migrate
npm run db:verify -- migration
```

Then use the admin shell for `npm run db:verify -- admin`, and the runtime shell
for `npm run db:verify -- runtime`. Expect ledger 1/2/3, nine migration-owned tables
and the checked role boundaries. Review hosted PUBLIC/default ACLs and effective
credential placement too; these checks are not proof of complete provider isolation.

Remove any effective application pre-deploy migration override. `railway.json` now
omits that hook, but hosted configuration may override the repository. Prove the
separate human-invoked runner and its failure behavior before deploying the reviewed
application with only the runtime credential. Verify Google login, ordinary lead
enrollment, focus save/reload, cross-member denial, revocation and restart using
approved synthetic test accounts. Record sanitized evidence in tickets 13/14/16.
This does not authorize enabling automatic staging delivery.

### Recovery checkpoints

- Before bootstrap/transfer, have a verified backup and a restore target. Bootstrap
  and transfer are separate transactions; a later failure does not undo bootstrap.
- A confirmed transfer failure rolls back its table changes. A lost connection can
  leave commit outcome uncertain: inspect state privately before retrying.
- After a successful transfer but **before** migration 3, the owner may run
  `npm run db:transition -- reverse /absolute/private/stage-inventory.json` while
  writers remain stopped. It requires unchanged counts and ledger 1/2, restores
  table location/ownership, and leaves role/schema scaffolding and PUBLIC privilege
  restrictions in place. It is not a full privilege or release rollback.
- After migration 3, reversal refuses to run. Stop and restore the verified backup
  into a separate isolated target, rehearse the corrected transfer/migration there,
  verify data and permissions, then separately authorize any routing change. Do not
  drop the source or restore broad runtime grants to make an old app work.

The local recovery rehearsal actually dumps and restores a populated synthetic
baseline into a fresh disposable database, transfers it, migrates it and reads the
restored focus over HTTP using the restricted runtime. It proves this logical path,
not hosted backup configuration, recovery time, retention or point-in-time recovery.
Run only against the local test container:

```sh
LANTERN_TEST_POSTGRES_CONTAINER=career-lead-database-1 npm run db:rehearse:local
```

## 2. Empty production database: Jaco executes, app stays inactive

After the staging checkpoints pass, Jaco separately authorizes this database-only
operation and reviews the [planned record](production-changes.md). Repeat private
endpoint/empty-state inspection at execution; the earlier report is not proof of
current state. No deployment, enrollment or application start is part of this step.

In the private owner shell, use production-specific metadata and credentials, set
`LANTERN_ENV=production`, `LANTERN_DB_SETUP_MODE=empty`, then run:

```sh
npm run db:bootstrap
```

Expected: three distinct NOLOGIN roles and the new schema. Empty mode refuses
existing non-system relations/routines before creating roles; do not remove objects
to bypass this guard. If it fails, keep the app inactive and investigate. If the
connection is lost, inspect whether bootstrap committed before retrying.

### Private role password checkpoint

Use Jaco's trusted `psql` session to the independently checked owner endpoint.
The agent supplies the exact reviewed role names privately through placeholders;
Jaco substitutes values locally. Do not print connection strings or use passwords
in command arguments, SQL files or shell history. For each of the three configured
roles, use psql's interactive password prompt and then enable login:

```sql
\password <exact_runtime_role>
ALTER ROLE <exact_runtime_role> LOGIN;
\password <exact_migration_role>
ALTER ROLE <exact_migration_role> LOGIN;
\password <exact_admin_role>
ALTER ROLE <exact_admin_role> LOGIN;
```

Replace the angle-bracket placeholders before use; these role names must match the
reviewed metadata. This grants login only, not elevated role attributes or role
membership. Jaco constructs and stores three separate connection URLs privately
(password characters must be URL-encoded). PostgreSQL's [psql password command](https://www.postgresql.org/docs/current/app-psql.html)
avoids embedding the cleartext password in the command history/server log.
If setup stops here, leave the app inactive, track which logins were enabled and
resolve or revoke incomplete credentials before continuing. The local CLI rehearsal
uses disposable generated passwords; it cannot verify hosted credential storage.

In the separate migration shell, run `npm run db:migrate`, then:

```sh
npm run db:verify -- migration --expect-empty
```

In the separate admin and runtime shells respectively:

```sh
npm run db:verify -- admin --expect-empty
npm run db:verify -- runtime --expect-empty
```

Expected: three ledger rows (versions 1, 2, 3), nine tables owned by migration,
zero rows in all eight application tables, correct credential scope and runtime
permission checks. Verification is read-only and prints no records. The migration
transaction creates the complete application schema and explicit grants. If it
fails, leave the app inactive; inspect the ledger privately, diagnose against a
local fixture, then review the corrected runner before retrying. Do not blindly
remove roles/schema or delete newly discovered data. Backup/restore and deletion
handling must be agreed for any later operation after real data exists.

Jaco reports only sanitized pass/fail results, counts and cleanup outcome. Update
the planned record to applied/failed based on his report, attribute it to him, and
update ticket 17 plus access findings in 13. Review access, revoke/rotate exposed
credentials, close task-specific consoles and remove temporary credentials/grants;
session closure alone is not revocation. Keep the normal owner recovery account
identified as trusted access. Production application activation remains ticket 07.
