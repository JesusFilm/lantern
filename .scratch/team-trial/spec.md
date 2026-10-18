# Secure hosted team trial specification

Milestone: M06
Status: ready-for-agent
Date: 15 October 2026

This specifies the next milestone; it is not a claim that the behavior exists. [PRD](../../docs/PRD.md) is current product scope. Existing authoring and guides are retained.

## Current delivery decision — updated 19 October 2026

Authenticated staging is live on checked main revision `8e4cd805e9e5c88dea534823859191627ee8402c`, with schema version 2. Real Google work/personal login, member draft save/reload and career-lead read-only access have been observed. [Activation and workflow evidence](../../docs/operations/staging-activation-evidence.md) records this bounded manual proof; it is not full stage acceptance or automated release evidence. Google setup resumed successfully; the earlier hosting-only/provider-pause route is historical.

Production remains inactive and `STAGE_DELIVERY_ENABLED` remains unset/false. Local role separation is merged and preparation/rehearsal of staging transfer and empty-production setup is authorized. Hosted execution, credentials, permissions, workflow runs and delivery activation remain separately authorized; ticket readiness alone does not grant them.

The existing `ci.yml` stage job and `promote.yml` manual promotion workflow are merged. Stage automation lacks its token and two ordinary-member session secrets; no passing stage artifact exists. Ticket 11 is optional promotion-UI simplification, not a prerequisite for the existing explicit SHA/run workflow. Confirm-and-lock (03), full acceptance, recovery and production access governance remain required. A narrower draft-only production pilot would require an explicit scope change.

Manual release promotion still requires one authorized operator, not a separate reviewer. Ticket 12 assigns production approval/execution to Jaco; agents must prepare, rehearse and guide the work through verification and recovery, without production access.

## Identity and approved participants

Use verified Google identity and stable Google subject identity. Every environment requires an exact normalized email in its own database allowlist before issuing an application session. Production additionally requires an approved Google hosted domain and rejects personal accounts. Local development and stage also admit explicitly approved personal Google accounts without a hosted-domain claim; work accounts retain domain checks. This is normal Google authentication, not the local walkthrough bypass. Use a small repository-owned parameterized operator procedure, with no app administration/invitation UI. The earlier direct-database approval choice does not authorize unrestricted production access: production operations must satisfy tickets 12 and 13 before use. Stage has an independent QA allowlist.

Every authenticated request must recheck current approval so removing an approved email invalidates existing access without waiting for session expiry. A fresh provider login revalidates the email claim; never use a client-supplied email, user ID, department or role to gain authority. An allowlist entry permits registration/sign-in only; active membership remains necessary for guide/focus/team data. Bootstrap is: approve the lead email and its work domain, Google sign-in, existing backend team/lead setup, then approved members sign in and lead assigns membership. In stage, Jaco uses the lead account and his separately approved personal Google account as a member; repeat with QA participants. Full isolation acceptance still requires at least two member accounts. Former memberships are not silently restored. Empty allowlist denies hosted sign-in. Approval must never imply career-lead role.

Unauthenticated and unapproved actors receive no protected data. Existing sessions lose access after approval removal or removal of a work account's allowed domain; membership removal denies team data while preserving historical documents. Keep the local walkthrough bypass opt-in, loopback-only and impossible under NODE_ENV=production in both stage and production. Admission policy must distinguish local development, stage and production explicitly on the server: NODE_ENV cannot distinguish stage from production because both use production runtime mode. Missing or invalid environment identity must never enable personal-account admission; production cannot select that exception. Recheck the appropriate environment policy for sessions and member assignment, not just the Google callback. The public health endpoint may report dependency availability without personnel data.

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

Railway stage and production each have an application and PostgreSQL service, independent variables/secrets, domains, OAuth clients/callbacks and approval data. Local development has its own Google client/callback configuration and test database/approvals. Configure and verify real Google login in all three environments; keep credentials and real email approvals outside Git. QA uses real authenticated approved accounts with disposable synthetic focus content. Do not copy production personnel data to stage. Both hosted apps set NODE_ENV=production, disable LOCAL_ACCESS, listen on Railway's port/interface and serve the compiled client.

Repository scripts must run with injected environment variables and no .env file, while preserving current local commands. Provide compiled operator and migration entrypoints. Migrations must preserve existing records, work on an empty database and be safe to rerun/serialize; introducing lock/allowlist data must not reset existing documents or memberships. Run privileged migrations in a separate human-invoked process, absent from the application service, with a documented compatible rollout order. Readiness probes use /health; startup/migration failure must not route traffic to a broken revision.

Implement GitHub Actions checks on pull requests targeting main and on the actual merged main revision: typecheck, real PostgreSQL HTTP/browser regressions and production build. Require those PR checks before merge through repository rules, and gate automatic Railway stage deployment on successful checks for the same main SHA. Failed, cancelled or missing checks must prevent deployment; do not rely on an independent merge-triggered Railway deployment racing CI. Stage deployment waits for migrations and readiness, then runs automated stage smoke/E2E checks with isolated synthetic QA records. Record which checks are automatic and which real-provider/newcomer checks require human evidence. Production automatic deployment is disabled; an operator explicitly promotes only a revision with passing CI and stage evidence. The workflow provider is an implementation choice for this GitHub repository; platform configuration and repository rules are verified during environment setup. Release records bind Git SHA (and image digest if used), stage deployment, checks, practical QA result, schema version/migrations, backup and operator promotion to a particular production deployment. If main moves, select the tested commit; never promote latest blindly. Changed code requires new verification.

Record backup retention and perform an isolated restore rehearsal before production data collection. Verify records can be read after restore. Application rollback and database recovery are different: rollback code only when schema-compatible; destructive migration recovery requires a separately planned procedure. Do not reset local or production data during testing.

## Production access governance and release prerequisites

Production access governance is a release prerequisite, not a deferred administration feature. Ticket 12 records accountable owners, effective provider/database access, data-change approvals, emergency access and audit policy. Ticket 13 enforces distinct runtime/migration/administrative privileges, controlled target-verified operations, restricted interactive access, protected audit records and revocation. A runbook or Git change record does not itself restrict database writes. Do not claim that application controls constrain unrestricted provider administrators; record residual powers and accepted risks.

Keep procedures, migrations, sanitized configuration and release references under review in Git. Keep credentials, actual allowlists, personnel data and sensitive audit details in protected storage. Test forbidden operations under restricted identities as well as successful operations. No production privileged enrollment is allowed merely because the same command worked on stage.

Ticket 14 owns reproducible effective Railway settings; checked-in railway.json alone failed to configure this new service. Ticket 15 proves automated release gates and documents that the existing acceptance URL is an operator sign-off boundary, not a machine-validated QA document. Ticket 16 owns approved backups and isolated recovery proof. Ticket 17 creates and verifies production roles/tables after staging transition and recovery proof, with the application inactive; its findings feed ticket 13. These converge with confirmation/locking on ticket 06, then separately authorized application promotion under 07. The existing production smoke covers public readiness, not authenticated workflow acceptance.

## Acceptance and exclusions

Automated tests use public browser/HTTP behavior with isolated real PostgreSQL schemas and external provider injection. Cover persistence, ownership/role isolation, approval revocation, lock races, failure paths and production configuration. Real Google and multi-account stage checks are additional acceptance evidence. A newcomer drafts with the guides, lead finds/reads/confirms, two members cannot access each other, locked content survives reopen, and the promoted revision receives a production smoke check.

Implementation priority is hosted runtime and CI first, approved access next (independently buildable), then environment/Google setup as soon as those foundations are ready. Lead browsing and confirmation can proceed alongside setup according to their dependencies. Full stage acceptance requires all feature work; later milestones stay deferred.

No admins, multiple-team support, multiple leads, role transfer UI, invitations, submission queues, scheduling, notifications, midyear/year-end editing, summaries, AI or guide customization in this milestone. See [breakdown](breakdown.md) for dependencies and [Railway research](../../docs/research/railway-team-trial.md) for current platform facts. Real account/configuration inputs belong to operator setup, never source-controlled tickets.
