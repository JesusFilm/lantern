# Testing

Use this guide to run tests or explain coverage. [Releasing](../operations/releasing.md) covers promotion decisions and failures.

## Run locally

Requires the Node version supported by [package.json](../../package.json), Docker Compose and Chromium. From the repository root:

```sh
npm ci
npx playwright install chromium
docker compose --env-file .env.example up -d --wait database
npm run build
npm run typecheck
npm run test:local
```

Use the synthetic loopback owner connection in `.env.example`. Tests create isolated schemas and disposable databases/roles; application startup uses a separate restricted runtime connection. Preserve existing private environment files and database volumes. If a local database already uses different credentials or the port is occupied, resolve that fixture configuration first rather than resetting its volume.

`test:local` uses Node's test runner, including tests that launch Playwright; `npx playwright test` is not the suite entry point. Build first: release integration tests import compiled server code and browser assets. A focused run uses the same fixture and runner, for example:

```sh
node --env-file=.env.example --import tsx --test --test-concurrency=1 tools/release/acceptance-browser.integration.test.mjs
```

Use TDD and a focused test while changing behavior; run typecheck, build and the full suite before submitting application/release-code changes. Report failures and skips, not just an exit code. The ownership-permission test in `settings.test.mjs` intentionally skips when not running as root. Documentation-only changes need link/content validation rather than a full application test run.

## Local and PR coverage

[package.json](../../package.json) defines the exact test files. [CI](../../.github/workflows/ci.yml) runs typecheck, the full Node suite against isolated PostgreSQL with Chromium, and a production build plus Docker packaging. PRs run these checks; main pushes can additionally deploy staging.

| Area | Behavior checked; source entry points |
| --- | --- |
| Identity and access | Signed Google-token claims using a mocked exchange, approval/enrollment, membership, session expiry/revocation and browser account switching. `server/google.test.ts`, `server/access.integration.test.ts`, `server/session.browser.test.ts` |
| Product workflows | Position-focus drafts, objectives/goals, direction and artwork, career-lead views, confirmation/locking, guide, reload persistence and asynchronous editing races. `server/*integration.test.ts`, `server/*browser.test.ts` |
| Data and permissions | Real PostgreSQL persistence, stale/forged writes, cross-member/department denial, separated runtime/migration/admin roles, migrations, bootstrap and recovery failure paths. `server/database-*.test.ts`, `server/migration.integration.test.ts` |
| Delivery safeguards | Configuration/target checks, migration failures, evidence identity/freshness, manual override, cleanup/interruption recovery and safe diagnostics. `tools/release/*.test.mjs` |
| Supporting tools | Local ticket-board behavior. `tools/ticket-board/tickets.test.ts` |
| QA manual tooling | Screenshot capture (scroll frames, fixed bars, crops, settling, failures), slide image layout and manual freshness. `tools/manual/*.test.ts` |

Local browser tests largely use Vite/HTTP. Release integration tests additionally exercise built assets, HTTPS smoke and restricted database roles locally. These do not establish hosted networking/configuration or real Google interaction.

## Deployed staging journey

Staging acceptance uses four synthetic accounts and ordinary expiring sessions
against the deployed browser/HTTP interfaces, starting after Google verification.
The [checkpoint reference](staging-journey.md) describes the twelve checkpoints,
fixture ownership/cleanup and evidence boundaries. Journey and cleanup must both
pass; these synthetic sessions do not establish real Google login.

## Readiness and coverage limits

Both deployed environments use [readiness smoke](../../tools/release/smoke.mjs): health/database readiness; matching SHA, deployment ID and schema; anonymous `/api/focuses`, `/api/department` and `/api/guide` return 401; the Google sign-in control renders without page JavaScript errors; final health still matches. **Production runs only these readiness checks**, with no synthetic business data or authenticated journey.

Acceptance evidence records `coaching: enabled` or `disabled`; a flag-off run does not establish live inference. Enabled runs make at most six model turns (each may use fallback), use only synthetic work and check workflow/response contracts rather than exact wording or model quality. The runner does not deliberately disrupt the hosted primary; forced failover and restoration remain a separate activation check.

Staging acceptance does not cover real Google login, enrollment, every initiative lifecycle, production backfills/data conditions, load/stress behavior or every regression. Local tests cover some of those functional gaps, but do not prove them on the hosted deployment. Complete a real Google sign-in during initial rollout and after auth/OAuth/admission-policy changes; use the [release procedure](../operations/releasing.md) to hold automatic promotion for that check. Schema changes require compatibility review and manual release. Production is rebuilt from the selected source, not promoted as an identical container image.

When changing a checkpoint or coverage boundary, update this guide alongside its runner/tests. Keep test counts in run results, not as a coverage claim here.

## Responsive UI review

Desktop and mobile are supported. For UI changes:

1. Identify the member's task and check empty, ordinary, long-content, failed-save
   and read-only states. Prioritize Position Focus reading/writing and the Guide;
   also check affected account, access and career-lead screens.
2. Review at 320px and 390px portrait, short landscape, a tablet and desktop.
   Use Chromium and WebKit where available. Critique the actual first viewport:
   task hierarchy, wasted space, readable text and actions hidden by fixed bars.
   Full-page captures and overflow checks alone do not prove a useful phone view.
3. Exercise swipe and button alternatives, direct section selection, long vertical
   reads, full-document mode, active-objective add/delete, editing a later objective,
   failed saves and rotation with unsaved input. Compare the desktop composition.
4. Run the existing automated browser suite. Before release, check real iOS/Android
   keyboards, native pickers, browser chrome, pinch/OS gestures and enlarged text;
   check desktop text enlargement and browser zoom. Emulation does not certify these.
5. Summarize coverage, critique and unverified checks in the PR. Keep review
   screenshots and disposable verification scripts out of Git; remove them after
   review. Retain only the minimum evidence needed for an active review. The
   generated [QA manual](manual.md) is the exception: regenerate and commit it.

Existing browser tests run in CI. This checklist does not imply a dedicated
responsive regression suite or automatic visual approval.

Coaching provider tests use local HTTP fixtures for Qwen-first routing, OpenRouter fallback, cooldown, timeout, malformed output, cancellation and safe errors. Coaching HTTP/browser tests use restricted PostgreSQL roles for atomic save/resume, review snapshots, notes, access isolation and multi-objective preservation. These tests do not evaluate model quality or establish hosted provider connectivity. See [coaching rollout](../operations/coaching.md).

Objective authoring browser journeys cover explicit manual/AI-guided methods, a single objective save with nested goals, editable types, sibling preservation, method switching, cancellation, failure recovery, legacy working-note preservation and member inline review alongside lead snapshot review. The same authenticated acceptance runner now enters assistance through Position focuses. Provider fixtures verify workflow contracts, not the usefulness of generated wording.

## Experimental AI members

The [experiment](../specs/experimental-ai-members.md) is excluded from human QA,
generated manuals, slides, screenshots, exercises, manual cases and sign-off.
Human QA accounts remain ineligible; inclusion requires a later owner decision.
[Manual fixtures](../../tools/manual/world.ts) explicitly inject an empty allowlist,
independently of developer configuration. Preserve source freshness and regenerate
the supported manual with the feature disabled.

`server/ai-member*.test.ts` checks owner/consumer HTTP and browser workflows against
isolated restricted PostgreSQL, including eligibility, revisions, credential
lifecycle, retrieval telemetry, concurrent operations, SQL authority and coaching
boundaries/shared admission. Required automated checks still apply. Providers are
injected fakes. Chromium/WebKit emulation covers narrow, landscape, tablet and
desktop views; hosted configuration, real Google login, native devices and live
provider behavior require later authorized staging evidence.
