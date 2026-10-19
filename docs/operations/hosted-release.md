# Hosted runtime and release runbook

Current decision, 19 October 2026: Jaco approved manual trial releases. Staging
schema 3 and separate database roles are recorded complete; PR #12's bounded
preflight is open with passing CI. Production is inactive and automatic staging
delivery off. IaC and automated release-gate setup are deferred. Agents prepare and
rehearse; Jaco executes production under [operator assistance](production-operator-assistance.md).
This runbook is not execution authorization.

## Human-run trial release

Use one sanitized release record and this ordered checklist for tickets 06/17/07.
Keep sensitive inputs private and use the existing production-change record for
privileged operations; link it instead of duplicating the same execution evidence.

1. **Select:** identify a reviewed exact commit with passing merged-main typecheck,
   PostgreSQL HTTP/browser tests and production build. Record SHA and CI run.
   PR #12 must be reviewed/merged before relying on its new preflight. A green CI
   result does not authorize merge or deployment. Keep confirmation/locking and
   privacy requirements; two-member live acceptance is currently parked/unpassed.
2. **Prepare stage:** with separate task authorization, prepare an isolated checkout
   of that SHA and the existing build/stamp commands (`npm ci`, `npm run build`,
   `node tools/release/stamp.mjs` with `RELEASE_SHA`). Confirm the upload excludes
   private files. Verify target, effective settings and restricted runtime through
   the bounded [configuration preflight](deployment-preflight.md) once available
   in the reviewed release tooling. Keep the runtime separate from privileged runners.
3. **Verify stage:** use the reviewed manual CLI upload path to the explicit target,
   preserve its successful deployment receipt, and verify `/health` reports that
   revision, deployment and expected schema. Record manual ticket-06 checks on
   that deployment. No automated stage artifact or persistent CI Google sessions
   are required. A failing or unavailable required check stays unresolved.
4. **Prepare production checkpoint:** after applicable stage proof, prepare the
   exact versioned commands and target metadata using [database transition](database-transition.md).
   Reuse relevant rehearsal evidence. Explain expected results, stop conditions,
   schema-compatible rollback/forward correction and the absence of backup recovery.
   Jaco verifies the private target and executes the separately authorized database
   checkpoint with migration/admin credentials outside the application. Record
   his sanitized results under 17/13. The application remains inactive.
5. **Authorize and release:** once required acceptance is complete, Jaco explicitly
   authorizes activation of that same revision. Prepare and rehearse the exact
   source-upload command and receipt checks for that release using the existing
   release tools; do not hand him an untested generic command or ask him to invent
   SQL. Use only runtime credentials in the app. Jaco performs the upload privately.
   Verify the receipt, public revision/deployment/schema, then human authenticated
   smoke, intended membership, save/read and confirmation behavior. A changed SHA
   returns to CI and affected stage acceptance; never select moving main implicitly.
6. **Record and close:** record revision, CI/stage evidence, schema/migration result,
   deployment, operator, verification and any recovery. Attribute production findings
   to Jaco. Record access review and closure/removal of temporary sessions/grants.
   Do not claim completion from script preparation or a deployment receipt alone.

Stop on wrong target, failed CI, unexpected database state/counts, uncertain commit,
failed configuration/readiness or required acceptance failure. Diagnose with synthetic
data and sanitized reports; preserve records and use the reviewed recovery path.
No reset, owner-powered runtime fallback or production access by an agent is allowed.
Production preparation may be authorized before final feature acceptance, but
activation waits for it. Do not solicit accounts for the parked two-member case.

The existing `promote.yml` requires an automated stage artifact. It is retained
unchanged for deferred automation and is **not the manual trial release path**.
Do not dispatch it with fabricated evidence or remove its checks. The CLI tooling
is reused through the release-specific rehearsed human procedure above; it has
not yet been executed against production. Automatic stage delivery stays off.

## Runtime contract

Use Node 24.21.0 (the Dockerfile and CI use this version). `npm ci && npm run build` compiles server, operator CLI and migration CLI and builds React. A runtime package needs only `dist/`, package manifests and `npm ci --omit=dev --ignore-scripts`. No `.env`, `tsx`, Vite or TypeScript is loaded in production. The Dockerfile builds in one stage and installs only production dependencies in the final non-root image. CI additionally starts an isolated production-only package, exercising the actual compiled CLI.

| Variable | Contract |
| --- | --- |
| `LANTERN_ENV` | `local`, `stage`, `production`; omitted resolves to restrictive `production` identity; invalid values abort. Authentication consumes `resolveRuntime().environment` from `server/runtime.ts`. |
| `NODE_ENV` | `production` in both hosted environments; explicitly selecting stage/production without it aborts. |
| `DATABASE_URL` | Environment-specific restricted runtime PostgreSQL connection string. The provider-owner Postgres service URL is unsuitable. Keep migration/admin credentials outside the application service and never expose any URL to the browser. |
| `HOST`, `PORT` | Hosted default host is `0.0.0.0`; Railway supplies PORT. Local defaults: `127.0.0.1:4391`. |
| `APP_ORIGIN` | Explicit canonical HTTPS origin when hosted; HTTP loopback allowed locally. No path/trailing slash. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Both required when hosted. Configure separate local/stage/production OAuth clients and exact `/auth/google/callback` URLs during ticket 05. Local walkthrough may omit them. |
| `LOCAL_ACCESS` | Separate opt-in `1`, default off; only loopback/non-production. Stage and production set `0`. |
| `LANTERN_HOSTING_ONLY` | Temporary explicit `1` only with `LANTERN_ENV=stage`, no Google credentials and no local bypass. Disables login and recognition of existing sessions; production rejects it. Default off. |

Omitting `LANTERN_ENV` retains local command compatibility but never opts into personal-account admission. It does not infer stage from NODE_ENV. Startup passes the resolved server-owned identity into the approved-access policy. Do not derive identity from a request or expose environment switching in the client.

Local commands remain `npm run dev`, `npm run dev:local`, `npm run access:ops`. Set `LANTERN_ENV=local` in local `.env`. `npm start` now uses injected variables; `npm run start:local` optionally loads `.env`. `npm run test:local` uses the synthetic owner connection in `.env.example`; CI injects its isolated test-owner connection. Build before running tests because compiled-runtime tests exercise `dist`.

## Migrations and backend operations

From a built release, run each command in its own credential scope. Bootstrap and target settings are described in [database privilege setup](database-privileges.md). Migration and operator processes require all five `LANTERN_DB_*` target settings; each checks the actual database, schema and login before work:

```sh
# Separate migration process: MIGRATION_DATABASE_URL and target settings injected.
npm run db:migrate
# Separate operator process: ADMIN_DATABASE_URL, target settings and LANTERN_ENV injected.
npm run access:ops:compiled -- domains example.test
npm run access:ops:compiled -- setup Engineering lead@example.test
npm run access:ops:compiled -- remove-member USER_UUID
# Application process: restricted DATABASE_URL and runtime settings only.
npm start
```

The example identities are placeholders. Verify the target environment privately before every operator mutation. Do not supply credentials on command lines or save participant emails in source/artifacts. `domains` replaces the domain list; review its full intended value first. Compiled operator commands require an already migrated schema. Local `access:ops` loads `.env.admin` and never migrates. Local startup also requires prior migration and explicit synthetic-account preparation. These commands are not a complete production correction/removal procedure; prepare and rehearse the specific script and sanitized planned record before any human production execution.

Startup never runs DDL, including locally. The compiled migrator must run separately with its own credential before routing a new revision; the old application-service pre-deploy hook is incompatible with this separation. Migration 1 adopts the existing additive schema without resets. Migration 2 adds the empty approved-email list and permits a missing hosted domain for personal accounts; migration 3 installs constrained member enrollment. Readiness requires all three migrations and reports schema version 3. Approve intended emails before allowing sign-in; no legacy account is automatically approved. The schema ledger and changes commit atomically under a PostgreSQL transaction advisory lock scoped to database/schema. Multiple runners serialize; blocked/failed SQL times out and fails the release (current pool statement timeout 3 seconds). Increase that bounded timeout deliberately if a reviewed future migration needs longer; never silently retry destructive work. `/health` checks the ledger and application relations in hosted mode and returns sanitized availability only; revision, deployment ID and schema version headers contain no personnel data.

Integration seam for subsequent migrations: add numbered migrations **after** version 1 under the same connection/transaction/lock, each guarded by its own ledger entry. Never append new DDL inside migration 1: existing installations have already applied it. Advance readiness's required version and the health schema-version header together. Add upgrade tests preserving users, memberships, drafts and confirmed baselines. Prefer expand → migrate → compatible app → later contract. Both old and new app may run during rollout; do not drop/rename columns the old app still uses. Failed migration must leave old traffic serving and no partial ledger entry. Rehearse the compatible old-app rollback before release.

## GitHub and Railway setup (ticket 05; not performed here)

Create separate Railway stage and production app/PostgreSQL services, volumes, variables, domains, OAuth clients and approval data. No production data copies. Build with the Dockerfile. For newly provisioned services, configure and read back the effective Railway service settings explicitly: a separately scoped migration runner (design and verification outstanding), start `node dist/server/index.js`, healthcheck `/health`, timeout 120 seconds and restart policy ON_FAILURE with 3 retries. The dashboard observed on 16 October 2026 says services that never used Config as Code cannot opt in after 28 August 2026; uploading `railway.json` alone did not apply these settings. Verify deployment metadata and migration logs, not just the checked-in file. IaC adoption is deferred; hosted settings plus the bounded preflight are sufficient for the trial. Disable GitHub autodeploy for **both** services and disable image automatic updates. Do not rely on Railway's independent “wait for CI” setting, or use “Deploy Latest Commit”. The human release operator uses the target-scoped credential privately; agents retain staging-only access. Restrict manual Railway deployment permissions to release operators.

Create GitHub `stage` and `production` environments, restricted to protected main. Production uses an explicit operator-triggered promotion, with no separate reviewer or no-self-review requirement (operator decision, 15 October 2026). Keep administrator bypass disabled for the configured branch restriction. Keep production secrets unavailable to PR workflows. Protect workflow files through review/CODEOWNERS/repository rules appropriate to the organization.

Each GitHub environment requires these variables: `APP_ORIGIN`, `RAILWAY_SERVICE` (service ID), `RAILWAY_ENVIRONMENT` (environment ID). Each requires `RAILWAY_TOKEN`, a **separate environment-scoped Railway project token**. Only deferred automation would require `QA_MEMBER_A_SESSION` and `QA_MEMBER_B_SESSION`: cookie values from two distinct approved **ordinary members**, obtained by a human through real Google sign-in in stage. Keep them in environment secrets, never screenshots/artifacts/logs. Sessions expire/revoke normally; refresh by normal login and rerun CI when necessary. No session-minting command or login bypass is added. Provisioning and enrollment are later work.

Require these exact checks on PRs targeting main, select GitHub Actions as the expected source, require up-to-date branches, prevent direct pushes and unauthorized bypass:

- `typecheck`
- `PostgreSQL HTTP and browser tests`
- `production build`

No path filters skip required checks. The same checks rerun on the actual merged main SHA. If enabling a merge queue later, add and verify `merge_group` checks first. `stage delivery and smoke` is a push-only downstream job, not a required PR check.

## Deferred reference: automatic stage delivery

For the first deployment, follow the explicit [operator bootstrap and real-login session acquisition sequence](railway-google-setup-evidence.md#first-stage-bootstrap-before-enabling-unattended-delivery). A manual stage bootstrap is needed before members can obtain real Google sessions; it does not count as passing automated stage evidence and must leave the repository delivery switch off until prerequisites pass.

Stage delivery remains **off** under the manual trial decision. The following describes the retained, deferred implementation, not work to activate now. The job runs only when the **repository-level** Actions variable `STAGE_DELIVERY_ENABLED` is exactly `true`; unset/false skips it before any setup or upload steps. PR/main quality checks continue normally and can finish green while stage is disabled. Do not put this switch in the `stage` environment: environment variables are unavailable when GitHub evaluates this job condition.

Before any separately authorized switch activation, tickets 05/13 must configure and verify stage resources, target settings/token, Google authentication, two QA session secrets, CI protections and the separate migration runner/credential boundary. Any effective app-service pre-deploy migration override must first be removed and the separate runner rehearsed. Then rerun a successful main push workflow for the intended SHA or use the next reviewed merge and verify deployment/readiness/smoke evidence. Set it back to `false` if activation fails. This switch does not enable production delivery.

`.github/workflows/ci.yml` runs three checks; stage depends on all three. Failure, cancellation, skip or absence cannot reach deployment. An additional gate validates all results, event, branch and checkout SHA. Stage checks out `github.sha`, never a moving branch, and stamps `release.json` from that SHA. This generated file is intentionally included in Railway's source upload; do not commit it. The pinned Railway CLI uploads that source, with the commit as deployment message. Main moving cannot change it. Docker builds from the uploaded source and locked npm graph. This is exact-source promotion, not a promise of identical image digests; base tags can change, so record Railway image digest when available and review dependency/base updates.

The separately scoped migration step and configured healthcheck must succeed; an app-service pre-deploy migration hook cannot satisfy the credential-separation gate. The pinned CLI's JSON terminal receipt must report success and match both configured target IDs. Build/deploy logs are captured without printing or uploading them. The smoke runner then waits for `/health` with the exact baked SHA **and that receipt's deployment ID**, so a previous deployment of the same SHA cannot stand in for the new upload. It verifies anonymous data denial, rendered login UI, two normal member sessions, synthetic draft creation/read/reload and other-member detail denial. It checks revision/deployment again at the end. A different deployment during checks fails evidence creation. The stage concurrency group prevents overlapping workflow deployments; GitHub does not promise queue order, so an older checked SHA may become stage's current revision. Always identify by SHA and deployment, never assume “latest”.

Only successful smoke writes `stage-evidence-SHA`, with SHA, deployment ID, schema version and GitHub run ID, retained 90 days. No raw responses, session state, browser traces or screenshots are uploaded. Synthetic drafts use `QA release <sha> run <id>` titles and fixed dates with no personal content. There is no product delete API: retain these in the dedicated QA accounts, or remove them only through a separately reviewed, parameterized stage-only cleanup procedure after evidence retention. Never reset a shared schema to clean QA data.

Automated smoke does not complete real Google login or replace newcomer/lead confirmation acceptance. Ticket 06 records real login/cancel/retry, approval revocation, guide-assisted newcomer authoring, lead browsing/confirmation, two-member isolation, lock persistence and production readiness against the exact SHA. Feature-specific acceptance awaits the relevant tickets.

## Deferred reference: artifact-gated promotion

Run `Promote verified revision` from protected main with a full SHA, successful main CI run ID and HTTPS acceptance-record URL. The operator starting the workflow must inspect that record **before clicking Run workflow**. Repository permissions must restrict release execution to Jaco under the current production-access policy; workflow availability alone is not release authorization. It must identify the exact SHA and stage deployment, successful CI/smoke, practical QA results, required migrations/schema version, previous production deployment, schema compatibility, the current backup decision (deferred during dogfooding) and applicable transaction/rollback checks. A bare URL is not human acceptance; the initiating operator owns the practical QA decision. There is no second-person approval step.

The workflow verifies the run through GitHub's API: repository, workflow path, push event, main branch, completed success and exact SHA. It downloads that run's named stage artifact and checks SHA, run ID and passing stage result. Missing/expired artifact, cancelled/failed run, or different SHA prevents deployment. It then checks out the candidate SHA in a separate directory and uploads that source to **production's** target using production's token. No merge event can trigger this workflow. Code changes require new CI/stage/QA evidence.

After migration/readiness, production automation checks the exact revision, public login and anonymous data denial. An artifact records the production deployment, schema, operator, stage run and acceptance record. Human production smoke must then verify real Google login, intended membership and a synthetic focus persistence/confirmation workflow; append that result to the release record. Failure is an incident requiring the release operator; the workflow never resets data or automatically rolls back schema.

## Backup, restore and rollback

Jaco’s 19 October decision: no staging backups and no production backups at this point. Production backups are reconsidered only after dogfooding completes and application value is determined (ticket 16); they are not a release gate during initial dogfooding. Keep transaction failure checks and schema-compatible rollback checks. No backup-based data recovery is promised; destructive resets/rebuilds need a separate decision. Export release records beyond Actions’ 90-day retention if needed.

Future procedure, only after backup work is explicitly authorized: rehearse with synthetic data in an isolated database/resource: create a draft through authenticated HTTP, take a logical `pg_dump --format=custom` using privately injected connection variables, restore with `pg_restore --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" backup.dump` into a **new empty target**, run the matching compiled app, and verify the saved draft/name/membership through normal login and public APIs. Record backup ID, schema/revision, restore duration, read verification and observed recovery gap. Never point the restore at local/stage/production databases holding data. Store dumps encrypted outside repository/CI artifacts and dispose according to the agreed retention policy. Railway volume restore/PITR procedures must also be checked for the chosen service/plan after the deferred backup decision is revisited.

Application rollback selects a known image/deployment only after confirming current schema compatibility. It does not undo database changes. Destructive migration recovery needs its own rehearsed restore/forward-fix plan and downtime/data-loss decision; never run a database reset as rollback.

## Deferred reference: automated gate verification

If ticket 15 is explicitly resumed, it records actual run/deployment IDs for: failed required PR check blocks merge; failed/cancelled main check creates no stage deployment; main advances during queued delivery without changing uploaded SHA; failed pre-deploy leaves previous revision serving; readiness failure cannot pass smoke; expired QA session/failed smoke produces no passing artifact; missing/failed/mismatched stage evidence blocks manual promotion; production cannot deploy on merge; no production deployment occurs without an explicit authorized operator dispatch. Confirm secrets are target-scoped and public headers match the expected Railway deployment. These checks are still outstanding; local tests cannot prove live repository permissions or platform wiring.

## Official platform references

Checked 15 October 2026: [GitHub workflow dependencies and events](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [deployment environments/protection](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments), [Railway CLI upload/CI semantics](https://docs.railway.com/cli/up), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [healthchecks](https://docs.railway.com/deployments/healthchecks), [configuration reference](https://docs.railway.com/config-as-code/reference), [provided deployment variables](https://docs.railway.com/variables/reference). Railway pre-deploy executes separately before release and blocks on failure; readiness uses the configured PORT/path. The additional exact-revision/deployment smoke wait verifies public routing after the terminal CLI receipt. Its JSON shape was checked against the [pinned CLI source](https://github.com/railwayapp/cli/blob/v5.68.0/src/commands/up.rs).
