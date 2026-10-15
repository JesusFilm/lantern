Kind: ticket
Title: Read the fixed engineering example
Milestone: M01
Type: task
Status: resolved
Blocked by: 06
Implementation: Complete; practical human verification tracked in 09
Slice: Engineering beta

---

# 08: Read the fixed engineering example

## Execution hold

Jaco authorized tickets 07–08 and automated/preparation work for 09 on 14 October 2026. Provide a preview without Google setup; defer live Google and practical human verification to final review.

**What to build:** Members find and read the full engineering product-work example as a useful drafting reference.

## Acceptance criteria

- [x] Inspect the supplied reference during production and develop that scenario with objective/SMART goals, users/needs/outcomes, gaps and next steps.
- [x] Mark scenario counts, targets and dates illustrative. Explain optional personal and leadership development distinctly.
- [x] Present clear readable content under application control. No example editor, department selector or mandatory organizational template.
- [x] Browser checks demonstrate discovery and reading; content review checks source fidelity and requirement coverage. Coordinate wording with 07 through the specification, without making unrelated implementation dependencies.

**Traceability:** specification story 11; D01/D03 and engineering-only beta decision.

## Sources and boundaries

Follow the [specification](../spec.md), [approved breakdown](../breakdown.md) and [deferred features](../deferred.md). Publication does not authorize implementation, deployment or milestone closure.

## Comments

### 14 October 2026 — Publication approved

Jaco approved the four slices and dependencies and requested individual tickets. Implementation remains pending explicit approval.


## Answer

Implemented on 14 October 2026 after Jaco authorized completing 07–08 and the automated/preparation portion of 09, with human verification deferred to final review. The real app serves curated content only to active members through `/api/guide`; a separate static preview shares the guide component and fixed content without Google, accounts or a database.

Content was reviewed against consolidated D01–D05, the beta deferrals and the supplied working-example image. Typecheck, 25 automated checks, production build and preview build pass. Chromium covers independent walkthrough navigation, context retention/omission, example discovery, mobile/keyboard behavior and the integrated member journey. Private HTTPS HTML/assets and published browser interactions pass on the VM. Practical human evidence is still pending in ticket 09; M01 remains open.

[Open preview](https://jacobuntu.tail5c6dbf.ts.net/lantern-guide/) · [Verification and content-review record](../../../docs/system/guide-verification.md).
