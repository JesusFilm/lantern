Kind: ticket
Title: Sign in and add engineering members
Milestone: M01
Type: task
Status: needs-info
Blocked by: None
Implementation: Pending explicit user approval
Slice: Engineering beta

---

# 06: Sign in and add engineering members

## Execution hold

Scope and dependencies are approved for publication only. **Do not implement until Jaco explicitly authorizes it.** The needs-info status represents this authorization hold; completed dependencies do not lift it.

**What to build:** Backend setup establishes engineering, its single career lead and allowed domains. Eligible users sign in/register and the career lead adds them through the app; only assigned users gain department access.

## Acceptance criteria

- [ ] Provide a repeatable backend setup/operation procedure for domain configuration, department creation and career-lead assignment. Do not invent live account/domain values or build administration UI.
- [ ] Use Google work accounts and approved domains; ordinary registration has no individual approval step. Proposed waiting state explains direct contact with the career lead and provides sign-out. Do not implement career-lead requests or a department-join queue.
- [ ] Department users/profile view includes Add user with existing-user dropdown, browsing and search by email name/address. Require selection of a registered user.
- [ ] Show membership tags/tooltips. Other-department users are unavailable to add; former same-department members are unavailable with the agreed rejoining explanation. Existing membership cannot be duplicated.
- [ ] Server authority, not submitted role/department identifiers, controls member management and access. Assignments persist. Backend removal preserves soft-deleted department data and ends access; document the operation without building removal or revocation UI.
- [ ] Preserve the single career lead in backend operations. No automatic successor, extra lead, transfer or restoration feature.
- [ ] Browser checks prove the sign-in/assignment journey; HTTP checks prove unauthorized assignment/access rejection and access withdrawal after backend removal, including existing sessions. Test fixtures may represent unavailable memberships without creating a supported multi-department UI.

**Proposed technical choices:** reuse the current Express/PostgreSQL boundary; introduce the smallest verified identity/session and membership implementation needed. Test harness, schema and authentication library are implementation choices. Check official provider documentation during authorized implementation. No framework migration or separate infrastructure refactor is justified by current code.

**Configuration prerequisites:** actual career-lead identity, approved domains, Google credentials and hosting/callback settings. Gather these before deploying the integration. Do not store secrets/personnel records in planning files. Manual Google verification complements deterministic authorization checks.

**Traceability:** beta access/setup decisions and specification stories 1–5, 14. This is the largest new slice; its purpose is a complete, demonstrable access-to-membership path, not a broad identity platform.

## Sources and boundaries

Follow the [specification](../spec.md), [approved breakdown](../breakdown.md) and [deferred features](../deferred.md). Publication does not authorize implementation, deployment or milestone closure.

## Comments

### 14 October 2026 — Publication approved

Jaco approved the four slices and dependencies and requested individual tickets. Implementation remains pending explicit approval.
