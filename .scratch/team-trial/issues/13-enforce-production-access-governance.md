Kind: ticket
ID: team-trial/13
Title: Enforce and audit production administrative access
Milestone: M06
Type: task
Status: needs-info
Blocked by: 12 effective-access inventory and explicit implementation authorization
Implementation: Not started; planning only
Slice: Hosted team trial

---
## Outcome

Implement and verify the policy agreed in ticket 12 and repository-root AGENTS.md before production activation. Policy decisions are recorded; effective provider capabilities and grants remain unverified. This is a future, explicitly authorized implementation ticket, not an AFK production-execution task. No new admin UI, second approver or bespoke tamper-proof audit service is required for the initial trial.

## Remaining implementation checks

- [ ] Inventory Railway roles, SSH/console and secret access, database grants/network paths and deployment-token scope. Jaco performs production-side inspection and supplies sanitized findings; agents inspect/test only separately authorized local/staging environments. Document residual provider-owner powers and runtime-shell/data exposure without assuming superuser grants.
- [ ] Separate runtime, migration and administrative credentials/privileges. Verify runtime cannot change schemas or perform privileged administrative operations. Keep versioned migrations in a human-triggered runner; controlled administrative scripts are executed by Jaco. Do not weaken application authorization to facilitate operations.
- [ ] Verify agent-accessible local/staging credentials cannot reach production or retrieve its secrets through Railway, CI or other available paths. Scope delivery credentials to required environments/actions; prevent interactive production administration by agents. Resolve platform limitations explicitly before activation.
- [ ] Provide controlled, parameterized scripts for routine dogfooding enrollment, assignment of Jaco as career lead, exceptional corrections and requested removal. Include environment/project/database checks, proposed effect and expected row counts, abort conditions, transactions where supported, verification and recovery. Use placeholders for production identities/values; Jaco fills them privately. Additional career leads remain outside scope.
- [ ] Establish the sanitized `docs/operations/production-changes.md` template and handoff process: planned entry before routine execution, then applied/failed outcome, date, reason, script version/digest, effect, executor, verification and cleanup based on Jaco's sanitized report. Retain entries for repository lifetime. Verify sanitization and clear distinction between prepared and executed changes. A self-reported log is not authenticated, tamper-proof audit evidence; document available provider attribution and its limitations rather than claiming otherwise. No PR or organizational Changelog submission is required per operation.
- [ ] Test positive and negative access cases with synthetic data in isolated PostgreSQL/staging: member/lead visibility, cross-member denial, wrong target, unexpected affected-row count, forbidden runtime DDL/admin actions and revoked access. Verify actual denied paths rather than intended settings alone. Agents receive no real conversation data or sensitive production output.
- [ ] Verify event-based access review and prompt revocation on joining/leaving/responsibility changes, pre-activation review, potentially exposed credential rotation/revocation, and removal of task-specific grants/credentials after console use. Closing a session is not credential revocation. Jaco's normal owner account remains trusted; no recurring review ceremony or fixed duration is imposed.
- [ ] Rehearse with synthetic data the normal recording requirement and emergency exception for active exposure, imminent data loss or an outage that cannot reasonably wait. Routine enrollment/corrections wait if recording is unavailable. Verify minimal secure note, subsequent sanitized record, outcome review and cleanup; no second reviewer or agent production access is introduced.
- [ ] Test member-requested removal and verification with synthetic data. Identify backup copies and recovery handling to prevent inadvertent reintroduction of removed records. Describe actual deletion limits honestly; do not invent a retention schedule or require another policy exercise.
- [ ] Update runbooks and collect sanitized evidence of the checks above, including Jaco's production-side findings where necessary. Keep actual identities, credentials, conversation content and sensitive inventory outside Git/agent context. Publish reviewed implementation/evidence before marking enforcement complete. Any unverified or unenforceable required boundary keeps production inactive until Jaco explicitly resolves it.

## Boundary

Planning only in the current chat; implementation has not started. Keep production inactive and automatic staging delivery disabled. Do not change infrastructure, permissions, credentials, databases, application code or delivery switches, or run deployment workflows. Later implementation requires explicit scope and TDD for application changes; agents remain prohibited from production access even then. Member-requested removal is policy, not authorization to delete data now. These checks do not replace the separate release, recovery and acceptance prerequisites. Backup owner remains an open question.
