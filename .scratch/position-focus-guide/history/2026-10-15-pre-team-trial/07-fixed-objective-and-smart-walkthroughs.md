Kind: ticket
Title: Use fixed objective and SMART walkthroughs
Milestone: M01
Type: task
Status: resolved
Blocked by: 06
Implementation: Complete; practical human verification tracked in 09
Slice: Engineering beta

---

# 07: Use fixed objective and SMART walkthroughs

## Execution hold

Jaco authorized tickets 07–08 and automated/preparation work for 09 on 14 October 2026. Provide a preview without Google setup; defer live Google and practical human verification to final review.

**What to build:** Members open optional guidance and use independently selectable objective and SMART walkthroughs with mission context, gaps, development and review explanations.

## Acceptance criteria

- [x] Fixed curated content is available from first run, with visible help, short steps, Next transitions and restrained application-controlled presentation.
- [x] Preserve exact mission wording and the reader-controlled collapsible context banner across steps; omit absent context.
- [x] Teach all agreed content areas without mandatory-field assumptions; include internal contributions and discovery, active clarification and leadership responsibility for absent direction.
- [x] Improve a vague goal through all SMART qualities without forcing numerical goals or five written sections.
- [x] Explain optional development, joint review/lock-in, revisable baseline and remaining gaps. No focus-editing or lock-in implementation is included.
- [x] Explain departmental timing, illustrative cycles and referral to the career lead when timing is missing; no default cadence or calendar feature.
- [x] Browser checks cover walkthrough entry/selection/navigation and context behavior. Review content against D01–D05 and later beta decisions. Do not create text editors.

**Traceability:** specification stories 6–10, 12–13; D01–D03/D05.

## Sources and boundaries

Follow the [specification](../spec.md), [approved breakdown](../breakdown.md) and [deferred features](../deferred.md). Publication does not authorize implementation, deployment or milestone closure.

## Comments

### 14 October 2026 — Publication approved

Jaco approved the four slices and dependencies and requested individual tickets. Implementation remains pending explicit approval.


## Answer

Implemented on 14 October 2026 after Jaco authorized completing 07–08 and the automated/preparation portion of 09, with human verification deferred to final review. The real app serves curated content only to active members through `/api/guide`; a separate static preview shares the guide component and fixed content without Google, accounts or a database.

Content was reviewed against consolidated D01–D05, the beta deferrals and the supplied working-example image. Typecheck, 25 automated checks, production build and preview build pass. Chromium covers independent walkthrough navigation, context retention/omission, example discovery, mobile/keyboard behavior and the integrated member journey. Private HTTPS HTML/assets and published browser interactions pass on the VM. Practical human evidence is still pending in ticket 09; M01 remains open.

[Open preview](https://jacobuntu.tail5c6dbf.ts.net/lantern-guide/) · [Verification and content-review record](../../../docs/system/guide-verification.md).
