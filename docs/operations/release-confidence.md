# Release confidence

Current release policy is recorded in [ADR 0008](../adrs/0008-staging-gate-and-production-smoke.md).
Production uses readiness smoke, with no synthetic business data. GitHub Actions
notifications and engineer recovery are sufficient; no automatic rollback or
custom persistent failure latch is implemented. Optional password logins are not
part of the implemented runner.

The missing release check is authenticated acceptance against the deployed staging
application. The existing local suite already exercises browser workflows and HTTP
interfaces with real PostgreSQL, including failures and access isolation. Adding a
second large unit suite would not establish that the hosted application works.

## Evidence and limits

| Layer | What it establishes | What it does not establish |
| --- | --- | --- |
| Pull-request and main CI | Types, production build/package, PostgreSQL persistence and privileges, browser workflows, validation, concurrency, access isolation, signed Google-token validation | Hosted configuration and networking |
| Deployed readiness | Exact revision, deployment and schema; database connectivity; anonymous denial; rendered login screen | Authenticated product workflows |
| Deployed acceptance | Synthetic member/peer/lead workflows using normal sessions, real browser assets and staging persistence | Google's interactive login, production data migrations, every possible regression |
| Real Google sign-in acceptance | OAuth client, callback, consent and actual Google authentication work together | The whole product's correctness |

The initial review on 21 October 2026 found 34 test files and 171 test/subtest
declarations. This is an inventory, not a coverage percentage or evidence that any
particular revision passed. Most local browser tests use Vite over HTTP; acceptance
adds the compiled deployed assets, HTTPS session cookies, hosted database roles and
network configuration.

Keep detailed validation, failure injection, concurrency, revocation and migration
regressions in isolated local PostgreSQL tests. Keep the hosted journey short and
deterministic. A failed journey must block promotion; rerun after investigating the
cause rather than silently retrying assertions until they pass.

## Authentication recommendation

Provision fresh synthetic accounts and ordinary, short-lived Lantern sessions from
the private staging runner. The runner already has a protected, staging-specific
migration connection capable of preparing that data. Use it only for fixture setup
and cleanup; exercise product actions through the browser and HTTP interfaces.
Neither the running webapp nor production receives a new credential, authentication
route, environment bypass or privilege.

This deliberately begins acceptance after Google identity verification. The
application still resolves sessions, approval, active membership, ownership and
career-lead permissions normally. Local tests exercise the OAuth callback and
signed-token checks through the existing identity-provider seam. Complete a real
Google sign-in after OAuth credentials, callback URLs, admission policy or
authentication code changes, and during initial rollout. A passing synthetic
journey must never be described as a successful Google login.

A work-account email alias cannot supply an independent Google identity:
[Google documents that aliases are not Google Accounts and cannot sign in](https://support.google.com/a/answer/33327).
A separate Workspace user would need administrator provisioning.
[Google service accounts](https://developers.google.com/identity/protocols/oauth2/service-account)
are for server-to-server Google API access; domain-wide delegation adds substantial
authority and is unnecessary for testing Lantern.
[Playwright supports authenticated browser contexts](https://playwright.dev/docs/auth),
but their stored state contains impersonation credentials. Keep test session tokens
in runner memory and never upload cookie state, traces or network captures.

## Promotion recommendation

Enable authenticated acceptance first, while continuing manual production
promotion. Rehearse consecutive hosted successes, a deliberate failure that blocks
promotion, cleanup/retry, and a superseded commit. Enable automatic promotion only
after reviewing that evidence.

Automatic eligibility should require the exact successful main CI run and attempt,
readiness and authenticated acceptance for the same SHA/deployment/schema, and
successful fixture cleanup. Recheck the current main revision and deployed staging
revision immediately before production mutation. Serialize production delivery.
Do not infer execution order from GitHub concurrency:
[GitHub does not guarantee ordering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

Initially keep schema-changing releases manual. Staging's synthetic data cannot
prove a production backfill or destructive migration is safe. Require the live
production schema to equal the accepted staging schema for automatic promotion.
Manual schema releases still need compatibility review and the existing migration
procedure; failed or committed migrations are not automatically rolled back.
The health header reports the application's expected schema, not the entire
database migration ledger; a failed manual migration needs operator recovery
before automatic delivery resumes.

The existing workflow rebuilds the selected source for production; it does not
promote an identical container image. Lockfile installation and the same source
revision reduce variance, but immutable image promotion would provide a stronger
artifact identity guarantee if the hosting workflow later supports it.

## Activation and operation

This PR does not enable either switch or claim hosted acceptance has passed.
Use the existing protected GitHub `stage` environment and its staging migration
URL, CA, target and role settings. No additional database grant, Google account,
Railway variable or production secret is required.

1. Merge with passing CI. Set the **repository** Actions variable
   `STAGE_ACCEPTANCE_ENABLED=true`, leaving `AUTO_PRODUCTION_ENABLED` unset/false.
   The stage job holds its existing staging lock through acceptance and cleanup.
2. Run main CI and inspect the artifact
   `stage-acceptance-<sha>-<run-id>-<attempt>`. It must identify that SHA,
   deployment, schema, CI run and attempt, `acceptance: passed`, `cleanup: passed`,
   and suite version 1. Check the ten recorded areas: identities, direction, mission
   image, focus authoring/persistence, isolation, stale/forged writes, confirmation,
   account/guide, browser errors and session revocation.
3. Complete a real Google sign-in in staging. Rehearse several normal releases
   while keeping manual production promotion. Review a deliberately failed journey
   in an isolated/local test and confirm its failure prevents evidence; rehearse a
   cancelled staging acceptance run and verify the next run recovers its fixtures.
   Verify that a superseded main revision cannot pass the automatic gate.
   Do not intentionally break a shared production deployment to test these cases.
4. Set repository `STAGE_APP_ORIGIN` to the same HTTPS origin configured in GitHub
   `stage` and Railway staging. Check existing GitHub production-environment
   protection rules: required reviewers will still pause an automatic job.
5. With owner authorization for activation, set repository
   `AUTO_PRODUCTION_ENABLED=true`. Both switches must be true. A successful main
   CI completion starts the production workflow; admission validates the original
   run before accessing the production environment, then the production job
   repeats verification under its lock.

Schema changes, first production setup and deliberate historical releases use
the existing manual workflow. Manual dispatch must retain successful prerequisite checks and readiness for
the selected SHA without requiring acceptance. The current implementation still
requires a successful whole CI run and uploads readiness after acceptance, so a
failed acceptance can prevent this override. Resolve and test this gap before
activation; historical successful releases remain manually selectable.

Disabling `AUTO_PRODUCTION_ENABLED` stops new automatic admissions. Cancel already
admitted or queued production runs separately. Leave acceptance enabled to retain
release evidence. For authentication/OAuth configuration changes, keep automatic
promotion disabled until a real Google-login check passes.

The fixture helper uses random run markers, exact synthetic subject/email pairs
and separate departments. It creates only normal approved accounts and
memberships; product requests use normal runtime authority. Sessions expire
after 15 minutes. Browser sign-out and fixture cleanup normally revoke them sooner.
A synthetic lead can view the staging-wide registered-user directory, so its
token must never be logged or uploaded.

A process crash releases the database advisory lock. The next acceptance run
recovers only exactly marked abandoned fixture graphs before creating new data.
If relationships no longer match the fixture's scope, cleanup rolls back and
acceptance fails. Inspect that staging fixture through authorized operator access;
do not broaden deletion predicates or delete human staging data to get a green
run. No evidence is emitted until the browser journey and cleanup both succeed.
