# J078: experimental AI members

Implemented on `codex/j078-experimental-ai-members`, based on fetched
`origin/main` at `4bcc95b`. This is local implementation and verification evidence,
not a hosted rollout. No Railway operation, hosted migration, deployment, merge,
production access or live paid model call was performed. Other worktrees and the
older prototype checkout were preserved.

The [agreed specification](../specs/experimental-ai-members.md),
[ADR 0013](../adrs/0013-experimental-ai-members.md) and
[operator/API guide](../operations/ai-members.md) describe the resulting contract.

## Investigation and implementation results

Current main already contained the hosted primary/fallback coach, integrated human
focus authoring, restricted SQL pools and generated manual fixtures. The experiment
reuses those boundaries rather than adopting the older prototype's browser storage,
fake keys, provider or product guides.

The server resolves the immutable owner ID from the existing Google-session path.
The normalized exact-email feature allowlist neither grants admission nor creates
membership. Empty/missing configuration disables the feature; malformed entries
fail startup without echoing addresses. Only a resolved capability is added to the
session response. Local synthetic access and manual fixtures remain ineligible.

The owner interface implements Add, Manage, single-objective Position focus,
ordered SMART goals, profile/focus conflict handling, immediate named-token actions
and localized last-retrieval evidence. Failed/stale saves retain pending input.
Unchanged focus saves retain both version and timestamp. Profile, focus and
credential revisions are independent of retrieval telemetry. Coaching suggestions
require Apply and Save; cancellation, form changes and in-flight saves cannot
silently replace pending writing. Long purpose text leaves card actions reachable;
the editor exposes its complete purpose on demand.

Tokens contain 256 random bits and persist only as SHA-256 verifiers with safe
suffixes/metadata. Issue/regenerate returns a secret once; closing that interaction
clears it. Profile Cancel does not reverse token actions. Rotation atomically
replaces the verifier; token/member deletion cannot resurrect credentials.

The sole consumer GET takes no caller-selected identity or parameters. It returns
only member ID/name and the saved objective, ordered goals, version and timestamp.
Every request checks current owner admission, active membership and allowlist
eligibility. Suspension is reversible for still-valid credentials; browser sign-out
has no effect. Member-level retrieval evidence records the version actually served
and survives token deletion and later focus saves. No-focus, invalid requests and
owner reads do not count. Telemetry must commit before a successful response.

The consumer handler is mounted before browser Origin/JSON handling so all
unsupported methods, including HEAD, return 405 without bypassing retrieval rules.
Management and coaching retain session/Origin protections. Errors are generic,
responses are no-store, GET rejects bodies and parameters, management JSON remains
bounded, and request/admission maps have finite caps. The IP limiter uses socket
peers, so proxied clients may share a quota; this pilot has no distributed limiter.

Coaching receives only stored purpose and pending objective/goals. It uses the
existing provider interface, timeout/fallback/cancellation/output validation and
one shared admission controller with human coaching: one active turn per human,
four globally and 20 turns per human/minute. A mixed human/AI concurrency test
exercises the same four slots. No model call holds a database lock. Suggestions
are reauthorized before return and cannot omit existing goal slots. Semantic
coaching quality and provider-side retention remain outside fixture evidence.

## Schema and SQL grants in plain language

Schema 10 adds three tables without rewriting existing human records:

| Table | Purpose and lifecycle |
| --- | --- |
| `ai_members` | Private profile owned by an immutable human account ID, independent profile revision and last successful retrieval/version. Its FK prevents implicit human deletion. |
| `ai_member_focuses` | Zero or one current objective/ordered-goal document per member, with a positive version. Member deletion cascades to it; prior versions are not retained. |
| `ai_member_tokens` | Multiple named hash-only credentials, suffixes and independent credential revisions. Member deletion cascades; no plaintext secret or per-token retrieval statistics are stored. |

The existing runtime login gets explicit SELECT/INSERT/DELETE on those tables,
plus UPDATE only on mutable profile, focus, verifier/revision and telemetry fields.
It cannot update IDs, owner/member relationships, token names or creation times.
It still cannot perform DDL, grant human roles, or read arbitrary future private
tables. The migration role creates schema/grants, while the separate administration
role receives maintenance CRUD on the new records. Human application-role authority
is unchanged. No owner or consumer receives SQL credentials.

A transaction locks the member root before accessing focus/token children.
Consumer lookup is only a hint until it locks that root and rechecks the verifier.
This serializes saves, successful retrieval evidence, rotation and deletion without
holding locks over inference. A snapshot authorized before concurrent revocation
may complete; later requests fail. Focus writes require the expected focus version;
profile edits and token mutations use their independent revisions.

Schema readiness, health/version expectations, runtime privilege verification,
fresh/upgrade fixtures and CI now require schema 10. Existing synthetic human
cleanup explicitly refuses unexpected AI-member relationships rather than erasing
private experiment data. Retain the additive tables on rollback or suspension.

## Automated and visual evidence

All database/HTTP/browser checks use synthetic local PostgreSQL with isolated
schemas or disposable databases and separate runtime/migration/admin roles.
Provider tests use injected fakes or local HTTP fixtures, with no paid inference.

| Check | Result |
| --- | --- |
| Node 26.13.0 `npm ci` | Passed; audit reported zero vulnerabilities. |
| `npm run typecheck` | Passed for client, server/tests and manual tooling. |
| `npm run build` | Passed production server/client compilation. |
| Final `npm run test:local` | 366 tests: 365 passed, 0 failed, 1 expected non-root settings-ownership permissions skip; no cancellations. |
| `node --test tools/review/*.test.mjs` | 87 passed; no skips/failures. Fakes only. |
| Final focused owner browser/HTTP run | 16 passed, including in-flight Save, regeneration/revocation, validation/CSRF and storage rollback. |
| Docker packaging from committed implementation | Passed from implementation commit `3b223d1`; local image `lantern-j078:3b223d1`. No container deployment. |
| `npm run manual` | Edition 9; 0 of 44 screenshots changed. |
| `npm run manual:check` | Passed; existing missing Google account-chooser supplied-capture warning remains. |
| `git diff --check` | Passed. |

Red-before-green slices covered missing owner capability/routes, focus persistence,
credentials, coaching, owner navigation, unsafe allowlist entries, structural SQL
whitespace rejection, editor scroll positioning, immediately reachable card
controls, and suggestion application during an in-flight Save. The last correction
freezes Apply/Dismiss during Save, preventing newly applied text from being lost
when an earlier submitted write completes.

| Required behavior | Main evidence |
| --- | --- |
| Eligibility, two-human isolation, client ownership rejection, suspension/restoration, sign-out independence | `server/ai-members.integration.test.ts`; ineligible browser navigation test. |
| Profile/focus CRUD, independent revisions, ordered/unchanged/stale saves and failed-edit retention | Owner HTTP tests and `server/ai-members.browser.test.ts`. |
| Purpose/pending-only prompts, no automatic writes, validated output, provider failures and shared admission | `server/ai-member-coach.integration.test.ts`; browser explicit Apply/Save, cancellation and stale-suggestion tests; retained provider regression suite. |
| Hash-only multiple credentials, issue-only reveal, rotation/deletion and immediate controls | Owner HTTP/SQL credential-boundary assertions and browser token lifecycle journeys. |
| Consumer response boundary, auth/no-focus/method/storage/limiter errors and exact served-version evidence | Consumer HTTP tests, including injected database telemetry/write failures. |
| Concurrent retrieval/save/rotation/deletion, no stale overwrite or resurrection, cascade deletion | Concurrent HTTP operations against restricted PostgreSQL and direct SQL constraint/cleanup boundaries. |
| Fresh/upgrade schema, explicit grants, forbidden ownership/relationship writes, no DDL/role grants/private-table access | `server/ai-member-schema.integration.test.ts` and retained migration/privilege/bootstrap/transition/release suites. |
| Responsive accessible workflows and manual exclusion | Chromium and WebKit at 320×640, 390×844, 844×390, 768×1024 and 1440×900; `tools/manual/world.integration.test.ts`; supported manual generation/freshness. |

Desktop, phone editor, short-landscape editor and 320px Manage compositions were
visually inspected. Empty/ordinary/long-content forms, failed/stale saves,
confirmation dismissal, keyboard controls and fixed Save/Cancel reachability are
covered. The editor prioritizes the objective rather than expanding long purpose
text ahead of it; Manage has one scrolling content area and stable actions.
This does not certify native mobile keyboards, iOS/Android browser chrome, OS
accessibility gestures, production load or real Google sign-in.

The unmodified-main rendering baseline reproduced exactly: 0 of 44 screenshots
changed and its original deck remained unchanged. The final manual likewise keeps
all 44 screenshots; its 39 pages contain no AI-member experiment content. Supported
slide text matches baseline after normalizing expected edition footers. The cover
and representative supported-product page were rendered and visually inspected.
The known missing Google account-chooser capture was not invented or confirmed.

Documentation pointers and the explicit human-QA exclusion were integrated into
current PRD/testing/manual guidance and domain terms. A review-harness size check
caught expanded default guidance; the detailed existing staging checkpoint table
was moved intact to [its focused reference](../development/staging-journey.md),
preserving the original review context budget. CI installs WebKit alongside Chromium
for the new responsive regression; staging acceptance retains its existing browser.

## Remaining staging operator steps and limits

The owner reports staging already contains the private pilot allowlist and
production is empty. These values were preserved and have not been verified
against Railway or the running application. No address or provider key is recorded
in committed examples, tests or PR text.

After separate merge/release authorization, the operator must:

1. Follow the release guide to apply schema 10 and roll out the same approved
   revision to staging, then confirm the existing allowlist reaches the process.
   Preserve production's empty feature allowlist throughout the pilot.
2. Check existing coach configuration if coaching is desired: enabled flag, both
   dedicated provider keys, primary URL and primary/fallback models. Do not expose
   keys. No new service, domain, database, queue, encryption key or SQL login is
   needed. Local fakes do not prove hosted connectivity.
3. Sign in normally, create a synthetic member, save its focus and issue a named
   token. Install the secret in consumer secret storage with the service origin.
4. Verify an HTTPS bearer GET, ordered content/version and owner retrieval evidence.
   Use allowlist removal for reversible suspension and delete/regenerate for
   permanent credential revocation. Retain data/schema when disabling the feature.

The experiment remains excluded from human QA, generated slides/screenshots,
exercises, manual cases and sign-off unless the owner explicitly changes that
boundary. No deployment is implied by any local result. The task-attachment tool
was unavailable; the runner handoff will preserve the draft-PR URL.
