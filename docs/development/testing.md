# Testing

Use this guide to run tests or explain coverage. For intended review and confirmation behavior, see the [business rules](../rules/review-and-confirmation.md). [QA issue workflow](qa-issue-workflow.md) covers manual QA results and engineering issue closure. [Releasing](../operations/releasing.md) covers promotion decisions and failures.

## Run locally

Requires the Node version supported by [package.json](../../package.json), Python 3, Docker Compose and Chromium. From the repository root:

```sh
npm ci
npx playwright install chromium
docker compose --env-file .env.example up -d --wait database
npm run build
npm run typecheck
npm run test:local
```

Use the synthetic loopback owner connection in `.env.example`. Tests create isolated schemas and disposable databases/roles; application startup uses a separate restricted runtime connection.

The local database is disposable. Tests build their own data, and local startup adds the Engineering initiatives. When the database gets in the way (other credentials, an old version or leftover data), reset it with `docker compose --env-file .env.example down -v`, then run the `up` command above. Keep your private `.env` files, which hold settings rather than data. If another server already uses the port, stop it first.

`test:local` uses Node's test runner, including tests that launch Playwright and the Python ticket-board installer test; `npx playwright test` is not the suite entry point. Build first: release integration tests import compiled server code and browser assets. A focused run uses the same fixture and runner, for example:

```sh
node --env-file=.env.example --import tsx --test --test-concurrency=1 tools/release/acceptance-browser.integration.test.mjs
```

Use TDD and a focused test while changing behavior; run typecheck, build and the full suite before submitting application/release-code changes. Report failures and skips, not just an exit code. The ownership-permission test in `settings.test.mjs` intentionally skips when not running as root. Documentation-only changes need link/content validation rather than a full application test run.

## Local and PR coverage

[package.json](../../package.json) defines the exact test files. [CI](../../.github/workflows/ci.yml) runs typecheck, the full Node suite against isolated PostgreSQL with Chromium, and a production build plus Docker packaging. PRs run these checks; main pushes can additionally deploy staging.

| Area | Behavior checked; source entry points |
| --- | --- |
| Identity and access | Signed OIDC ID-token claims through local token/JWKS HTTP fixtures, approval/enrollment, membership, session expiry/revocation and browser account switching. `server/jesusfilm.test.ts`, `server/access.integration.test.ts`, `server/session.browser.test.ts`, `server/sign-in-collision.integration.test.ts`, `server/auth-recovery.integration.test.ts`, `server/auth-recovery.browser.test.ts` |
| Feature flags | Setting validation, environment defaults, and that a session lists a flagged feature only for accounts allowed to see it. `server/features.test.ts`, `server/features.integration.test.ts`, `server/feature-operations.integration.test.ts` (owner-only flag reporting with active membership and no preview-email disclosure) |
| Owner REST and MCP | Restricted PostgreSQL fixture, locally signed JFP One access tokens and a fixture key set. Checks department reads, linked owner authorization, preview, discovery, canonical-host 404 before JWKS or body parsing, alias redirects, and credential isolation from the browser and team API. `server/owner-api.integration.test.ts` |
| Product workflows | Position-focus drafts, objectives/goals, direction and artwork, career-lead views, confirmation/locking, guide, reload persistence and asynchronous editing races. `server/*integration.test.ts`, `server/*browser.test.ts` |
| Data and permissions | Real PostgreSQL persistence, stale/forged writes, cross-member/department denial, separated runtime/migration/admin roles, migrations, bootstrap and recovery failure paths. `server/database-*.test.ts`, `server/migration.integration.test.ts` |
| Delivery safeguards | Configuration/target checks, migration failures, evidence identity/freshness, manual override, cleanup/interruption recovery and safe diagnostics. `tools/release/*.test.mjs` |
| Supporting tools | Local ticket-board behavior. `tools/ticket-board/tickets.test.ts` |
| QA manual tooling | Screenshot capture (scroll frames, fixed bars, crops, settling, failures), slide image layout and manual freshness. `tools/manual/*.test.ts` |

Local browser tests largely use Vite/HTTP. Release integration tests additionally exercise built assets, HTTPS smoke and restricted database roles locally. These do not establish hosted networking/configuration or real Jesus Film interaction.

## Deployed staging journey

The main CI stage job validates configuration, applies migrations and deploys the selected revision, then verifies readiness (below). With acceptance enabled, a private runner seeds four synthetic accounts: member, peer, career lead and an outsider in another department. It supplies ordinary 15-minute sessions, then uses the deployed browser and HTTP interfaces. This starts **after Jesus Film identity verification**; there is no public test-login endpoint.

The [browser runner](../../tools/release/acceptance-browser.mjs) records these twelve checkpoints in order:

| Checkpoint | What it actually does |
| --- | --- |
| `authenticated-identities` | Verify four distinct authenticated identities, their roles and department boundaries. |
| `department-direction` | Lead saves a mission and initiative; reload verifies persistence and the member sees the mission. |
| `mission-image` | Upload a synthetic PNG through the browser; save/reload and verify the converted WebP renders for lead and member. |
| `focus-authoring-persistence` | Create a focus, edit title, add/edit an initiative-aligned objective and SMART goal; reload and check browser plus API persistence. |
| `authorization-isolation` | Reject another person's direct focus reads/writes and cross-department lead access; allow the scoped lead view; reject member confirmation. |
| `stale-and-forged-writes` | Reject an old version, forged ownership and foreign Origin; verify the document is unchanged. |
| `review-requests-and-notes` | Reject confirmation before a review request and verify the draft is unchanged. Member requests review of a saved focus; lead adds a note; member reads it; verify snapshot persistence, read acknowledgments and participant isolation. No live model is called. |
| `lead-confirmation-lock` | Lead confirms the member's requested version; both views show the locked document and an API edit is rejected. The lead then creates their own focus, is blocked before requesting review, sends a request without a note, and self-confirms. Reload and HTTP reads verify self-attribution, content and the edit lock. |
| `coaching-disabled-manual` / `coaching-enabled-journey` | A second synthetic member creates, saves, reopens and submits a draft. With coaching off, verify inference returns 503 and manual authoring works. With coaching on, use the deployed providers for contribution questions, objective/action suggestions and a member-edited date; verify generated content persists and is submitted. |
| `account-and-guide` | Edit/reload the member's display name; open the guide and example. |
| `browser-errors` | Require no page JavaScript errors during the journey. |
| `session-revocation` | Sign out supplied sessions and verify replay cannot access focuses, including after a journey failure. |

The [fixture lifecycle](../../tools/release/acceptance-fixture.mjs) holds a database lock, recovers exactly marked abandoned fixtures, and removes only its verified synthetic graph. Unexpected relationships fail cleanup. Both journey and cleanup must pass; the [acceptance runner](../../tools/release/acceptance.mjs) checks live release identity again before writing evidence. Cancellation can leave fixtures for the next run to recover. The Actions summary reports journey and cleanup separately; it never substitutes for passing evidence.

## Readiness and coverage limits

Both deployed environments use [readiness smoke](../../tools/release/smoke.mjs): health/database readiness; matching SHA, deployment ID and schema; anonymous `/api/focuses`, `/api/department` and `/api/guide` return 401; the document HTTP request redirects to authentication before any app HTML; the browser reaches Lantern’s authentication handoff (intercepted before the external provider), then renders the retry shell and checks for JavaScript errors; final health still matches. **Production runs only these readiness checks**, with no synthetic business data or authenticated journey.

Acceptance evidence records `coaching: enabled` or `disabled`; a flag-off run does not establish live inference. Enabled runs make at most ten browser coaching requests. With `coach-redesign`, one objective request can make up to five model calls (the reply, a draft from the member's answers and up to three check attempts), and each call may use fallback. Runs use only synthetic work and check workflow/response contracts rather than exact wording or model quality. With `coach-redesign` enabled the journey selects Contribution first, handles follow-up questions, uses immediate goal ideas and shows the final check without another model request. If the coach answers with feedback instead of goal ideas (after asking once more) or instead of goal wording, the journey switches to Write myself and writes or keeps the goal, as a member can, and logs that it did. Model quality alone therefore does not block delivery, while failed or unavailable coaching requests still do. The same runner retains the legacy flow when the flag is off. The runner does not deliberately disrupt the hosted primary; forced failover and restoration remain a separate activation check.

Staging acceptance does not cover real Jesus Film login, enrollment, every initiative lifecycle, production backfills/data conditions, load/stress behavior or every regression. Local tests cover some of those functional gaps, but do not prove them on the hosted deployment. Complete a real Jesus Film sign-in during initial rollout and after auth/OAuth/admission-policy changes; use the [release procedure](../operations/releasing.md) to hold automatic promotion for that check. Schema changes require compatibility review and manual release. Production is rebuilt from the selected source, not promoted as an identical container image.

For the [owner API slice 1 exception](../operations/releasing.md#owner-api-slice-1),
PR CI verifies flag-off startup and route isolation. The authenticated staging
runner uses seeded sessions and cannot establish MCP OAuth consent. Verify
that separately on a Mac after the Lantern and Forge revisions are deployed.
Follow the [owner onboarding journey](../api/owner-onboarding.md#sign-in-with-codex-on-a-mac)
and retain sanitized results for the linked owner and linked non-owner.

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

Coaching quality is measured by the [coach benchmark](coach-benchmark.md), the required procedure for changes to coach prompts, contracts, turn logic, models or the guided flow. It replays vague, rewording, proficient and adversarial members through the shipped coaching turn on Qwen, applies pass rules fixed before running, compares the results with a committed baseline and applies the thresholds in `tools/coach-eval/gate.json`. The **Coach benchmark** pull request check runs it when coaching files change, once its key is configured; the typecheck job always runs the harness's offline tests. A green benchmark shows the coach still handles the scripted members; it does not test the browser interface or hosted connectivity. The broader judged [coach evaluation](../../tools/coach-eval/README.md) compares models and wording quality with paid judges.

Identity cutover regressions cover same-email collision refusal, concurrent first
sign-ins, ambiguous enrollment through HTTP and the database function, private
recovery planning by email or explicit mapping, expiring verified-identity receipts, history preservation, stale/wrong-target plans, rollback,
runtime-role denial and session-cutover replay. Browser journeys exercise
recovery, retained department/focus access, sign-out, cancellation and retry at
desktop and phone widths using a fixture identity provider. They do not establish
real JFP identity continuity or certify a physical phone; follow the
[identity cutover procedure](../operations/identity-cutover.md) for hosted checks.

## Progress-save diagnostics

Progress writes carry a random per-attempt operation ID. The server logs `progress-save`
with its SHA-256 hash and a `committed`, `fenced`, `rejected`, or `failed` phase; a rejection includes its HTTP status. The browser reports
`response-received`, `response-error` (with HTTP status), `fetch-failed`,
`fetch-timeout`, `response-invalid`, `client-error`, `view-gone`, `state-update-scheduled`, or `recovery-checked`
with the same hashed ID. Client phases are untrusted reports, not proof of server
actions; the ID hash is a pseudonym, not a secret. The report endpoint requires
an authenticated active member, the feature and a valid bounded payload. These
structured logs contain no note text, raw account or focus ID, cookie, URL or
exception text. A diagnostic sink failure cannot change
the save result.

Correlate phases by operation ID and timestamp; repeated writes with the same ID
are retries or a cancellation fence using the same original revisions. The
fence preserves saved status and note content while invalidating a still-delayed
write; a 409 means another save has already advanced those revisions. `state-update-scheduled` means the
browser scheduled an update, not that rendering or a user observing it is proven.
Browser reports use a bounded in-memory queue retried on reconnection. They are
best effort: an offline or closed browser may not send them, so a missing phase
is not proof of a specific network or UI failure. Historical
requests made before instrumentation cannot be retroactively correlated.
