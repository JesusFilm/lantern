Kind: ticket
Title: Use the accepted concise objective and SMART guides
Milestone: M01
Type: task
Status: resolved
Blocked by: 06
Implementation: Complete for accepted Refine 4 scope; newcomer verification in M06/06
Slice: Position focus baseline

---
# 07: Use the accepted concise objective and SMART guides

## Current disposition — 15 October 2026

The accepted Refine 4 guide is implemented: Objectives in three small steps, SMART goals in five, with separate side navigation, clearly distinguished weak/strong examples and prominent “Why it works” explanations. Guidance stays separate from authoring.

## Scope reconciliation

This remains resolved against the accepted concise guide. The earlier mission-context banner, gap/next-step teaching, review/lock-in/timing explanations and broad content checklist were intentionally superseded. Their old checked boxes are retained in the [historical ticket](../history/2026-10-15-pre-team-trial/07-fixed-objective-and-smart-walkthroughs.md), not carried forward as claims about today's app.

Jaco accepted the minimal local experience. Automated browser coverage is part of the last reported 39-test suite on 15 October 2026. Newcomer usefulness has not been human-verified; relevant current-app checks are [M06/06](../../team-trial/issues/06-stage-verification.md).

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
