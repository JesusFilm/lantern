# Hosted runtime and release runbook

Prepared 15 October 2026 for team-trial/04. This is repository implementation, not evidence of live configuration. Ticket 05 owns provisioning, secrets, repository rules and real Google setup. Never deploy this baseline to participants before approved-access is integrated.

## Runtime contract

Use Node 24.21.0 (the Dockerfile and CI use this version). `npm ci && npm run build` compiles server, operator CLI and migration CLI and builds React. A runtime package needs only `dist/`, package manifests and `npm ci --omit=dev --ignore-scripts`. No `.env`, `tsx`, Vite or TypeScript is loaded in production. The Dockerfile builds in one stage and installs only production dependencies in the final non-root image. CI additionally starts an isolated production-only package, exercising the actual compiled CLI.

| Variable | Contract |
| --- | --- |
| `LANTERN_ENV` | `local`, `stage`, `production`; omitted resolves to restrictive `production` identity; invalid values abort. Authentication consumes `resolveRuntime().environment` from `server/runtime.ts`. |
| `NODE_ENV` | `production` in both hosted environments; explicitly selecting stage/production without it aborts. |
| `DATABASE_URL` | Environment-specific PostgreSQL connection string; private Railway reference when hosted. Never put it in browser variables. |
| `HOST`, `PORT` | Hosted default host is `0.0.0.0`; Railway supplies PORT. Local defaults: `127.0.0.1:4391`. |
| `APP_ORIGIN` | Explicit canonical HTTPS origin when hosted; HTTP loopback allowed locally. No path/trailing slash. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Both required when hosted. Configure separate local/stage/production OAuth clients and exact `/auth/google/callback` URLs during ticket 05. Local walkthrough may omit them. |
| `LOCAL_ACCESS` | Separate opt-in `1`, default off; only loopback/non-production. Stage and production set `0`. |

Omitting `LANTERN_ENV` retains local command compatibility but never opts into personal-account admission. It does not infer stage from NODE_ENV. Startup passes the resolved server-owned identity into the approved-access policy. Do not derive identity from a request or expose environment switching in the client.

Local commands remain `npm run dev`, `npm run dev:local`, `npm run access:ops`. Set `LANTERN_ENV=local` in local `.env`. `npm start` now uses injected variables; `npm run start:local` optionally loads `.env`. Tests optionally load `.env`, but CI needs none. Build before running tests because compiled-runtime tests exercise `dist`.

## Migrations and backend operations

From a built release with the target DATABASE_URL injected:

```sh
npm run db:migrate
npm run access:ops:compiled -- domains example.test
npm run access:ops:compiled -- setup Engineering lead@example.test
npm run access:ops:compiled -- remove-member USER_UUID
npm start
```

The example identities are placeholders. Verify the target environment privately before every operator mutation. Do not supply credentials on command lines or save participant emails in source/artifacts. `domains` replaces the domain list; review its full intended value first. Compiled operator commands require an already migrated schema. The existing local `access:ops` command runs its explicit `preaccess:ops` migration hook; local development still migrates before serving.

Hosted startup never runs DDL. Railway pre-deploy runs the compiled migrator before routing a new revision. Migration 1 adopts the existing additive schema without resets. Migration 2 adds the empty approved-email list and permits a missing hosted domain for personal accounts; readiness requires both migrations and reports schema version 2. Approve intended emails before allowing sign-in; no legacy account is automatically approved. The schema ledger and changes commit atomically under a PostgreSQL transaction advisory lock scoped to database/schema. Multiple runners serialize; blocked/failed SQL times out and fails the release (current pool statement timeout 3 seconds). Increase that bounded timeout deliberately if a reviewed future migration needs longer; never silently retry destructive work. `/health` checks the ledger and application relations in hosted mode and returns sanitized availability only; revision, deployment ID and schema version headers contain no personnel data.

Integration seam for subsequent migrations: add numbered migrations **after** version 1 under the same connection/transaction/lock, each guarded by its own ledger entry. Never append new DDL inside migration 1: existing installations have already applied it. Advance readiness's required version and the health schema-version header together. Add upgrade tests preserving users, memberships, drafts and confirmed baselines. Prefer expand → migrate → compatible app → later contract. Both old and new app may run during rollout; do not drop/rename columns the old app still uses. Failed migration must leave old traffic serving and no partial ledger entry. Rehearse the compatible old-app rollback before release.

## GitHub and Railway setup (ticket 05; not performed here)

Create separate Railway stage and production app/PostgreSQL services, volumes, variables, domains, OAuth clients and approval data. No production data copies. Configure the app from `railway.json` and Dockerfile; verify the dashboard has not overridden pre-deploy/readiness behavior. Disable GitHub autodeploy for **both** services and disable image automatic updates. Do not rely on Railway's independent “wait for CI” setting, or use “Deploy Latest Commit”. Only the workflows below have deployment tokens. Restrict manual Railway deployment permissions to release operators.

Create GitHub `stage` and `production` environments, restricted to protected main. Production uses an explicit operator-triggered promotion, with no separate reviewer or no-self-review requirement (operator decision, 15 October 2026). Keep administrator bypass disabled for the configured branch restriction. Keep production secrets unavailable to PR workflows. Protect workflow files through review/CODEOWNERS/repository rules appropriate to the organization.

Each GitHub environment requires these variables: `APP_ORIGIN`, `RAILWAY_SERVICE` (service ID), `RAILWAY_ENVIRONMENT` (environment ID). Each requires `RAILWAY_TOKEN`, a **separate environment-scoped Railway project token**. Stage also requires `QA_MEMBER_A_SESSION` and `QA_MEMBER_B_SESSION`: cookie values from two distinct approved **ordinary members**, obtained by a human through real Google sign-in in stage. Keep them in environment secrets, never screenshots/artifacts/logs. Sessions expire/revoke normally; refresh by normal login and rerun CI when necessary. No session-minting command or login bypass is added. Provisioning and enrollment are later work.

Require these exact checks on PRs targeting main, select GitHub Actions as the expected source, require up-to-date branches, prevent direct pushes and unauthorized bypass:

- `typecheck`
- `PostgreSQL HTTP and browser tests`
- `production build`

No path filters skip required checks. The same checks rerun on the actual merged main SHA. If enabling a merge queue later, add and verify `merge_group` checks first. `stage delivery and smoke` is a push-only downstream job, not a required PR check.

## Automatic stage delivery

For the first deployment, follow the explicit [operator bootstrap and real-login session acquisition sequence](railway-google-setup-evidence.md#first-stage-bootstrap-before-enabling-unattended-delivery). A manual stage bootstrap is needed before members can obtain real Google sessions; it does not count as passing automated stage evidence and must leave the repository delivery switch off until prerequisites pass.

Stage delivery is temporarily **off by default** pending ticket 05. The job runs only when the **repository-level** Actions variable `STAGE_DELIVERY_ENABLED` is exactly `true`; unset/false skips it before any setup or upload steps. PR/main quality checks continue normally and can finish green while stage is disabled. Do not put this switch in the `stage` environment: environment variables are unavailable when GitHub evaluates this job condition.

Ticket 05 must configure and verify the stage resources, target settings/token, Google authentication, two QA session secrets and CI protections before setting the switch to `true`. Then rerun a successful main push workflow for the intended SHA or use the next reviewed merge and verify deployment/readiness/smoke evidence. Set it back to `false` if activation fails. This switch does not enable production delivery.

`.github/workflows/ci.yml` runs three checks; stage depends on all three. Failure, cancellation, skip or absence cannot reach deployment. An additional gate validates all results, event, branch and checkout SHA. Stage checks out `github.sha`, never a moving branch, and stamps `release.json` from that SHA. This generated file is intentionally included in Railway's source upload; do not commit it. The pinned Railway CLI uploads that source, with the commit as deployment message. Main moving cannot change it. Docker builds from the uploaded source and locked npm graph. This is exact-source promotion, not a promise of identical image digests; base tags can change, so record Railway image digest when available and review dependency/base updates.

Railway pre-deploy migration and configured healthcheck must succeed. The pinned CLI's JSON terminal receipt must report success and match both configured target IDs. Build/deploy logs are captured without printing or uploading them. The smoke runner then waits for `/health` with the exact baked SHA **and that receipt's deployment ID**, so a previous deployment of the same SHA cannot stand in for the new upload. It verifies anonymous data denial, rendered login UI, two normal member sessions, synthetic draft creation/read/reload and other-member detail denial. It checks revision/deployment again at the end. A different deployment during checks fails evidence creation. The stage concurrency group prevents overlapping workflow deployments; GitHub does not promise queue order, so an older checked SHA may become stage's current revision. Always identify by SHA and deployment, never assume “latest”.

Only successful smoke writes `stage-evidence-SHA`, with SHA, deployment ID, schema version and GitHub run ID, retained 90 days. No raw responses, session state, browser traces or screenshots are uploaded. Synthetic drafts use `QA release <sha> run <id>` titles and fixed dates with no personal content. There is no product delete API: retain these in the dedicated QA accounts, or remove them only through a separately reviewed, parameterized stage-only cleanup procedure after evidence retention. Never reset a shared schema to clean QA data.

Automated smoke does not complete real Google login or replace newcomer/lead confirmation acceptance. Ticket 06 records real login/cancel/retry, approval revocation, guide-assisted newcomer authoring, lead browsing/confirmation, two-member isolation, lock persistence and production readiness against the exact SHA. Feature-specific acceptance awaits the relevant tickets.

## Manual promotion

Run `Promote verified revision` from protected main with a full SHA, successful main CI run ID and HTTPS acceptance-record URL. The operator starting the workflow must inspect that record **before clicking Run workflow**. Any repository user already authorized to run this workflow may promote; public repository visibility does not grant deployment rights. It must identify the exact SHA and stage deployment, successful CI/smoke, practical QA results, required migrations/schema version, previous production deployment, schema compatibility, backup ID/retention and successful isolated restore rehearsal. A bare URL is not human acceptance; the initiating operator owns the practical QA decision. There is no second-person approval step.

The workflow verifies the run through GitHub's API: repository, workflow path, push event, main branch, completed success and exact SHA. It downloads that run's named stage artifact and checks SHA, run ID and passing stage result. Missing/expired artifact, cancelled/failed run, or different SHA prevents deployment. It then checks out the candidate SHA in a separate directory and uploads that source to **production's** target using production's token. No merge event can trigger this workflow. Code changes require new CI/stage/QA evidence.

After migration/readiness, production automation checks the exact revision, public login and anonymous data denial. An artifact records the production deployment, schema, operator, stage run and acceptance record. Human production smoke must then verify real Google login, intended membership and a synthetic focus persistence/confirmation workflow; append that result to the release record. Failure is an incident requiring the release operator; the workflow never resets data or automatically rolls back schema.

## Backup, restore and rollback

Before production data collection, choose and record recovery owner, RPO/RTO, backup schedule and retention supported by the actual Railway plan. Suggested trial policy for approval: daily backups retained at least 7 days, plus a pre-migration backup retained through the rollback window; record the actual supported policy, not this suggestion as evidence. Export release records beyond Actions' 90-day retention if needed.

Rehearse with synthetic data in an isolated database/resource: create a draft through authenticated HTTP, take a logical `pg_dump --format=custom` using privately injected connection variables, restore with `pg_restore --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" backup.dump` into a **new empty target**, run the matching compiled app, and verify the saved draft/name/membership through normal login and public APIs. Record backup ID, schema/revision, restore duration, read verification and observed recovery gap. Never point the restore at local/stage/production databases holding data. Store dumps encrypted outside repository/CI artifacts and dispose according to the agreed retention policy. Railway volume restore/PITR procedures must also be checked for the chosen service/plan during setup.

Application rollback selects a known image/deployment only after confirming current schema compatibility. It does not undo database changes. Destructive migration recovery needs its own rehearsed restore/forward-fix plan and downtime/data-loss decision; never run a database reset as rollback.

## Live gate verification checklist

Ticket 05 records actual run/deployment IDs for: failed required PR check blocks merge; failed/cancelled main check creates no stage deployment; main advances during queued delivery without changing uploaded SHA; failed pre-deploy leaves previous revision serving; readiness failure cannot pass smoke; expired QA session/failed smoke produces no passing artifact; missing/failed/mismatched stage evidence blocks manual promotion; production cannot deploy on merge; no production deployment occurs without an explicit authorized operator dispatch. Confirm secrets are target-scoped and public headers match the expected Railway deployment. These checks are still outstanding; local tests cannot prove live repository permissions or platform wiring.

## Official platform references

Checked 15 October 2026: [GitHub workflow dependencies and events](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [deployment environments/protection](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments), [Railway CLI upload/CI semantics](https://docs.railway.com/cli/up), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [healthchecks](https://docs.railway.com/deployments/healthchecks), [configuration reference](https://docs.railway.com/config-as-code/reference), [provided deployment variables](https://docs.railway.com/variables/reference). Railway pre-deploy executes separately before release and blocks on failure; readiness uses the configured PORT/path. The additional exact-revision/deployment smoke wait verifies public routing after the terminal CLI receipt. Its JSON shape was checked against the [pinned CLI source](https://github.com/railwayapp/cli/blob/v5.68.0/src/commands/up.rs).
