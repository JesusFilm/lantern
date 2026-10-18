# Deployment configuration preflight

The release command now reads the selected Railway environment before uploading.
A missing healthcheck, a restored pre-deploy migration command, a mismatched target,
a connected source/trigger, or an owner-powered database URL blocks delivery.
It never repairs drift or deploys from the standalone check.

## Operator inputs

Set these non-secret GitHub **environment** variables for stage and, when separately
prepared by Jaco, production: `RAILWAY_PROJECT`, `RAILWAY_ENVIRONMENT`,
`RAILWAY_SERVICE`, `LANTERN_DB_RUNTIME_ROLE`, and `APP_ORIGIN`. Keep the existing
`RAILWAY_TOKEN` secret environment-scoped. Never use an account/workspace API token.
`RELEASE_TARGET` is supplied by the workflow (`stage` or `production`). Role names
must follow `lantern_<environment-name>_runtime`; they must match the reviewed,
verified runtime credential. No credential values belong in these variables.

Stage's project/environment/service IDs remain the existing recorded resources;
its runtime role is `lantern_stage_runtime`. Production values are prepared by the
human operator; this change does not inspect or configure production. Missing
inputs fail closed. Do not enable `STAGE_DELIVERY_ENABLED` to test configuration.

Run with the selected environment's project token and these inputs injected:

```sh
node tools/release/configuration.mjs
```

The standalone command is read-only. It checks:

- Project, environment name/ID, service ID and complete source-trigger inventory.
- Root Dockerfile discovery (Railpack's automatic Dockerfile detection or explicit
  Dockerfile builder), no custom build command/root or configuration-file override.
- Start command `node dist/server/index.js`; no pre-deploy command or cron schedule.
- `/health`, 120-second health timeout, ON_FAILURE with three retries.
- No connected repository/image or matching independent deployment trigger.
- Explicit hosted environment, Google sign-in configured, local bypass off,
  expected HTTPS origin, and a private-network database URL with the expected
  runtime username. No bootstrap/migration/admin URL may be on the app service.

Provider JSON and variable values stay inside captured child-process output.
Errors do not print raw responses or variable values. A sealed/unreadable required
variable blocks verification; do not unseal it merely to make this gate pass.

This verifies configuration at a point in time, not PostgreSQL grants, token scope,
all possible provider overrides, or immutable state during upload. Keep the
separate database scope checks and exact-revision/deployment health smoke. The
checker cannot establish that a correctly named role actually has safe grants.
The deployed image/build receipt remains authoritative for which build ran.

## Configuration ownership and IaC adoption

Railway's [Config as Code documentation](https://docs.railway.com/config-as-code)
now deprecates `railway.json`/`railway.toml`: new services cannot opt in, and existing
users have a 1 December 2026 cutoff. The checked-in file is therefore not proof
that hosted settings match. This service currently uses hosted settings; the
preflight contract is the repository's reviewed release requirement.

[Railway IaC](https://docs.railway.com/infrastructure-as-code) is the intended
configuration-management path. Use its import with variable preservation, then
`railway config plan --detailed-exit-code` to review drift. Do not use
`--include-variables` or `--show-values`: those expose non-sealed secrets. Prefer a
named app-service partial; a whole-project apply can delete omitted resources.
Even an unchanged first partial apply claims ownership, so this PR does not
silently adopt infrastructure or add an automatic apply workflow.

Ticket 14 remains open for a reviewed IaC import/plan, ownership adoption and
production preparation. Until that work is reviewed, an operator repairs hosted
drift through the targeted environment and reruns this gate; the app's separate
migration runner and scoped credentials remain required. Never restore the old
owner-powered runtime or pre-deploy migration hook to satisfy a failed check.

## Verification — 19 October 2026

The regression first demonstrated that the old release command uploaded despite
a missing hosted healthcheck. CLI-boundary tests now reject missing/changed
settings, mismatched targets, independent triggers, provider errors, privileged
URLs and missing inputs before any upload, without leaking fixture secrets.
The passing case still requires an explicit project/environment/service upload.

The standalone checker passed against the existing staging environment using its
scoped token and the installed Railway CLI (reported version 5.63.1), then again
with the workflow-pinned CLI 5.68.0. This was a
read-only check: no configuration mutation, upload, migration, database access,
production access, credential creation or automatic delivery activation occurred.
The workflows retain their existing CLI pin (5.68.0). The two new non-secret
GitHub stage variables were configured; production variables were not accessed.
Promotion also runs the checker from protected main, so selecting an older
candidate cannot omit the preflight.
