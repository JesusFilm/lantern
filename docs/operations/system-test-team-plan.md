# Draft plan for isolated system test accounts

Status: Proposed for discussion, 21 October 2026. No application implementation or
environment activation is authorized by this draft.

Provide three permanent password logins per environment: one career lead and two
members in a dedicated system-test department. Exercise the deployed application
through its normal screens and HTTP interfaces, then reset only that workspace to
a known baseline. Keep the accounts; remove the content created by each run.

Production requires stronger isolation than the earlier staging-only runner.
[PR 31](https://github.com/JesusFilm/lantern/pull/31) currently implements temporary
accounts and direct session creation using staging's migration credential. Its
browser journeys and evidence checks are reusable; its provisioning credential,
session creation and deletion lifecycle are not the proposed production design.
Keep the PR in draft and delivery switches off while this replacement is decided.

## Permanent identity and disposable content

Each environment has its own department UUID, account UUIDs, passwords, password
hashes and control credentials. The three account labels can be stable in code;
passwords and environment-specific identifiers must not be hard-coded. Use clearly
reserved identifiers such as `lead@lantern-system-test.invalid`; these are login
names, not mailboxes or Google identities.

An immutable, operator-provisioned registry binds each account to the system-test
workspace and its permitted role, independently of current membership. This is
essential while a member is temporarily unassigned during the enrollment test.
Normal users cannot join the test department; test accounts cannot join real
departments. Neither email spelling, a department name, nor a request parameter
establishes test authority.

The idle baseline is three approved test identities with one active lead and two
active members, default display names, no focuses, and blank department direction
with no custom image or initiatives. Baseline identities are intentionally retained.
Decommissioning them is a separate owner operation, not routine run cleanup.

## Current gaps that must be addressed

The findings below apply to main `f38027c` and the current PR implementation.

| Current behavior | Consequence | Proposed response |
| --- | --- | --- |
| The registered-user directory returns all accounts and their department names. | Real leads can discover test accounts; the test lead can discover real people. | Filter on the server in both directions, including unassigned accounts. UI hiding is insufficient. |
| Enrollment accepts any approved unassigned account. | A test lead could enroll a real unassigned user; a real lead could enroll a test user during setup. | Enforce immutable workspace compatibility inside the database enrollment function as well as request handling. |
| Department setup refuses a second department. | The ordinary setup command cannot provision the test team alongside the real one. | Add an explicit, idempotent owner provisioning operation for the reserved test workspace. Preserve normal setup behavior. |
| Focus HTTP routes have create/read/update/confirm, but no whole-document deletion. | Even draft focuses accumulate; the lead cannot remove them. | Use the restricted reset operation for whole focuses. Consider ordinary draft deletion separately only if users need it. |
| Confirmation locks content; no unconfirm operation exists. | A confirmed focus cannot be emptied through normal editing. | Reset may permanently delete confirmed synthetic focuses only. Keep real history immutable. |
| Saved initiatives must be preserved; only archive/restore is supported. The limit is 100 total entries. | Archiving one new initiative per run still grows the document and eventually prevents creation. | Reset the entire test direction record after deleting test focuses and their snapshots. |
| Membership removal is an operator-only soft deletion; rejoining and lead removal are unsupported. | Normal UI actions cannot reset enrollment or remove the team. | Restore exact synthetic memberships through the restricted reset operation. Do not add general rejoining or lead-deletion features for test convenience. |
| Runtime has table-wide grants but no row-security policies. Admin and migration credentials can affect real data. | Existing app-level scope checks alone do not constrain an erroneous privileged cleanup query. | Give cleanup a dedicated execution-only credential. For production, add database-enforced isolation for synthetic product requests too. |
| All focus/direction/membership writes share advisory lock `603106`. | A test write or reset can block unrelated real-team writes. | Replace routine global serialization with department-scoped locking and account-scoped enrollment locking, using a consistent lock order. Preserve concurrency guarantees. |
| Users require `google_sub`; normal registration upserts a Google identity and prunes all expired sessions. | Reusing registration as password authentication would blur identity types and touch unrelated session rows. | Model a distinct system-test authentication kind and share only normal session issuance primitives. Scope test maintenance to test identities. |

Evidence: [access and directory](../../server/access.ts),
[enrollment](../../server/enrollment-migration.ts),
[membership and locking](../../server/membership.ts),
[focus HTTP](../../server/focus-http.ts), [focus persistence](../../server/focus.ts),
[direction rules](../../server/direction.ts), [identity/session registration](../../server/accounts.ts),
[schema](../../server/schema.ts), [database grants](../../server/database-privileges.ts).

## What each run creates and how it is removed

| Data or feature | Exercise through normal application behavior | End-of-run treatment |
| --- | --- | --- |
| Login and sessions | Correct/incorrect password, cookie delivery, expired/revoked access, sign-out and new login. | Revoke all sessions for the three test accounts. Bound failed-login records separately; do not erase security rate limits on reset. |
| Account names | Edit, cancel, save, reload, sign in again and verify persistence. | Restore the three default names; retain identity IDs and credentials. |
| Enrollment | At run preparation, make member B unassigned. Verify the waiting screen; lead finds and adds B; verify new access and ordinary-member privileges. | Restore both members as active and the fixed lead. Only the control operation may remove/reset synthetic membership history. |
| Position focuses | Create an empty draft and dated documents; edit metadata; reload and navigate Back/Forward. | Physically delete every focus owned by the registered workspace, including confirmed documents, after validating the complete ownership graph. |
| Objectives and SMART goals | Add/edit/remove normal, personal-development and leadership objectives and goals; test cancellation and stale saves. | Normal removal exercises product behavior while still draft. Whole-focus cleanup removes the remaining JSON content. |
| Initiative alignment and history | Select several initiatives and Other; rename/archive/restore; verify saved/confirmed snapshots behave correctly. | Delete focuses first, then clear initiatives. Snapshots live in focus JSON rather than separate history tables. |
| Mission and artwork | Save/clear mission; upload, replace, remove and restore artwork; verify member view and reload. | Restore blank mission, null artwork and an empty initiative list. Custom artwork lives in PostgreSQL, so no object-storage purge is needed. Preserve normal optimistic-version semantics. |
| Lead confirmation | Lead reads members' focuses, confirms, then both users see locked content; rejected edits leave it unchanged. | Synthetic-only reset deletes confirmed focuses without weakening ordinary confirmation rules. |
| Access isolation | Members cannot read/edit each other's focuses; members cannot use lead actions; lead cannot edit member drafts. | No extra records beyond the existing test documents. Failed requests must leave them unchanged. |
| Guide and navigation | Open lessons/example; exercise navigation, reload and a narrow viewport. | No persisted guide data exists to clean. Close browser contexts. |
| Real Google authentication | Separate real-account acceptance when authentication/configuration changes. | Password test accounts cannot establish that Google login works. |
| Future weekly reports, notifications or exports | Not currently implemented. | Any future persisted table or external side effect needs an explicit test-isolation and cleanup decision before joining the live suite. |

Four focuses total and ten initiatives are proposed initial workspace caps, enforced
by the server transactionally, not merely by the test script. Keep one bounded
mission image and cap test sessions per account (for example, three). Reuse these
limits for manual test use. The same three accounts and department remain after
any number of runs; new runs never create additional accounts to escape failures.

Three accounts in one department prove member isolation, but cannot independently
prove live cross-department denial. Keep that coverage in isolated PostgreSQL and
staging tests with an additional synthetic outsider. If live production checks
must prove it too, provision a fourth synthetic account and a second tiny canary
department with known synthetic records. Never probe actual employee records or
sign in as a real employee to perform this test. Decide this expansion explicitly.

## Password login and production isolation

Use a dedicated test-login page. Email and password authenticate only the three
preprovisioned identities; the route cannot register users, attach a password to a
Google account, select a role/department, or impersonate an arbitrary user. The
application must reject Google-account linking to reserved test identities and
detect provisioning collisions before changing data.

Store salted password hashes in protected server configuration, with a separate
high-entropy password for every account and environment in the appropriate GitHub
environment secrets. Human testers use the approved secret store. Use a maintained
password verifier with Argon2id, bounded verification concurrency, generic failures,
and account/IP throttling that works across application instances. Limit request
sizes, verify origin, use HTTPS and secure HttpOnly cookies, rotate sessions on
login, and keep their lifetime short (15 minutes proposed). These controls follow
[OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
and [authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

Production enablement is explicit and defaults off. Turning it off or rotating the
credential generation must also invalidate existing test sessions. Keep normal
Google sign-in configured and working. Test-login exceptions must not skip the
normal ownership, membership, validation or confirmation rules.

For production, recommend a separate restricted database role for requests from
authenticated test identities, using the same domain implementation but with
row-level policies limiting that role to registered synthetic data. Choose the
role from server-resolved identity, never a client header or email alone. Authentication
bootstrap access must also be narrow; test credentials cannot query the human
session or user directory. Review enrollment's privileged function explicitly,
because a security-definer function can bypass caller policies. Normal-user views
must exclude test identities even when they have no membership.

This requires migrations and changes to request/database context handling. It
provides a stronger guard against a missing scope predicate than application checks
alone. PostgreSQL owners and privileged roles can bypass row security, so the test
runtime role must be neither an owner nor a bypass role. See
[PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
The dedicated role does not prove that the separate human runtime role has correct
grants; retain existing runtime-privilege tests and real-user acceptance for that.

Same application and database means shared CPU, storage, logs, backups and deployment
availability. A separate department cannot promise zero operational impact.
Use one run at a time, small uploads, hard quotas and short lock/statement timeouts;
perform load tests and injected database outages only in isolated environments.
If physical isolation is required, use a separate database/deployment and accept
that it no longer verifies the exact production data path.

## Restricted reset instead of general deletion powers

Recommend an operator/CI script first, not a public reset endpoint and not new
destructive powers for ordinary career leads. The script uses a new, environment-
specific database credential that can execute only fixed system-test control
operations. It has no direct table mutation, schema creation, role management,
TRUNCATE, or access to real-user content. The webapp does not receive this control
credential. The original PR's migration credential must not be reused here.

The control module owns `beginRun`, `finishRun`, `recoverExpiredRun` and a bounded
status result. Its database interface resolves the provisioned workspace internally;
callers provide a run token/generation, never arbitrary department IDs, user IDs,
SQL, table names or deletion filters. Privileged database functions use a fixed
search path, revoke PUBLIC execution, and validate the full synthetic ownership
graph before changing anything. Registry changes and provisioning remain owner-only.

Reset first fences the run against further writes, revokes its sessions and locks
its roots. It checks every focus owner, department, confirmer, membership and
identity binding. A real account attached to test data, a synthetic account attached
to a real team, or an unknown dependency stops cleanup and quarantines the workspace.
Do not repair ambiguity by deleting the unexpected account or expanding a filter.

Within an atomic transaction, reset deletes the workspace's focuses, clears its
direction/image/initiatives, restores names and baseline memberships, and verifies
zero remaining test content and sessions. Registry IDs and credentials remain.
Do not use broad email-prefix deletion, TRUNCATE, or cascading deletion of unknown
future tables. Repeating cleanup for the same completed run is harmless; an old
run token cannot reset a newer run.

The application has in-flight requests: deleting cookies or sessions alone is
insufficient. Test writes must revalidate the current run generation and lease
under the same workspace lock used by reset. Old tabs and a disconnected runner
must be unable to write data back after cleanup commits. Version and session
generation handling must prevent an old direction draft matching a reset version.

A later test-lead “Reset test workspace” button could invoke this same guarded
operation with separate authorization, but it adds an exposed destructive route
and is not needed for the first implementation. Standard member/lead credentials
should not grant the control capability.

## Run lifecycle and bounded recovery

1. Verify the intended environment, origin, release SHA/deployment/schema and the
   immutable workspace registry. Acquire a renewable, expiring workspace lease.
   An active manual session or CI run makes the workspace busy; do not steal it.
2. Recover expired work, invalidate old sessions, verify the baseline, allocate a
   new run generation and prepare member B for the enrollment journey.
3. Log in through the password page as the three users. Exercise the normal product
   workflows above. The browser runner receives no cleanup or migration credential.
4. Always attempt cleanup after success or failure. Verify the baseline independently
   through the restricted control status and confirm revoked sessions are denied.
5. Record separate journey and cleanup results, bound to SHA, deployment, schema,
   environment, suite version, CI run/attempt and workspace generation. Overall
   success requires both results. Emit counts and safe checkpoints, not document
   contents, passwords, cookies, traces or screenshots of account directories.

An initial proposal is a 15-minute CI lease, a maximum one-hour manual reservation,
and an independently scheduled recovery check every five minutes. Only expired
leases may be recovered. If cleanup cannot safely complete, stop new writes and
alert the owner; keep bounded diagnostic metadata and retry only after inspection.
Server-enforced quotas prevent accumulation even when the recovery job is unavailable.

Manual testing uses the same reservation rules and a visible “Disposable system
test workspace” notice. All content entered through these logins is disposable.
Sharing three accounts means CI and humans must take turns. Additional permanent
workspaces are a later decision if this becomes inconvenient.

Retain only the latest bounded run summaries, for example 100 summaries with a
30-day maximum age. External CI artifacts and hosting logs need their own retention
settings. Deleting rows does not instantly reclaim PostgreSQL files or erase WAL
and backups; normal database maintenance and backup retention still apply. Synthetic
content may remain in those backups until they expire. No real content belongs here.

## Delivery sequence and proof required

Implement in small reviewed slices using real PostgreSQL and browser/HTTP tests:

1. Provisioned identity/workspace registry, bidirectional directory filtering,
   enrollment constraints and database-enforced isolation. Prove that malformed
   bindings and arbitrary identifiers cannot grant access or affect real-like
   control fixtures, including unassigned accounts.
2. Password authentication and ordinary sessions, testing rejection, throttling,
   rotation, disablement and session fixation. Retain Google authentication tests.
3. Restricted control credential, leases, quotas and atomic reset. Prove direct
   SQL and unapproved function calls are denied. Test wrong environment, partial
   provisioning, foreign relationships, old run tokens, concurrent/manual runs,
   process death, lost connections, stale requests and cleanup rollback.
4. Extend the existing browser journey with password login, enrollment, objective
   and goal removal, initiative lifecycle, image removal/restoration, two-member
   writes, and baseline verification. Run twice and recover an interrupted run;
   record counts must return to the same baseline each time.
5. Rehearse on staging. An owner provisions production separately after reviewing
   the isolation evidence; no existing production credentials or data need to be
   read for this design work. Apply the additive migration through manual release.
6. Run the same bounded journey after production deployment, with production-only
   credentials. A production failure marks the release verification failed, alerts
   the owner and blocks later automatic promotions until acknowledged. It cannot
   prevent the deployment that just occurred; do not automatically undo migrations.

Use adversarial real-like fixtures and database permission checks in local/isolated
tests to prove noninterference. Do not compare, copy, log or snapshot actual employee
records as part of production acceptance. An exhaustive regression suite still
belongs in CI; the hosted journey covers each implemented product area without
injecting infrastructure failures into a live environment. Google login, unsupported
features and production backfill safety remain explicit coverage limits.

## Decisions to settle before implementation

| Decision | Recommendation and consequence |
| --- | --- |
| Production isolation strength | Use a dedicated test runtime database role with row-level restrictions plus application ownership checks. App-only checks are less work but do not meet the intended protection against an erroneous unscoped query. Physical separation trades away fidelity to the production data path. |
| Three accounts or a fourth outsider | Keep three permanent accounts for the core journey. Add a fourth/canary department only if live production cross-department testing is required; otherwise prove that case locally and on staging. |
| Reset ownership | Use the restricted operator/CI script. Add a test-only lead reset action later only if manual testing needs it. Do not add ordinary focus/confirmed-history deletion solely for QA. |
| Manual data and scheduling | Treat all test-account content as disposable; serialize manual testing and CI. Confirm the proposed lease durations, quotas and retention. |
| Production failure behavior | Mark verification failed, alert the owner and pause later automatic promotions. Agree the operational owner and alert destination; no automatic rollback. |
| Provisioning and credentials | Identify the owner who provisions production, stores/rotates six environment-specific passwords and the restricted database credentials, and can disable the test facility. No public password-reset or account-management system is proposed. |

Acceptance of these choices should replace the relevant parts of
[ADR 0006](../adrs/0006-authenticated-release-acceptance.md) through
[the proposed ADR](../adrs/0007-isolated-system-test-accounts.md) before application
implementation. No additional general administration, tenancy UI or deletion product
features are part of this plan.
