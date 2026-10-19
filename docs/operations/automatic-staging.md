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
   Set its Railway config path to `/railway.migration.json` so the application
   config cannot override its command or restart policy.
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

## Current provisioning gap

The VM staging token works. The Mac helper verified the separate migration/admin
files and working noninteractive SSH authentication on 19 October. Migration
credentials were privately transferred to the VM with owner-only permissions;
they still target the closed loopback tunnel, and database validity is untested.
Admin credentials remain on the Mac. Host-specific locations and connection
setup belong in the VM operational runbook, outside this repository.
No runner has been provisioned, migration applied, delivery enabled or
authenticated test executed by this preparation alone.

Railway's service-create API describes new non-fork services as appearing across
project environments. Agents must not create an unintended production instance.
Resolve creation scope with the operator before provisioning the staging runner.

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
