# Engineering beta — approved breakdown

Milestone: M01
Review: Four beta slices and dependencies approved; tickets published
Implementation: Not authorized
Date: 14 October 2026

Based on the [consolidated beta specification](spec.md). Jaco approved these four slices and dependencies and authorized ticket publication. They replace the earlier six-slice plan for beta. Decision records 01–05 remain intact; implementation tickets are 06–09. Implementation still requires explicit approval.

## B1 — Sign in and add engineering members

**Blocked by:** None within this breakdown. Real Google integration requires configuration inputs listed below.

**Delivers:** Backend setup establishes engineering, its single career lead and allowed domains. Eligible users sign in/register and the career lead adds them through the app; only assigned users gain department access.

Acceptance:

- Provide a repeatable backend setup/operation procedure for domain configuration, department creation and career-lead assignment. Do not invent live account/domain values or build administration UI.
- Use Google work accounts and approved domains; ordinary registration has no individual approval step. Proposed waiting state explains direct contact with the career lead and provides sign-out. Do not implement career-lead requests or a department-join queue.
- Department users/profile view includes Add user with existing-user dropdown, browsing and search by email name/address. Require selection of a registered user.
- Show membership tags/tooltips. Other-department users are unavailable to add; former same-department members are unavailable with the agreed rejoining explanation. Existing membership cannot be duplicated.
- Server authority, not submitted role/department identifiers, controls member management and access. Assignments persist. Backend removal preserves soft-deleted department data and ends access; document the operation without building removal or revocation UI.
- Preserve the single career lead in backend operations. No automatic successor, extra lead, transfer or restoration feature.
- Browser checks prove the sign-in/assignment journey; HTTP checks prove unauthorized assignment/access rejection and access withdrawal after backend removal, including existing sessions. Test fixtures may represent unavailable memberships without creating a supported multi-department UI.

**Proposed technical choices:** reuse the current Express/PostgreSQL boundary; introduce the smallest verified identity/session and membership implementation needed. Test harness, schema and authentication library are implementation choices. Check official provider documentation during authorized implementation. No framework migration or separate infrastructure refactor is justified by current code.

**Configuration prerequisites:** actual career-lead identity, approved domains, Google credentials and hosting/callback settings. Gather these before deploying the integration. Do not store secrets/personnel records in planning files. Manual Google verification complements deterministic authorization checks.

**Traceability:** beta access/setup decisions and specification stories 1–5, 14. This is the largest new slice; its purpose is a complete, demonstrable access-to-membership path, not a broad identity platform.

## B2 — Use fixed objective and SMART walkthroughs

**Blocked by:** B1 for the integrated member-only experience. Content preparation may proceed independently after approval.

**Delivers:** Members open optional guidance and use independently selectable objective and SMART walkthroughs with mission context, gaps, development and review explanations.

Acceptance:

- Fixed curated content is available from first run, with visible help, short steps, Next transitions and restrained application-controlled presentation.
- Preserve exact mission wording and the reader-controlled collapsible context banner across steps; omit absent context.
- Teach all agreed content areas without mandatory-field assumptions; include internal contributions and discovery, active clarification and leadership responsibility for absent direction.
- Improve a vague goal through all SMART qualities without forcing numerical goals or five written sections.
- Explain optional development, joint review/lock-in, revisable baseline and remaining gaps. No focus-editing or lock-in implementation is included.
- Explain departmental timing, illustrative cycles and referral to the career lead when timing is missing; no default cadence or calendar feature.
- Browser checks cover walkthrough entry/selection/navigation and context behavior. Review content against D01–D05 and later beta decisions. Do not create text editors.

**Traceability:** specification stories 6–10, 12–13; D01–D03/D05.

## B3 — Read the fixed engineering example

**Blocked by:** B1 for member access. No dependency on B2's walkthrough implementation; use the shared member-facing support entry established in B1.

**Delivers:** Members find and read the full engineering product-work example as a useful drafting reference.

Acceptance:

- Inspect the supplied reference during production and develop that scenario with objective/SMART goals, users/needs/outcomes, gaps and next steps.
- Mark scenario counts, targets and dates illustrative. Explain optional personal and leadership development distinctly.
- Present clear readable content under application control. No example editor, department selector or mandatory organizational template.
- Browser checks demonstrate discovery and reading; content review checks source fidelity and requirement coverage. Coordinate wording with B2 through the specification, without making unrelated implementation dependencies.

**Traceability:** specification story 11; D01/D03 and engineering-only beta decision.

## B4 — Verify the guide with practical use

**Blocked by:** B2 and B3 (B1 is a transitive dependency).

**Delivers:** Evidence of whether the fixed beta guide works for its intended users, plus findings and follow-through.

Acceptance:

- A newcomer prepares an objective and SMART goals, records gaps/next steps, explains review/lock-in, finds useful examples and understands optional development. They may prepare the focus outside the app because the drafting workflow is separate.
- A reader distinguishes cycle illustrations from actual expectations and asks the career lead when timing is absent.
- Confirm the beta assignment/access journey alongside the automated evidence from B1; do not describe a test fixture as real-world multi-department verification.
- Record anonymized observations, unmet criteria and necessary corrections. No fixed participant count or numerical success target. Rerun affected checks after corrections.
- Do not claim the deferred authoring/two-department practical checks occurred. Do not automatically close M01 or equate guide verification with team-cycle completion.

**Traceability:** retained D03/D05 practical checks; current beta acceptance plan.

## Scope and review

Dependency graph: B1 → B2 and B3; B2 + B3 → B4. B2/B3 can run in parallel once member access exists. Each build slice includes its UI, required server behavior and externally observable checks. B4 is practical verification, not an isolated automated-testing phase.

Backend setup and member management are the minimal access prerequisite for this beta guide. They do not bring full drafting, review or personnel-record workflows into M01. Those remain with their owning milestones. No other milestone was edited.

[Deferred features](deferred.md) preserve the expansion decisions. [Historical breakdown](history/breakdown-before-beta-consolidation-2026-10-14.md) preserves the prior six-slice approval and subsequent scope changes. The specification triage label does not authorize implementation.

The four-slice breakdown is approved and published. Implementation remains pending explicit approval. Configuration values can be supplied during setup preparation rather than extending product discovery.

## Published tickets

- [06: Sign in and add engineering members](issues/06-sign-in-and-add-engineering-members.md) — blocked by: None.
- [07: Use fixed objective and SMART walkthroughs](issues/07-fixed-objective-and-smart-walkthroughs.md) — blocked by: 06.
- [08: Read the fixed engineering example](issues/08-fixed-engineering-example.md) — blocked by: 06.
- [09: Verify the guide with practical use](issues/09-verify-guide-through-practical-use.md) — blocked by: 07, 08.

All tickets are needs-info pending explicit implementation approval; they are not an executable frontier.

## Comments

### 14 October 2026 — Approval recorded

Jaco approved the four beta slices and their dependencies and authorized publication of tickets 06–09, keeping implementation pending his approval. No implementation or verification occurred.
