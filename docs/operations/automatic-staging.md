# Automatic staging delivery

Jaco authorized this scope on 19 October 2026 after PR #13: successful merged-main
checks should deliver to staging and apply required migrations. Production remains
inactive, human-run and unavailable to agents. The earlier manual-stage decision
is superseded; automatic production promotion is still deferred.

## Execution

1. CI tests/typecheck/build the exact main revision.
2. A serialized stage job checks the existing application configuration.
3. A separate one-shot Railway service runs that same revision's
   `node dist/server/stage-migration.js` on the private staging network. It has only
   the staging migration connection, never runtime/admin/owner connections. Its
   restart policy is NEVER; no domain, healthcheck, source autodeploy or cron.
   Uploads use a temporary archive of the exact commit, with application Railway
   configuration removed and the revision stamped. The service configuration
   controls the migration command; no custom configuration-file path is needed.
4. The delivery job requires the runner's exact-deployment completion log marker
   for that revision before uploading the application. Readiness alone is insufficient.
5. The application retains only its runtime connection. Smoke checks exact SHA,
   deployment, schema 4, login rendering and anonymous denial. The artifact is
   `stage-readiness-SHA`, explicitly not authenticated or production-promotion evidence.

GitHub stage needs the existing environment-scoped RAILWAY_TOKEN and
RAILWAY_MIGRATION_SERVICE variable, alongside the existing app target variables.
The migration database secret stays in the private migration service, outside both
the application and GitHub. Its required nonsecret settings are LANTERN_ENV=stage,
LANTERN_DB_NAME, LANTERN_DB_SCHEMA=lantern, LANTERN_DB_EXPECTED_ENDPOINT, and the
three lantern_stage_* role names. Use the verified private endpoint. No public
PostgreSQL proxy is part of this plan.

Only enable repository STAGE_DELIVERY_ENABLED after target/credential/connectivity
verification. Stop on missing credentials, mismatched target, failed migration,
missing marker or failed readiness. Preserve data and report the failed run; never
reset the schema. Schema changes must be compatible with the currently serving
application; incompatible future changes require a separately planned transition.
Once any focus is confirmed, older pre-confirmation application code is not a valid
rollback target. Serialize all manual staging releases with the automatic job.

## Provisioning status — 19 October 2026

The staging-only migration service is `bc266967-1574-4770-a960-4e6fe1668cb0`.
The stage environment has a source-environment relationship; the live API's
service-create contract scopes creation to that fork. Creation and configuration
used the staging-scoped token and explicit staging environment ID.

Migration-only credentials were privately installed in the service, using
`postgres.railway.internal:5432`, database `railway`, and role
`lantern_stage_migration`. The endpoint guard matches that private endpoint.
Application credentials were not changed. Host-specific private file locations
are recorded in the VM operational runbook. No public endpoint was created.

Hosted migration completed and its exact-revision marker was verified on
19 October: revision `c37a776`, deployment `f0b34b34-5a70-4ee5-b52a-9ad82ced8244`.
This verifies private connectivity and dedicated migration credentials. Earlier
rehearsals also completed but exposed a CLI receipt-shape mismatch, now fixed by
validating detached deployment IDs against provider service/environment metadata.
CI pins the rehearsed Railway CLI version 5.70.0. Delivery activation follows green
PR checks and merge; authenticated two-account acceptance remains pending.

## Two-member isolation using the existing lead

Use two current normal Google sessions, privately supplied; no minted sessions or
OAuth-client-secret substitution. The first must be the current lead, the second a
different ordinary member of the same department. Use synthetic content only.

Run the reviewed `tools/release/stage-isolation.mjs` with private staging admin env,
QA_MEMBER_A_SESSION, QA_MEMBER_B_SESSION, exact release/deployment metadata, and
STAGE_ROLE_RECOVERY_FILE pointing outside Git to a private absolute file path.
It validates the target/admin role and sessions, writes an exclusive mode-600
recovery marker, changes exactly the lead's active membership to member, checks
both directions of owner read/reload and other-member read/write denial, then
restores the lead in a finally block. It writes sanitized evidence only after
successful testing and restoration. Synthetic test drafts are retained.

On interruption or failure, run the same script with `--restore` using the private
admin environment and recovery-file path. That action does not require browser
sessions. It restores only the saved active membership; an unexpected state stops
for inspection. Do not overwrite or delete the recovery marker until restoration
is verified. Access changes need no logout because membership is server-resolved.
No production role changes or production data are authorized.
