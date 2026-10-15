Kind: ticket
Title: Sign in and add engineering members
Milestone: M01
Type: task
Status: ready-for-human
Blocked by: None
Implementation: Complete locally; live Google verification pending
Slice: Engineering beta

---

# 06: Sign in and add engineering members

## Execution hold

Jaco authorized implementation of ticket 06 on 14 October 2026. Pause after this ticket, report human verification, and await approval before ticket 07.

**What to build:** Backend setup establishes engineering, its single career lead and allowed domains. Eligible users sign in/register and the career lead adds them through the app; only assigned users gain department access.

## Acceptance criteria

- [x] Provide a repeatable backend setup/operation procedure for domain configuration, department creation and career-lead assignment. Do not invent live account/domain values or build administration UI.
- [x] Use Google work accounts and approved domains; ordinary registration has no individual approval step. Proposed waiting state explains direct contact with the career lead and provides sign-out. Do not implement career-lead requests or a department-join queue.
- [x] Department users/profile view includes Add user with existing-user dropdown, browsing and search by email name/address. Require selection of a registered user.
- [x] Show membership tags/tooltips. Other-department users are unavailable to add; former same-department members are unavailable with the agreed rejoining explanation. Existing membership cannot be duplicated.
- [x] Server authority, not submitted role/department identifiers, controls member management and access. Assignments persist. Backend removal preserves soft-deleted department data and ends access; document the operation without building removal or revocation UI.
- [x] Preserve the single career lead in backend operations. No automatic successor, extra lead, transfer or restoration feature.
- [x] Browser checks prove the sign-in/assignment journey; HTTP checks prove unauthorized assignment/access rejection and access withdrawal after backend removal, including existing sessions. Test fixtures may represent unavailable memberships without creating a supported multi-department UI.

**Proposed technical choices:** reuse the current Express/PostgreSQL boundary; introduce the smallest verified identity/session and membership implementation needed. Test harness, schema and authentication library are implementation choices. Check official provider documentation during authorized implementation. No framework migration or separate infrastructure refactor is justified by current code.

**Configuration prerequisites:** actual career-lead identity, approved domains, Google credentials and hosting/callback settings. Gather these before deploying the integration. Do not store secrets/personnel records in planning files. Manual Google verification complements deterministic authorization checks.

**Traceability:** beta access/setup decisions and specification stories 1–5, 14. This is the largest new slice; its purpose is a complete, demonstrable access-to-membership path, not a broad identity platform.

## Sources and boundaries

Follow the [specification](../spec.md), [approved breakdown](../breakdown.md) and [deferred features](../deferred.md). Publication does not authorize implementation, deployment or milestone closure.

## Comments

### 14 October 2026 — Publication approved

Jaco approved the four slices and dependencies and requested individual tickets. Implementation remains pending explicit approval.


### 14 October 2026 — Implementation and automated verification complete

Implemented on `codex/06-sign-in-members`: Google authorization code/PKCE and verified work identity; persistent hashed sessions; a waiting state; department users and searchable registered-user assignment; server-resolved membership and lead authority; repeatable backend domain/setup/removal operations. No deployment or live identity/domain configuration was performed.

Validation: Node 24.21.0; typecheck, 19 automated checks and production build pass. Real PostgreSQL/HTTP tests cover unauthorized access and assignment, forged roles/departments, duplicate/racing assignment, former/other-department restrictions, current-session removal, sign-out and expiry. Chromium covers the registration/assignment journey with synthetic provider identities; the real Google library verifies signed fixture tokens and rejects invalid claims/signatures. Desktop and mobile captures were inspected. Checked criteria above record implemented behavior and deterministic evidence, not completion of live Google acceptance.

Human verification remains: configure real Google credentials/callback, approved hosted domains and the intended lead outside Git; verify eligible/ineligible Google account flows; exercise the two-account assignment journey and review usability; verify backend removal using a disposable member account. Follow [setup and verification instructions](../../../docs/system/access-setup.md). Status remains ready-for-human until that acceptance is recorded.

Work is paused at ticket 06 as requested. Tickets 07–09 remain unimplemented; do not start ticket 07 until Jaco approves.
