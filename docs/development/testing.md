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

Local browser tests largely use Vite/HTTP. Release integration tests additionally exercise built assets, HTTPS smoke and restricted database roles locally. These do not establish hosted networking/configuration or real Google interaction.

## Deployed staging journey

The main CI stage job validates configuration, applies migrations and deploys the selected revision, then verifies readiness (below). With acceptance enabled, a private runner seeds four synthetic accounts: member, peer, career lead and an outsider in another department. It supplies ordinary 15-minute sessions, then uses the deployed browser and HTTP interfaces. This starts **after Google identity verification**; there is no public test-login endpoint.

The [browser runner](../../tools/release/acceptance-browser.mjs) records these twelve checkpoints in order:

| Checkpoint | What it actually does |
| --- | --- |
| `authenticated-identities` | Verify four distinct authenticated identities, their roles and department boundaries. |
| `department-direction` | Lead saves a mission and initiative; reload verifies persistence and the member sees the mission. |
| `mission-image` | Upload a synthetic PNG through the browser; save/reload and verify the converted WebP renders for lead and member. |
| `focus-authoring-persistence` | Create a focus, edit title, add/edit an initiative-aligned objective and SMART goal; reload and check browser plus API persistence. |
| `authorization-isolation` | Reject another person's direct focus reads/writes and cross-department lead access; allow the scoped lead view; reject member confirmation. |
| `stale-and-forged-writes` | Reject an old version, forged ownership and foreign Origin; verify the document is unchanged. |
| `review-requests-and-notes` | Member requests review of a saved focus; lead adds a note; member reads it; verify snapshot persistence, read acknowledgments and participant isolation. No live model is called. |
| `lead-confirmation-lock` | Lead confirms; both views show the locked document without editing controls and an API edit is rejected. |
| `coaching-disabled-manual` / `coaching-enabled-journey` | A second synthetic member creates, saves, reopens and submits a draft. With coaching off, verify inference returns 503 and manual authoring works. With coaching on, use the deployed providers for contribution questions, objective/action suggestions and a member-edited date; verify generated content persists and is submitted. |
| `account-and-guide` | Edit/reload the member's display name; open the guide and example. |
| `browser-errors` | Require no page JavaScript errors during the journey. |
| `session-revocation` | Sign out supplied sessions and verify replay cannot access focuses, including after a journey failure. |

The [fixture lifecycle](../../tools/release/acceptance-fixture.mjs) holds a database lock, recovers exactly marked abandoned fixtures, and removes only its verified synthetic graph. Unexpected relationships fail cleanup. Both journey and cleanup must pass; the [acceptance runner](../../tools/release/acceptance.mjs) checks live release identity again before writing evidence. Cancellation can leave fixtures for the next run to recover. The Actions summary reports journey and cleanup separately; it never substitutes for passing evidence.

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
5. Summarize coverage, critique and unverified checks in the PR. Keep generated
   screenshots and disposable verification scripts out of Git; remove them after
   review. Retain only the minimum evidence needed for an active review.

Existing browser tests run in CI. This checklist does not imply a dedicated
responsive regression suite or automatic visual approval.

Coaching provider tests use local HTTP fixtures for Qwen-first routing, OpenRouter fallback, cooldown, timeout, malformed output, cancellation and safe errors. Coaching HTTP/browser tests use restricted PostgreSQL roles for atomic save/resume, review snapshots, notes, access isolation and multi-objective preservation. These tests do not evaluate model quality or establish hosted provider connectivity. See [coaching rollout](../operations/coaching.md).

Objective authoring browser journeys cover explicit manual/AI-guided methods, a single objective save with nested goals, editable types, sibling preservation, method switching, cancellation, failure recovery, legacy working-note preservation and member/lead whole-document review. The same authenticated acceptance runner now enters assistance through Position focuses. Provider fixtures verify workflow contracts, not the usefulness of generated wording.
