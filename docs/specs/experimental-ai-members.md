# Experimental AI members

Status: agreed 3 November 2026; implemented for local verification and draft PR review. Not deployed. Human QA and manual inclusion remain excluded.

## Outcome and boundary

An eligible human member privately manages AI-member profiles and their current
position focuses. Each agent retrieves its own focus through a token-authenticated
HTTPS API. The pilot is for one human owner in staging, with 1–2 consumers making
approximately two reads per day. Actual owner addresses belong in environment
configuration and the private operator handoff, not repository examples.

This is separate from human members and departments. Department administration,
multiple department memberships, agent Google accounts, MCP, agent writes and
explicit acknowledgement are outside this implementation.

Implement against current origin/main, which has integrated hosted coaching and
manual generation. The older live-coach prototype checkout is not the baseline.

## Experimental status

Navigation reads **AI members — Experimental**. The page displays
**Experimental · excluded from QA**. Exclude these workflows from generated
user/QA manuals, slides, screenshots, exercises, manual cases and QA sign-off.
Manual fixtures explicitly inject an empty feature allowlist, independently of
the developer's environment. Human QA accounts remain ineligible.

Required automated implementation, security and regression checks still apply.
Preserve manual source-freshness checks and regenerate the supported-product
manual with the feature disabled when shared source changes. Inclusion in human
QA and the manual requires an explicit later owner decision.

## Eligibility and ownership

`AI_MEMBER_MANAGER_EMAILS` is a server-only comma/newline-separated allowlist of
exact normalized email addresses. Missing or empty means disabled. Validate
nonempty entries and reject wildcard or malformed configuration safely. Expose
only the resolved capability to the browser, never the configured address list.

An existing admitted Google-authenticated human with active membership qualifies
when allowlisted; career-lead status is not required. Resolve the immutable owner
user ID on the server. Each owner can manage multiple AI members; other humans,
including career leads, have no access to those records. Apply ownership checks
to every list, read, edit, coach, token and deletion operation.

Consumer authentication checks the owning human's current admission, membership
and allowlist eligibility on every request. Removing eligibility suspends token
access without deleting credentials. Restoring eligibility resumes existing
tokens. Individually deleted or regenerated tokens never resume. Signing out of
the owner's browser does not suspend consumers. Environment changes take effect
when deployed configuration reaches the running application; already-authorized
in-flight requests may finish. This does not recall content already retrieved.

## Owner interface

The menu opens a list/grid with Add, profile details, management actions and a
Position focus button for each member. Add requires a name and accepts optional
plain-text role/purpose. Saving closes the dialog and adds the member to the list.
Clicking a member opens Manage: edit those details, see last successful retrieval
date/time and focus version served, and manage named tokens. Show a clear never
retrieved state and localize timestamps. Token actions have distinct immediate
controls, separate from profile Save/Cancel.

Position focus opens an editor with one objective and an ordered collection of
SMART goals. Reuse appropriate current focus controls and coach presentation.
There are no periods, additional title, types, initiatives, draft/confirmation
states or publish step. Before the first save, no focus exists. Saving requires
one nonempty objective and at least one nonempty goal, using shared bounded
validation where appropriate. Manual or coach edits stay local until Save.

Save atomically replaces current content and increments its version only when
content changes. First saved version is 1. Use optimistic concurrency; stale saves
return a conflict and preserve the user's pending edits for recovery. Failed saves
also retain edits; Cancel leaves saved data unchanged. Focus versions need no
retained revision history. Profile edits have separate concurrency protection;
retrieval telemetry must not make either editor stale.

Deleting a member requires explicit confirmation and permanently deletes its
profile, current focus and all tokens in one transaction. There is no transfer
of ownership or department assignment in this pilot.

## Data model and SQL authority

Add three tables through the next available additive schema migration:

| Table | Data and constraints |
| --- | --- |
| `ai_members` | UUID primary key; immutable `owner_user_id` FK to users; name; optional purpose; profile revision; creation/update timestamps; last retrieved timestamp and focus version served. Restrict implicit owner deletion so existing human cleanup must handle this relationship explicitly. |
| `ai_member_focuses` | `ai_member_id` primary key/FK with delete cascade; objective; ordered goals as validated JSON array; positive version; update timestamp. Zero or one row per member. |
| `ai_member_tokens` | UUID primary key; immutable member FK with delete cascade; token name; unique verifier hash; nonsecret suffix; credential revision; creation/rotation timestamp; optional per-token successful retrieval data. |

Enforce structural invariants in PostgreSQL and validate all text/collection
bounds at the API boundary. Member-level retrieval evidence survives deletion
of a token; it reports the version actually served, even after a newer focus save.

Use the existing restricted application SQL role/pool. It needs explicit
SELECT/INSERT/DELETE and column-specific UPDATE grants on these new tables.
Exclude ownership and relationship columns from UPDATE grants. Existing grants
do not automatically cover new tables. Keep human-role permissions unchanged.
The migration role creates schema/grants; the administration role retains its
separate maintenance purpose. No consumer or human receives database credentials.

Update schema readiness/version contracts, migration tests, privilege grant and
verification code, and fixture cleanup. Prove the runtime still cannot perform
DDL, grant human roles or access arbitrary newly created private tables.

| Operation | Reads/writes |
| --- | --- |
| Owner list/detail | Verify identity/eligibility; SELECT only owned profiles, focus and safe token metadata. |
| Create/edit profile | INSERT with server owner; UPDATE allowed fields with expected profile revision. |
| Save focus | Check owner and expected focus version; INSERT first or UPDATE current focus atomically. |
| Coach | Read eligibility; send allowed pending form context to provider; no focus write. |
| Issue/rotate/delete token | Verify owner; INSERT/replace verifier or DELETE in transaction. Never return stored secret material. |
| Consumer GET | Resolve token and current owner eligibility; read that member's focus; update successful retrieval timestamp and exact version served. |
| Delete member | Verify owner; DELETE profile with cascading focus and tokens atomically. |

The consumer API is read-only for product content but its handler writes retrieval
telemetry. A strictly SELECT-only database connection would not support that
handler. SQL privileges are a service boundary; server authorization enforces the
individual owner and token boundary.

Define a consistent transaction/lock order for retrieval, saves, rotation and
deletion. Concurrent operations must not resurrect a deleted credential/member,
overwrite newer content, or claim a version that was not served. A response can
represent the valid snapshot before a concurrent revocation; later requests must
fail. Never hold database locks while waiting on the model provider.

## Credentials and consumer API

Allow multiple named tokens per member. Generate cryptographically random
high-entropy secrets and store only a cryptographic verifier, never recoverable
plaintext. Reveal/hide/copy is available during issuance or regeneration only;
clear raw values when that interaction closes. Existing tokens show metadata and
suffix, not a revealable secret. Lost tokens must be regenerated. Regeneration
atomically replaces the verifier and invalidates the prior value on commit.
Deletion permanently revokes the token. No scheduled expiry is needed for the pilot.

Expose `GET /api/ai-member/position-focus` on the existing HTTPS service using
`Authorization: Bearer <token>`. The token determines the sole member; accept no
caller-selected owner/member identity. Return a typed JSON response containing
the AI-member ID/name and its objective, ordered SMART goals, focus version and
focus update timestamp. Omit human identity, department data, token metadata and
provider context. Document the exact response shape and a synthetic request example.

Successful retrieval updates member retrieval evidence (and token statistics if
implemented) before success is returned. Owner UI reads, invalid requests and
no-focus responses do not count. This records successful server-side retrieval,
not acknowledgement or proof that a consumer received or used the content.

Use generic 401 for invalid/revoked/suspended credentials; 404 with stable
`focus_not_configured` code for a valid credential before the first saved focus;
405 for unsupported methods, including an implicit HEAD bypass; 429 for bounded
per-instance request limiting; and 503 for storage unavailability. Prevent bearer
tokens from authorizing owner management or coaching. Preserve the browser API's
existing session/CSRF protections. Return `Cache-Control: no-store`, avoid secrets
and coaching content in logs, and bound request sizes and limiter memory. No
distributed limiter, Redis or additional service is required at this pilot load.

## AI coaching

Reuse current main's hosted provider integration and its configured primary and
fallback, validated output, cancellation and timeout handling. Share existing
per-human/global admission and rate controls with human coaching rather than
creating a separate route that evades those limits.

The only member-specific prompt context is the optional purpose and the current
objective/goal form inputs, including unsaved edits. Generic coaching instructions
are allowed. Do not automatically include names, emails, human focus history,
department direction, Guide content, other members, tokens or retrieval data.

Suggestions modify the pending form only when applied. Save remains explicit.
Validate output, preserve all goals appropriately, discard responses made stale by
form changes/cancellation, and make unavailable coaching compatible with manual
editing. Consumers cannot invoke the coach. Reuse existing environment settings;
verify their presence through operator instructions without exposing secrets.

## Required engineering evidence

Use repository TDD and isolated real PostgreSQL schemas for HTTP/browser flows.
Cover:

1. Eligibility and ownership isolation across two humans and multiple AI members;
   client-supplied ownership cannot grant access; ineligible navigation is absent.
2. Add/edit/delete persistence; validation; first focus, unchanged save, ordered
   goals, stale-write conflicts and retained failed edits; profile/focus revisions
   independent of retrieval updates.
3. Coach prompt data boundaries, shared limits, validated suggestions, cancellation,
   stale responses, explicit apply/save and provider failures without data loss.
4. Hash-only credentials, issuance-only reveal, multiple named tokens, atomic
   rotation, permanent deletion and no raw values in persistent/browser logs.
5. Consumer authorization, cross-member isolation, no-focus/unsupported-method
   errors, storage failures and accurate successful retrieval/version tracking.
6. Removing eligibility suspends tokens; restoring it resumes only still-valid
   tokens; browser sign-out has no effect; missing/empty allowlist disables.
7. Concurrent retrieval/save/rotation/deletion behavior and cascade cleanup.
8. Fresh installation and upgrade migration; runtime grants and prohibited writes;
   readiness/schema expectations and unchanged supported-product regressions.
9. Responsive accessible owner workflows and explicit empty manual fixture
   configuration; supported manual generation/freshness succeeds with no AI-member
   feature content.

Completion includes passing required repository checks, the implementation,
updated PRD/domain terminology and an ADR per repository conventions, current
operating instructions, regenerated supported manual where required, and a draft
PR with evidence. Keep the agreed contract coherent with the implemented result.

## Infrastructure and operator handoff

The owner reports `AI_MEMBER_MANAGER_EMAILS` already exists in both Railway
environments: staging contains the pilot owner's address; production is empty.
Preserve this setup. This is user-reported configuration, not an agent verification
that the changes are deployed. The actual address is recorded privately.

No additional Railway service, domain, database, volume, queue, encryption key or
SQL login is required. Use existing HTTPS and the normal schema migration path.
Existing coaching may require its current provider configuration if not already
enabled in staging; consult the current coaching operations guide. Keep production
disabled throughout this pilot.

After an independently authorized merge/release, the operator:

1. Follows the release guide for staging schema migration and application rollout;
   confirms the already-entered allowlist is applied to the running service.
2. Confirms existing coach configuration if using coaching, without sharing keys.
3. Signs in normally, creates a synthetic pilot member, saves a focus and issues
   a named token. Installs it in the consumer's secret storage with the service URL.
4. Checks a bearer GET returns that member's saved focus and retrieval evidence.
5. Uses the allowlist for reversible suspension, or token delete/regenerate for
   permanent credential revocation. Disabling the experiment retains stored data
   and the additive schema.

This build handoff authorizes local implementation, tests, commits, branch push and
a draft PR. It does not authorize merging, Railway edits, hosted migrations,
deployments or production access.

## Implementation references

[ADR 0013](../adrs/0013-experimental-ai-members.md) records the storage, lock and
trust boundaries. [Operating and API instructions](../operations/ai-members.md)
define exact response fields, limits and the later staging handoff. The supported
QA manual intentionally contains no experimental workflows.
