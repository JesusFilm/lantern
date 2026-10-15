Kind: ticket
Title: Read the accepted concise position-focus example
Milestone: M01
Type: task
Status: resolved
Blocked by: 06
Implementation: Complete for accepted generic example; newcomer verification in M06/06
Slice: Position focus baseline

---
# 08: Read the accepted concise position-focus example

## Current disposition — 15 October 2026

The accepted Refine 4 example is implemented beside the guide side navigation: one generic objective and two SMART goals. The removed “One objective, two goals. Illustrative targets and dates.” subtitle stays removed.

## Scope reconciliation

The original full engineering product-work example and its gaps, optional sections and review/timing coverage were intentionally replaced by this concise generic example. Their checked criteria remain in the [historical ticket](../history/2026-10-15-pre-team-trial/08-fixed-engineering-example.md), not as current delivery claims.

Jaco accepted the minimal local experience. Browser checks cover guide/example navigation and layout. Newcomer usefulness has not been human-verified; relevant current-app checks are [M06/06](../../team-trial/issues/06-stage-verification.md).

## Sources

[Accepted baseline](../spec.md), [M01 closure](../milestone.md), [current PRD](../../../docs/PRD.md) and [M06](../../team-trial/milestone.md).

## Comments

### 15 October 2026 — Reconciled for the team trial

The current disposition above supersedes the original scope and execution holds. Historical comments below describe what was true at their recorded date; they are not fresh verification claims or current authorization requirements.

### 14 October 2026 — Publication approved

Jaco approved the four slices and dependencies and requested individual tickets. Implementation remains pending explicit approval.


## Answer

Implemented on 14 October 2026 after Jaco authorized completing 07–08 and the automated/preparation portion of 09, with human verification deferred to final review. The real app serves curated content only to active members through `/api/guide`; a separate static preview shares the guide component and fixed content without Google, accounts or a database.

Content was reviewed against consolidated D01–D05, the beta deferrals and the supplied working-example image. Typecheck, 25 automated checks, production build and preview build pass. Chromium covers independent walkthrough navigation, context retention/omission, example discovery, mobile/keyboard behavior and the integrated member journey. Private HTTPS HTML/assets and published browser interactions pass on the VM. Practical human evidence is still pending in ticket 09; M01 remains open.

[Open preview](https://jacobuntu.tail5c6dbf.ts.net/lantern-guide/) · [Verification and content-review record](../../../docs/system/guide-verification.md).
