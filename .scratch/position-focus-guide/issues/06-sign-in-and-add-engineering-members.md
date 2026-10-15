Kind: ticket
Title: Sign in and add engineering members — implemented baseline
Milestone: M01
Type: task
Status: resolved
Blocked by: None
Implementation: Complete locally; live hosted verification transferred to M06
Slice: Position focus baseline

---
# 06: Sign in and add engineering members — implemented baseline

## Current disposition — 15 October 2026

The identity, session and department-membership implementation is complete locally with automated evidence. Closing this ticket covers that implemented portion only. It does not claim real Google or hosted acceptance.

## Completed implementation

- Google work-account identity verification, persistent sessions and approved-domain enforcement.
- Backend setup of one department and career lead; registered-member assignment through the lead's UI.
- Server-authoritative role/membership enforcement, duplicate/unavailable assignment handling and data-preserving member removal.
- Isolated PostgreSQL/HTTP/browser coverage, including access withdrawal from existing sessions and Google token-validation rejection paths.

## Transferred work

Jaco now requires pre-approved Google email addresses entered directly into the production database; stage has its own QA allowlist. This individual approval requirement extends the earlier approved-domain/registration approach and is not claimed as already delivered.

- [M06/01 approved access](../../team-trial/issues/01-approved-access.md): individual email approval and current access behavior.
- [M06/05 Railway environments](../../team-trial/issues/05-railway-environments.md): actual stage/prod configuration and Google credentials/callbacks.
- [M06/06 stage verification](../../team-trial/issues/06-stage-verification.md): live Google and separate-session access checks.

The configured local walkthrough shares one account and cannot establish multi-user acceptance. Prior execution holds were superseded by later user authorization and this reconciliation.

## Sources

[Accepted baseline](../spec.md), [M01 closure](../milestone.md), [current PRD](../../../docs/PRD.md) and [M06](../../team-trial/milestone.md).

## Comments

### 15 October 2026 — Reconciled for the team trial

The current disposition above supersedes the original scope and execution holds. Historical comments below describe what was true at their recorded date; they are not fresh verification claims or current authorization requirements.

### 14 October 2026 — Publication approved

Jaco approved the four slices and dependencies and requested individual tickets. Implementation remains pending explicit approval.


### 14 October 2026 — Implementation and automated verification complete

Implemented on `codex/06-sign-in-members`: Google authorization code/PKCE and verified work identity; persistent hashed sessions; a waiting state; department users and searchable registered-user assignment; server-resolved membership and lead authority; repeatable backend domain/setup/removal operations. No deployment or live identity/domain configuration was performed.

Validation: Node 24.21.0; typecheck, 19 automated checks and production build pass. Real PostgreSQL/HTTP tests cover unauthorized access and assignment, forged roles/departments, duplicate/racing assignment, former/other-department restrictions, current-session removal, sign-out and expiry. Chromium covers the registration/assignment journey with synthetic provider identities; the real Google library verifies signed fixture tokens and rejects invalid claims/signatures. Desktop and mobile captures were inspected. Checked criteria above record implemented behavior and deterministic evidence, not completion of live Google acceptance.

Human verification remains: configure real Google credentials/callback, approved hosted domains and the intended lead outside Git; verify eligible/ineligible Google account flows; exercise the two-account assignment journey and review usability; verify backend removal using a disposable member account. Follow [setup and verification instructions](../../../docs/system/access-setup.md). Status remains ready-for-human until that acceptance is recorded.

Work is paused at ticket 06 as requested. Tickets 07–09 remain unimplemented; do not start ticket 07 until Jaco approves.
