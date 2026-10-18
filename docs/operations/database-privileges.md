# Database privilege separation

Status: implemented and tested locally with synthetic data, 2026-10-19. No hosted
switch has been executed. Production remains inactive; automatic staging delivery
remains disabled. This covers the database-role slice of team-trial/13, not the
whole production-access gate.

## Roles and boundaries

| Connection | Scope | Credential available to |
| --- | --- | --- |
| Runtime | Read application tables; register/update Google profiles; persist sessions, login attempts and focuses; execute constrained enrollment | Application process only |
| Migration | Own application schema, tables and enrollment function; versioned DDL and explicit grants | Separate human-invoked migration process |
| Admin | Read application tables and change application data; no DDL, role management or migration-ledger writes | Human operator process |
| Provider owner (`postgres`) | Bootstrap, recovery and provider administration | Jaco; never agent production access |

These roles are distinct, have no role memberships and lack superuser, CREATEDB,
CREATEROLE, REPLICATION and BYPASSRLS. Bootstrap creates them **NOLOGIN**. It does
not generate, print or store passwords. A human enables login and supplies each
credential privately; local tests use disposable generated passwords.

Migration 3 installs `enroll_member(uuid,text,boolean)`. Its fixed search path puts
`pg_catalog` first and `pg_temp` last. PUBLIC cannot execute it. It checks active
lead membership, the registered target's approval/domain, and existing membership,
then inserts only an ordinary member into that lead's department. The shared
transaction lock serializes enrollment with administrative membership changes.
It cannot grant a lead role, transfer a person, or reactivate former membership.
The existing lead UI remains available, as agreed on 2026-10-19.

Runtime has no direct writes to approval, domain, department or membership tables,
no migration-ledger writes, and no ownership or CREATE/TEMP privileges in the
application database. It cannot update a user's stable Google subject or ID, or a
focus's owner/department. Grants use an explicit object/column allowlist, repeated
inside the migration transaction; future objects are not automatically exposed.
PUBLIC table/function grants are removed in the application schema. The migration
role's global default function EXECUTE grant to PUBLIC is also revoked: a
schema-only default revoke would not remove PostgreSQL's global default.

Startup only checks readiness and permissions, even locally. It rejects owner,
superuser, administrative and inherited-role configurations. It never migrates or
creates a local account. `LOCAL_ACCESS=1` reads an already-prepared synthetic
account; `access:ops -- local-account` prepares it using the admin credential and
requires `LANTERN_ENV=local` plus a loopback database host.

## Local commands and credential placement

Use Node 22.12+ and build first. Preserve existing databases and private env files.
For a fresh local instance, use a **dedicated disposable database**, with a trusted
local owner connection. Do not point bootstrap at a shared database: it revokes
PUBLIC CREATE/TEMP on that database and CREATE on its public schema.

Bootstrap, migration and admin processes require these explicit target settings:

```dotenv
LANTERN_ENV=local
LANTERN_DB_SETUP_MODE=empty
LANTERN_DB_EXPECTED_ENDPOINT=127.0.0.1:55439
LANTERN_DB_SOURCE_OWNER=career_lead
LANTERN_DB_NAME=lantern_local
LANTERN_DB_SCHEMA=lantern
LANTERN_DB_RUNTIME_ROLE=lantern_local_runtime
LANTERN_DB_MIGRATION_ROLE=lantern_local_migration
LANTERN_DB_ADMIN_ROLE=lantern_local_admin
```

Use environment-specific role names. The migration/admin commands check actual
database, schema, current/session role, elevated attributes and role membership
before work. Bootstrap, migration and verification also require the URL host/port
to match `LANTERN_DB_EXPECTED_ENDPOINT`. A matching name is not provider/project attestation: independently
verify the connection endpoint and environment before supplying a credential.

1. Create the dedicated database using the local owner, then supply
   `BOOTSTRAP_DATABASE_URL` and the target settings to
   `node dist/server/bootstrap-database.js` (`npm run db:bootstrap`). Bootstrap
   checks the database name, creates exactly three roles and one new schema in a
   transaction, and aborts on existing role/schema names. It never adopts objects.
2. Privately configure separate login passwords for those NOLOGIN roles. Keep the
   owner credential outside application env files. Database-specific role settings
   select the application schema; do not override search_path with `public`.
3. Put only `MIGRATION_DATABASE_URL` and the target settings in `.env.migration`,
   then run `npm run db:migrate:local`. With injected variables, use
   `npm run db:migrate`. Migrations and grants commit or roll back together.
4. Put `ADMIN_DATABASE_URL`, the target settings and `LANTERN_ENV=local` in
   `.env.admin`. Run `npm run access:ops -- local-account` for the walkthrough, or
   use the existing domain/email/setup commands for synthetic Google-flow tests.
   Operators no longer auto-run migrations. The compiled entry point is
   `npm run access:ops:compiled` with injected variables.
5. Configure `.env` with **only the runtime DATABASE_URL** and normal application
   settings, then run `npm run dev:local` or `npm run dev`. Never install the
   bootstrap, migration or admin URLs in the application service, container,
   shell environment, or application-mounted files.

The checked-in `.env.example` connection is a local owner credential for the
existing Compose/test fixture, **not a runtime-ready connection**. Replace that
URL in your private `.env` with the provisioned runtime connection before starting
this version. No existing private env file is rewritten by this change.

`npm run test:local` explicitly uses that loopback example fixture. `npm test`
continues to accept an injected test-owner DATABASE_URL (as CI does). Tests require
an isolated synthetic PostgreSQL owner able to create/drop databases and roles;
never use runtime credentials or a hosted database. Privilege fixtures refuse
non-loopback URLs, create unique databases/roles, and clean them up. Ordinary
regressions still use isolated schemas; key HTTP/browser tests now use the real
restricted runtime role. Build before the compiled-package tests.

## Operator support

For any eventual production work, follow the required [operator assistance procedure](production-operator-assistance.md). The agent prepares and rehearses the executable work, guides the human step by step, and assists with verification and recovery from sanitized feedback. The human execution boundary is not a transfer of SQL design or troubleshooting responsibility to Jaco.

## Eventual staging handoff — unexecuted

The executable [database transition procedure](database-transition.md) now covers
the locally rehearsed populated-stage transfer and empty-production setup. Follow
its ordered checkpoints; hosted execution remains separately authorized.

Jaco reported on 2026-10-19 that staging runtime uses the Postgres service URL with
username `postgres`, and that staging/production inspected connections have all
four reported elevated attributes. He reported no production application tables.
These are attributed manual findings, not agent inspection. Nothing here proves
Railway token scope, production isolation, or hosted role enforcement.

For a separately authorized staging switch:

1. Keep delivery disabled. Confirm synthetic-only data, identify the exact service,
   database and schema, and retain the old release. No staging backup is authorized
   under the 19 October decision; follow the transition runbook’s failure plan. Review
   existing ownership, PUBLIC ACLs, role memberships/default grants, extensions,
   security-definer functions and other schemas. Stop if unknown grants or objects
   make the database an unsuitable isolation boundary; a fresh dedicated database
   is the simplest alternative.
2. Create the separate roles/schema with the bootstrap process only after reviewing
   its database-wide PUBLIC changes. Existing public-schema tables are **not**
   adopted by bootstrap. Use the prepared and locally rehearsed ownership/schema transfer
   of the complete existing baseline (including ledger, indexes and constraints),
   rather than copying it into a fresh database.
   Verify source/destination row counts and ownership before changing runtime.
   This transfer is an explicit separate command and an unexecuted hosted-rollout
   step; bootstrap never silently attempts it. Do not lose existing membership/history or rerun
   baseline creation into an empty schema and call it a data migration.
3. Run the versioned migrator with its separate credential, absent from the runtime
   service. Verify three ledger versions, object owners, explicit grants and denied
   operations using the staging roles. Install only the runtime URL in the app.
   Execute normal login, lead enrollment, focus save/reload, cross-member denial,
   revocation and restart checks with synthetic accounts.
4. On any failed check, stop the application and keep delivery off. Inspect the committed state and prepare a rehearsed forward correction; there
   is no backup-based recovery path during the current deferral.
   Returning runtime to superuser access is a security regression, not a successful
   recovery. A rollback to pre-v3 code still needs constrained enrollment support;
   do not restore broad membership writes just to make old code start.
5. Review access on enrollment, departure or responsibility changes; revoke/rotate
   exposed credentials. Close task-specific consoles and remove temporary grants
   and credentials. Record sanitized results and the reported cleanup. Production
   inspection, releases, migrations and corrections remain Jaco-only and require
   separate authorization and all activation gates.

## Limits and remaining production work

Runtime still has broad access to application data and session storage. A
compromised runtime can read all focuses, forge sessions, modify allowed profile
fields, and invoke constrained enrollment with a known lead ID. The database
cannot attest Google identity or the HTTP actor. Member isolation is enforced by
the server and regression-tested; this is **not** row-level security or protection
against a compromised application credential. The function prevents promotion,
transfers and reactivation even for such a caller, but does not make runtime a
trusted human identity. Migration owners and data administrators remain trusted.

The provider owner retains full recovery powers. Administrative DML permissions
are broad enough for correction/removal work; they are not a database-enforced
approved-script allowlist or tamper-proof audit mechanism. Startup checks detect
common dangerous configurations, not every possible malicious function/ACL change
by a trusted owner. Hosted evidence and credential placement must still be reviewed.

Existing operator commands now use the admin scope and target checks, but are not
a complete production correction/removal framework. Per-operation expected row
counts, verified failure handling under the current backup deferral, and the complete ticket-13 human
handoff remain prerequisites for routine production use. No production operation
is scheduled by this document. Prepare a sanitized `planned` record in
[production-changes.md](production-changes.md) **before** preparing a specific
production execution; update it only from Jaco's sanitized report afterward.

## Local verification evidence

The transition preparation adds CLI checks, transactional transfer/reversal and
real local dump/restore rehearsal; see [the transition procedure](database-transition.md).
The evidence below records the earlier merged privilege slice.

On 2026-10-19, Node 24.21.0 / PostgreSQL 17 synthetic local verification passed:
92 tests, zero failures/skips; client and server TypeScript checks; production
TypeScript/Vite build; clean diff whitespace check. Tests include real restricted
role connections, browser/HTTP member isolation, command credential/target guards,
forbidden DDL/admin writes, repeat/concurrent migrations, unsafe-role rollback,
column-grant cleanup and default function privacy. Disposable test databases and
roles were removed, including a fixture left by an early failing startup test.
No Railway call, hosted mutation, deployment, delivery-switch change, production
access or credential installation occurred.
