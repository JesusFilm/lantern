# Railway hosting for the first team trial

Researched 2026-10-15. Planning evidence only: no Railway resources, Google configuration, credentials, deployment or restore were changed or verified. Recommendations below are engineering conclusions from the linked primary documentation and the current working tree.

## Smallest useful hosting arrangement

Use one Railway project with persistent `stage` and `production` environments. Each gets its own Lantern service, PostgreSQL service/volume, credentials and HTTPS origin. Railway isolates services, configuration and private networks by environment; syncing configuration does not promote database contents. Public stage URLs still need application authentication. Seed stage with disposable QA documents; do not copy members' production documents into stage. [Railway environments](https://docs.railway.com/environments), [environment isolation](https://docs.railway.com/guides/isolate-staging-production).

Use the same production runtime in both environments, with `NODE_ENV=production`, `LOCAL_ACCESS=0`, `HOST=0.0.0.0`, Railway's `PORT`, and an environment-specific `APP_ORIGIN`. Reference that environment's PostgreSQL `DATABASE_URL`; keep the database private. Railway documents the all-interface bind/port requirement and provides PostgreSQL connection variables. [Networking requirements](https://docs.railway.com/networking/troubleshooting/application-failed-to-respond), [PostgreSQL](https://docs.railway.com/databases/postgresql).

## Current code and deployment work still needed

| Evidence in the working tree | Hosting acceptance needed |
| --- | --- |
| [`package.json`](../../package.json) builds server and client, but `start` requires `.env`; `access:ops` requires `.env` and the development dependency `tsx`. | Start and run operator commands from compiled files with injected variables and no checked-in/on-disk `.env`; retain convenient local commands. Verify the packaged runtime contains its required dependencies. |
| [`server/index.ts`](../../server/index.ts) reads `PORT`, defaults to loopback, migrates before listening, and rejects local access on a non-loopback host or with production `NODE_ENV`. | Configure the hosted bind explicitly; smoke-test compiled startup with hosted variables, missing credentials and unavailable database. Keep local identity unavailable in both hosted environments. |
| [`server/schema.ts`](../../server/schema.ts) contains additive `CREATE IF NOT EXISTS` statements, without tracked incremental migrations. | Introduce an explicit compiled migration command and safe serialized/versioned evolution before schema-changing releases. Test existing-data upgrades, repeat execution and failed migration behavior. Do not run migrations during image build. |
| [`server/app.ts`](../../server/app.ts) exposes `/health`, returning 200 when PostgreSQL responds and 503 otherwise. | Configure `/health` as Railway's deployment healthcheck and demonstrate that a failed startup/database check prevents a release becoming healthy. A healthcheck alone does not verify sign-in or authorization. |
| [`server/operations.ts`](../../server/operations.ts) configures domains, bootstraps the registered career lead and removes membership. | Document environment-targeted compiled operator commands. Bootstrap each environment separately; verify the target before mutations. |
| [`server/focus-http.ts`](../../server/focus-http.ts) scopes every focus operation to its owner and active department. | Preserve member isolation. Career-lead member-focus browsing and focus locking are separate product changes; deploying existing code does not supply them. |

Railway pre-deploy commands have runtime variables/private networking, execute before deployment, and stop deployment on failure. They run in a separate container without application volumes, so the migration runner must operate against PostgreSQL directly. Configure a bounded timeout. [Pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command). Railway switches traffic after a configured healthcheck returns HTTP 200. [Deployment healthchecks](https://docs.railway.com/deployments/healthchecks).

## Authentication and authenticated QA access

Use the existing Google work-account flow, approved hosted domains and active membership, extended by M06/01 with exact database-approved emails for QA and production. Jaco explicitly chose direct database approval during planning; this gate is not in the delivered code yet. The public login shell is reachable; protected documents and APIs must deny anonymous, unapproved and unassigned users. QA needs separate ordinary lead/member accounts and isolated browser sessions, not a shared local identity or test-login route. Current implementation evidence: [`server/google.ts`](../../server/google.ts), [`server/access.ts`](../../server/access.ts), [`access setup`](../system/access-setup.md).

Configure Google OAuth projects separately for testing and production, with Web clients and exact callbacks `https://<stage-origin>/auth/google/callback` and `https://<production-origin>/auth/google/callback`. Google requires exact redirect matching; its `hd` request parameter is a chooser hint, while the verified token's `hd` claim must enforce the allowed domain. Google's production guidance calls for separate test/production projects and excludes test callbacks from production clients. [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Google environment separation](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

Real Google acceptance remains operator-dependent: supply approved domains, lead and QA identities, consent-screen audience and credentials outside Git. Verify login, cancellation/retry, sign-out, persistent sessions, denied outsider access, unassigned-member waiting, member-to-member denial and access removal through actual hosted browsers. Automated provider-boundary tests do not replace these live checks.

## Release and promotion recommendation

For the initial trial, use a documented same-commit promotion gate:

1. Merge reviewed code to `main`; run typecheck, PostgreSQL-backed HTTP/browser tests and build in CI. Deploy the candidate to stage and record its commit SHA and Railway deployment ID.
2. Complete authenticated QA against that SHA and record the result. Keep production autodeploy disabled. Use a controlled production source reference targeting the approved SHA; do not deploy an unverified newer `main` head. Confirm the actual deployed SHA after promotion.
3. Before production deployment, record the database backup and schema compatibility decision. Run migrations and healthchecks, then verify login, document persistence and role/access behavior. Record production deployment ID and previous known-good deployment.

This is a proposed release procedure, not an existing pipeline. Railway supports disabling GitHub autodeploy and waiting for push-triggered GitHub Actions. Its “Deploy Latest Commit” action deploys the connected branch's latest commit, so that action alone cannot guarantee the stage-approved SHA. CI waiting also treats some cancelled/skipped workflows as non-blocking; make the required validation gate explicit. [GitHub autodeploys](https://docs.railway.com/deployments/github-autodeploys).

An alternative is to build once and promote the same uniquely identified container image, recording its digest in both environments. Railway can run registry images without rebuilding, with environment-specific runtime variables. Private registry credentials currently require Pro; do not make a paid registry setup a hidden prerequisite when a verified same-commit process is sufficient. [Private registry deployments](https://docs.railway.com/guides/private-container-registry).

## Recovery and source-access prerequisites

Enable scheduled production database backups and demonstrate restoration using disposable data before inviting members. Record schedule, retention, recovery owner and observed recovery time/data loss. Railway volume backups restore within the same project/environment; use a logical dump for a portable restore drill. PITR is another available option that restores into a new sibling database, but only after archiving/base backups have begun. Choose the needed recovery window explicitly. [Volume backups](https://docs.railway.com/volumes/backups), [PostgreSQL restore guide](https://docs.railway.com/guides/postgres-backups-restores), [PITR](https://docs.railway.com/volumes/point-in-time-recovery).

Rehearse application rollback separately from database recovery. Railway rollback restores a previous image and custom variables without rebuilding; it does not undo database mutations. Keep migrations compatible with the previous application where possible; otherwise document a tested restore/forward-fix procedure before release. [Railway rollback](https://docs.railway.com/guides/roll-back-bad-deploy).

The current Git remote is `JesusFilm/lantern`. A Railway project member needs linked GitHub contributor access, and the Railway GitHub App needs access to that repository for autodeployment. Account/organization approval, Railway project access, plan/budget, origins and Google configuration remain external setup inputs. Record those dependencies in hosting tickets without granting broad GitHub organization access or storing credentials in planning files. [Railway GitHub requirements](https://docs.railway.com/deployments/github-autodeploys).
