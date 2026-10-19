# Lantern — small team trial

Status: current product direction, reconciled 15 October 2026. This planning increment preserves and reviews the delivered application, merges it to origin/main, and prepares implementation tickets. It does not implement or deploy the next milestone.

## Outcome and people

Get Lantern in front of a small invited group to learn whether members can prepare a useful position focus and the career lead can read and confirm it. One Engineering team, one career lead (Jaco), and members. No administrator role or multiple-department product workflow is required.

Members manage their own draft focuses and read the guides. The career lead sees the member list, opens each member's focuses, and confirms an agreed focus after discussion. Other members cannot see that person's focuses. The career lead's extra access is read plus confirmation; editing another person's draft is not included.

## Delivered baseline

The accepted Refine 4 application persists titled, dated focuses, objectives and SMART goals, including optional Personal Development and Leadership types. It opens documents in a compact read view and edits through spacious dialogs. Guides are separate: three objective steps, five SMART steps and a generic example with one objective and two goals. Account display names persist. Empty and partial drafts are valid.

PostgreSQL persistence, server-resolved identity/membership, owner/department isolation and optimistic save conflicts exist. Google/session code exists but real Google access has not been verified. The private VM walkthrough uses a single shared local account; it is not hosted team access. Career-lead focus browsing and confirmation locks do not exist yet.

The user accepted this minimal application. The old full engineering example, mission/context banner, gaps/next-step fields and guide review-process content were intentionally removed from the active experience. Do not restore them from historical tickets.

## Next: M06 — run a secure hosted team trial

- Google sign-in requires verified identity and an exact email pre-approved directly in the environment database. Production also requires an approved work hosted domain; local development and stage admit explicitly approved personal Google accounts for QA. Active membership and server-assigned roles remain mandatory. No signup, invitation or approval administration UI. Use separate local/stage approvals; Jaco is stage career lead and his personal account is an ordinary member.
- Members read/edit only their own drafts and read their confirmed focuses. The career lead reads all current members' focuses in the team. Membership removal ends member access and preserves records; no other-team access or role grants from client input.
- The career lead confirms and locks after discussion with the member, as explicitly chosen by Jaco. Store who confirmed and when. Confirmed title, dates, objectives and goals become immutable on the server. There is no submission queue or additional approver.
- Deploy isolated Railway stage and production environments, each with its own database, secrets and Google callback. Configure Google for local development, stage and production. Required PR/main CI checks pass for the selected revision, followed by recorded manual staging acceptance. Production autodeploy stays disabled; Jaco performs the guided release of that exact accepted revision. IaC and automated delivery/session/artifact gates are deferred for the trial.
- Verify real Google access, multiple accounts, persistence, lead visibility, privacy, locks, errors and recovery before a limited production trial. Record observed results separately from automated evidence.

The [M06 specification](../.scratch/team-trial/spec.md) and [tickets](../.scratch/team-trial/breakdown.md) define acceptance and dependencies. New implementation remains a subsequent task; ticket readiness does not claim delivery.

## Deferred direction

Anticipated phases are initial draft/confirm, midyear adjustment/review, and year-end review/retrospective. Only initial confirmation is next. Later work should preserve the confirmed baseline, likely by a lead-initiated linked draft copy; exact copying, version navigation, correction/unlock rules and retrospective content need a later decision. The existing save version is concurrency protection, not historical versioning.

Catch-up notes, requests/submission, notifications, schedules, dashboards and shared summaries, administrators, multiple departments/leads/memberships, guide editing and broad lifecycle management are parked candidates. They are not promised future requirements. January 2027 is a historical provisional target, not a current commitment. See the [roadmap](ROADMAP.md) and [deferred register](../.scratch/position-focus-guide/deferred.md).

## Scope and completion

This reconciliation is complete when the delivered code and applicable uncommitted project work have passed review and verification and are merged to origin/main, with M06 specified and its next implementation tickets ready. M06 itself is complete only after stage acceptance and a checked production promotion; these are separate outcomes.

Personnel records, approved real emails and credentials stay outside Git. Preserve current local data and the retained prototype worktree/viewer. Prototype controls and assets are not runtime dependencies of the application.
