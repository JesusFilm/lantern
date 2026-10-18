# Hosting-only staging

This records the temporary ticket 09 hosting-only procedure; subsequent [staging activation evidence](staging-activation-evidence.md) records authentication activation. Before using this procedure with the current code, complete the separately authorized [database privilege rollout](database-privileges.md). The original app-service pre-deploy hook and provider-owner database reference are superseded: migration credentials must stay in a separate runner, and the application needs a restricted runtime URL. No hosted authentication bypass is permitted.

## Railway resources versus application configuration

Reuse Railway project `9a445065-bde0-4184-bdb8-4161b033cc8f`, environment **staging** `8e19675b-08a2-4bfb-9762-fd6d8561fcfd`. The application policy name remains **stage**. These names serve different systems and need not match.

Provision one PostgreSQL service with its own volume and one application service within that environment. Reinspect the project first to avoid duplicates. Railway CLI/API or dashboard creates these resources, allocates the generated HTTPS domain and stores secret variables. `railway.json` does not create a database or service: it still contains the original application pre-deploy migrator. That hook must be replaced as part of the separately authorized runner transition before deployment; do not install the migration credential in the app service. Verify effective hosted settings as described in the [release runbook](hosted-release.md).

Use private networking for the application's environment-specific database reference. Never point it at existing local data or a production database. Keep app GitHub autodeploy and image autoupdates disabled. Production provisioning/activation is not needed for this milestone. Use one replica and review resource consumption after startup; do not change the shared workspace budget or unrelated services.

## Application variables

| Variable | Hosting-only staging value |
| --- | --- |
| `LANTERN_ENV` | `stage` |
| `NODE_ENV` | `production` |
| `LANTERN_HOSTING_ONLY` | `1` |
| `LOCAL_ACCESS` | `0` |
| `HOST` | `0.0.0.0` |
| `PORT` | Railway-provided |
| `DATABASE_URL` | Staging's restricted runtime connection; never the provider-owner connection |
| `APP_ORIGIN` | Allocated Railway HTTPS origin, no trailing slash |
| Google client ID/secret | Absent; this mode rejects configured credentials |

The mode is rejected in production, local or unspecified environment identity. Default startup behavior remains unchanged: normal hosted startup requires both provider credentials. Missing/invalid configuration cannot silently enter hosting-only mode.

While enabled, the public page says **Sign-in is awaiting configuration**. Login cannot begin or complete, existing sessions are not recognized, and protected reads/writes remain denied. No approval data, member sessions or synthetic participant enrollment is needed. Existing records/sessions are not deleted; leaving hosting-only mode restores normal approval/session evaluation.

## Initial deployment and hosting checks

The original task prohibits pushing/merging this branch. These changes must first be reviewed and merged through the normal process. Do not deploy the unmerged branch and describe it as a verified main release. Select the resulting merged SHA and its successful three-check main CI run; use a clean detached checkout of that SHA for stamping/upload.

Keep repository-level `STAGE_DELIVERY_ENABLED` **unset/false**. Its existing automatic job requires authenticated QA sessions, which this milestone intentionally does not have. No workflow or authenticated gate has been weakened.

With stage's exact service/environment IDs and scoped token privately injected, use the runbook's `tools/release/stamp.mjs` and `tools/release/deploy.mjs` operator path. Migration and Railway readiness must succeed and the deployment receipt must identify the staging targets. Supply that receipt's deployment ID to the hosting check, together with the same full SHA and origin:

```sh
# RELEASE_TARGET=stage, RELEASE_SHA, EXPECTED_DEPLOYMENT_ID and APP_ORIGIN injected.
node tools/release/hosting-smoke.mjs
```

Run from the built/test-tool checkout with Playwright Chromium installed. The check requires HTTPS and matching revision/deployment headers, checks the database/schema readiness, unavailable login, anonymous protected-route denial and rendered browser page, then rechecks revision/deployment/schema. A routing mismatch fails; retry after routing has settled without changing the expected receipt. Never accept another deployment just because it serves the same code.

Success writes only `hosting-evidence.json`, containing `hosting: passed` and `authenticatedSmoke: pending`. It does not contain `stage: passed`, does not create `stage-evidence-SHA`, and cannot satisfy the production promotion gate. Failure removes stale hosting evidence and exits nonzero. Do not run the authenticated smoke expecting an acceptable failure: it remains pending until real login/member sessions are available.

Record the hosted URL, full deployed SHA, Railway deployment ID, schema version, CI run and hosting result. Verify a staging restart retains schema/readiness. Local tests are preparation, not evidence that these Railway actions occurred.

## Exit from temporary mode

After the provider decision and implementation, configure the reviewed authentication, remove `LANTERN_HOSTING_ONLY=1`, and complete real login and participant enrollment. Acquire two ordinary-member sessions privately. Keep unattended delivery disabled until the database-role/runner transition and all remaining gates pass and Jaco separately authorizes activation; then obtain new authenticated stage evidence for the chosen merged SHA. Production promotion and practical lead/confirmation acceptance remain separate gates.
