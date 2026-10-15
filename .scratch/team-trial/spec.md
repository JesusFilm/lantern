# Secure hosted team trial specification

Milestone: M06
Status: ready-for-agent
Date: 15 October 2026

This specifies the next milestone; it is not a claim that the behavior exists. [PRD](../../docs/PRD.md) is current product scope. Existing authoring and guides are retained.

## Identity and approved participants

Use the existing Google work-account flow and stable Google subject identity. A successful identity must have a verified email, allowed hosted domain and exact normalized email present in an environment-local database allowlist before issuing an application session. Jaco explicitly chose direct production-database approval; supply a small documented parameterized operator procedure, no app administration/invitation UI. Stage has an independent QA allowlist.

Every authenticated request must recheck current approval so removing an approved email invalidates existing access without waiting for session expiry. A fresh provider login revalidates the email claim; never use a client-supplied email, user ID, department or role to gain authority. An allowlist entry permits registration/sign-in only; active membership remains necessary for guide/focus/team data. Bootstrap is: allowlist lead email + hosted domain, Google sign-in, existing backend team/lead setup, then approved members sign in and lead assigns membership. Former memberships are not silently restored. Empty allowlist denies hosted sign-in. Approval must never imply career-lead role.

Unauthenticated and unapproved actors receive no protected data. Existing sessions lose access after approval/domain removal; membership removal denies team data while preserving historical documents. Keep local mode opt-in, loopback-only and impossible under NODE_ENV=production in both stage and production. The public health endpoint may report dependency availability without personnel data.

## Access matrix

| Actor | Own focus list/read | Own draft edit | Other member focus list/read | Confirm member focus | Team roster |
| --- | --- | --- | --- | --- | --- |
| Unauthenticated/unapproved | No | No | No | No | No |
| Approved, no active membership | No | No | No | No | No |
| Active member | Yes | Yes | No | No | No |
| Active career lead | Yes | Yes | Yes, same team/current member | Yes, same team/current member | Yes |

The lead retains ordinary member capabilities for their own focus and can confirm it after their discussion process; no separate approver is introduced. The lead cannot edit another member's draft. Every list/detail/mutation resolves active membership and authority server-side and scopes persistence queries accordingly. Guessed focus/member identifiers cannot reveal another member or team; unauthorized detail lookups should not confirm record existence. Removing membership retains the stored baseline; historical-member browsing/rejoining is deferred. An already loaded page cannot be remotely erased, but account/membership changes must clear stale data on refresh/focus and subsequent requests must fail.

## Member and lead screens

Keep the current read-first focus workspace, title/date editing, objective types, dialogs, guide side navigation, concise example and account display-name editing. Hide team-member navigation for ordinary members. The career lead sees current members by display name/email, can open the selected member's list (including an empty state), then read a particular focus. Show whose focus is open and a clear path back to the member/list. Avoid aggregate dashboards or arbitrary filtering. HTTP authorization must match the visible restrictions.

## Initial draft → confirmed lifecycle

New and existing focuses start as draft. Members can save incomplete drafts. After discussing with the member, the career lead explicitly chooses Confirm and lock, reviews the target focus/person, and confirms the action. No submit/request state is needed. Confirmation means agreement on a baseline, not achievement of its goals.

For a buildable initial completeness check, confirmation requires at least one Normal objective with at least one non-empty SMART goal, as well as valid title/dates and existing structural validation. Other objective types remain optional; no prose-quality scoring or extra mandatory fields. Explain unmet requirements without changing the draft.

The server stores confirmed status, confirmation timestamp and confirming user ID. Confirmed title, dates, objectives and goals are immutable for members and leads; reject all update paths, including forged requests and stale open dialogs. There is no unlock, delete or copy action in M06. Future review work must preserve the original baseline.

Confirmation takes the expected save version and uses an atomic state/version transition. If an edit wins the race, confirmation fails with a conflict until the lead rereads; if confirmation wins, later edit fails. Duplicate confirmations must not replace original actor/time or produce a second event; return an unchanged confirmed result or clear conflict. Failed authorization, validation or storage writes leave content/state unchanged. The UI shows status and confirmed time/actor and retains unsaved dialog text with an explanation when an edit is rejected. The current integer version remains a stale-write guard, not historical version storage.

## Hosted delivery and operations

Railway stage and production each have an application and PostgreSQL service, independent variables/secrets, domains, OAuth clients/callbacks and approval data. QA uses real authenticated approved accounts with disposable synthetic focus content. Do not copy production personnel data to stage. Both hosted apps set NODE_ENV=production, disable LOCAL_ACCESS, listen on Railway's port/interface and serve the compiled client.

Repository scripts must run with injected environment variables and no .env file, while preserving current local commands. Provide compiled operator and migration entrypoints. Migrations must preserve existing records, work on an empty database and be safe to rerun/serialize; introducing lock/allowlist data must not reset existing documents or memberships. Separate predeploy migration from normal server startup as appropriate, with a documented compatible rollout order. Readiness probes use /health; startup/migration failure must not route traffic to a broken revision.

Run typecheck, real PostgreSQL HTTP/browser regressions and production build on the reviewed revision. Stage may deploy reviewed main commits with checks. Production automatic deployment is disabled. Release records bind Git SHA (and image digest if used), stage deployment, checks, practical QA result, schema version/migrations, backup and operator promotion to a particular production deployment. If main moves, select the tested commit; never promote latest blindly. Changed code requires new verification.

Record backup retention and perform an isolated restore rehearsal before production data collection. Verify records can be read after restore. Application rollback and database recovery are different: rollback code only when schema-compatible; destructive migration recovery requires a separately planned procedure. Do not reset local or production data during testing.

## Acceptance and exclusions

Automated tests use public browser/HTTP behavior with isolated real PostgreSQL schemas and external provider injection. Cover persistence, ownership/role isolation, approval revocation, lock races, failure paths and production configuration. Real Google and multi-account stage checks are additional acceptance evidence. A newcomer drafts with the guides, lead finds/reads/confirms, two members cannot access each other, locked content survives reopen, and the promoted revision receives a production smoke check.

No admins, multiple-team support, multiple leads, role transfer UI, invitations, submission queues, scheduling, notifications, midyear/year-end editing, summaries, AI or guide customization in this milestone. See [breakdown](breakdown.md) for dependencies and [Railway research](../../docs/research/railway-team-trial.md) for current platform facts. Real account/configuration inputs belong to operator setup, never source-controlled tickets.
