Kind: ticket
ID: team-trial/13
Title: Enforce and audit production administrative access
Milestone: M06
Type: task
Status: needs-info
Blocked by: Hosted authorization and remaining provider/production verification
Implementation: Staging role separation and schema-3 transition reported complete; production/provider enforcement remains outstanding
Slice: Hosted team trial

---
## Outcome

Implement and verify the policy agreed in ticket 12 and repository-root AGENTS.md before production activation. Policy decisions and Jaco’s manual superuser findings are recorded; the complete provider inventory and hosted enforcement remain outstanding. Local code and isolated synthetic-data execution were explicitly authorized on 2026-10-19. Hosted changes and production execution remain outside that authorization. No new admin UI, second approver or bespoke tamper-proof audit service is required for the initial trial.

## Database transition preparation — 19 October 2026

The approved local slice now covers the existing schema-2 staging transfer, explicit
empty-database bootstrap, read-only scope verification, and recovery rehearsal.
[Procedure and evidence](../../../docs/operations/database-transition.md) distinguish
prepared scripts from hosted execution. Ticket 17 is the human production database-only
checkpoint after staging transition proof; its reported findings feed this ticket.
Do not require full closure of 13 before 17 can establish those database controls.
The broader application/provider privacy boundary and operational controls remain open.

## Remaining implementation checks

- [ ] Inventory Railway roles, SSH/console and secret access, database grants/network paths and deployment-token scope. Jaco performs production-side inspection and supplies sanitized findings; agents inspect/test only separately authorized local/staging environments. Document residual provider-owner powers and runtime-shell/data exposure without assuming superuser grants.
- [ ] Separate runtime, migration and administrative credentials/privileges. Verify runtime cannot change schemas or perform privileged administrative operations. Keep versioned migrations in a human-triggered runner; controlled administrative scripts are executed by Jaco. Do not weaken application authorization to facilitate operations.
- [ ] Verify agent-accessible local/staging credentials cannot reach production or retrieve its secrets through Railway, CI or other available paths. Scope delivery credentials to required environments/actions; prevent interactive production administration by agents. Resolve platform limitations explicitly before activation.
- [ ] Provide controlled, parameterized scripts for routine dogfooding enrollment, assignment of Jaco as career lead, exceptional corrections and requested removal. Include environment/project/database checks, proposed effect and expected row counts, abort conditions, transactions where supported, verification and recovery. Use placeholders for production identities/values; Jaco fills them privately. Additional career leads remain outside scope.
- [ ] Establish the sanitized `docs/operations/production-changes.md` template and handoff process: planned entry before routine execution, then applied/failed outcome, date, reason, script version/digest, effect, executor, verification and cleanup based on Jaco's sanitized report. Retain entries for repository lifetime. Verify sanitization and clear distinction between prepared and executed changes. A self-reported log is not authenticated, tamper-proof audit evidence; document available provider attribution and its limitations rather than claiming otherwise. No PR or organizational Changelog submission is required per operation.
- [ ] Test positive and negative access cases with synthetic data in isolated PostgreSQL/staging: member/lead visibility, cross-member denial, wrong target, unexpected affected-row count, forbidden runtime DDL/admin actions and revoked access. Verify actual denied paths rather than intended settings alone. Agents receive no real conversation data or sensitive production output.
- [ ] Verify event-based access review and prompt revocation on joining/leaving/responsibility changes, pre-activation review, potentially exposed credential rotation/revocation, and removal of task-specific grants/credentials after console use. Closing a session is not credential revocation. Jaco's normal owner account remains trusted; no recurring review ceremony or fixed duration is imposed.
- [ ] Keep the existing sanitized change record and emergency policy usable; no separate emergency-policy rehearsal or administrative framework is required for the trial.
- [ ] Test member-requested removal and verification with synthetic data. Identify backup copies and recovery handling to prevent inadvertent reintroduction of removed records. Describe actual deletion limits honestly; do not invent a retention schedule or require another policy exercise.
- [ ] Update runbooks and collect sanitized evidence of the checks above, including Jaco's production-side findings where necessary. Keep actual identities, credentials, conversation content and sensitive inventory outside Git/agent context. Publish reviewed implementation/evidence before marking enforcement complete. Any unverified or unenforceable required boundary keeps production inactive until Jaco explicitly resolves it.

## Boundary

The local database-role slice was authorized on 2026-10-19; see [implementation and unexecuted handoff](../../../docs/operations/database-privileges.md). The later staging execution record below supersedes the original unexecuted staging handoff. Keep production inactive and automatic staging delivery disabled. Do not change hosted infrastructure, permissions, credentials, databases or delivery switches, or run deployment workflows. Work outside the authorized local slice requires explicit scope and TDD for application changes; agents remain prohibited from production access even then. Member-requested removal is policy, not authorization to delete data now. These checks do not replace the separate release, recovery and acceptance prerequisites. Backup owner remains an open question.

## Hosted staging execution — 19 October 2026

Jaco authorized the staging continuation and delegated the Mac-side execution to
chat 01a1512a-7e60-7483-98e8-b7c719d95485. Revision
`3349636a031d86b90c534e71e4a02d416a8f7df7` passed CI run `39172627684` and was
built on the Mac. The staging app was stopped, three separate stage roles were
created, and the nine existing tables were transferred with unchanged row counts.
An intentionally incorrect inventory was rejected and rollback/source integrity
verified before the successful transfer. The separate migration login applied
version 3; migration, admin and runtime scope verification all passed. Runtime
DDL, ledger updates and approval deletion were denied with PostgreSQL 42501.

The staging-only environment patch removed the hosted pre-deploy migration hook.
The app now has only its runtime database URL, with no bootstrap/migration/admin
URL variables. Manual deployment `fc083756-f5e7-4936-8d1c-29e9bff5641d` succeeded;
public health returned 200 with the exact revision, deployment and schema 3.
Unauthenticated focus access returned 401, Google sign-in redirected to Google,
and the existing authenticated browser session survived reload. No backups were
created, no production execution occurred, and automatic staging delivery remains
disabled (the enabling repository variable is absent).

Evidence: [sanitized execution record](../../../docs/operations/staging-transition-2026-10-19.json).
Full authenticated release acceptance remains open: two ordinary-member Google
sessions, cross-member denial, enrollment, revocation and save/reload checks.
Production setup still requires separate human authorization/execution. These
results do not close the complete provider-isolation or application-launch gate.

## Adopted simplification — 19 October 2026

Jaco approved the simplification described in the [current breakdown](../breakdown.md). Use the revised acceptance above and the [manual release procedure](../../../docs/operations/hosted-release.md). Historical execution notes remain evidence, not instructions to repeat completed work. Production execution remains separately authorized; two-member acceptance stays parked.
