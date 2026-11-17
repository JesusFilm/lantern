# Review, confirmation and the cycle

These rules describe the agreed position-focus process. The owner decisions in [#153](https://github.com/JesusFilm/lantern/issues/153), [#130](https://github.com/JesusFilm/lantern/issues/130), [#89](https://github.com/JesusFilm/lantern/issues/89) and [#169](https://github.com/JesusFilm/lantern/issues/169) are the decision record. Screen details remain in the [PRD](../PRD.md).

## Rules

### RC-01 Confirmation needs a request for the current saved version
In effect · Owner decision, 17 Nov 2026 · [#153](https://github.com/JesusFilm/lantern/issues/153)

A career lead can confirm a draft only after its owner has requested review of the latest saved version. This applies through every route, including a lead's own focus and direct requests.

Why: confirmation locks a focus; without a request, a lead could lock a draft its owner was still writing.

Exceptions: focuses confirmed before this rule remain valid and locked without retrospective requests. Offline agreement still requires a request and confirmation in Lantern; the lead may confirm immediately or later.

### RC-02 Saving after a request needs a new request
In effect · Owner decision, 17 Nov 2026 · [#153](https://github.com/JesusFilm/lantern/issues/153)

A request freezes the saved version it was sent with. A later save does not replace that snapshot; the owner must request review of the latest version before it can be confirmed.

Rationale (inferred): the lead confirms the version the owner chose to send.

### RC-03 Review and confirmation need a Contribution objective with a goal
In effect · Owner decision, 17 Nov 2026 · [#89](https://github.com/JesusFilm/lantern/issues/89)

Requesting review or confirming requires at least one Contribution objective with at least one SMART goal. Empty, partial and development-only drafts remain valid to save.

Why: a locked focus without required content would remain empty for the cycle.

### RC-04 Saving, requesting and confirming are separate actions
In effect · Owner decision, 17 Nov 2026 · [#153](https://github.com/JesusFilm/lantern/issues/153)

Saving does not request review or confirm agreement; requesting review does not confirm it. A note, waiting period and second reviewer are not mandatory, including after offline agreement.

Rationale (inferred): requesting and confirming are deliberate actions by the focus owner and career lead.

### RC-05 The active department career lead confirms
In effect · [PRD](../PRD.md#access-and-data) · [#130](https://github.com/JesusFilm/lantern/issues/130)

Only the active career lead for the member's department may confirm their focus. Ordinary members cannot confirm their own focus; department and membership boundaries apply.

Rationale (inferred): confirmation records agreement through the department's career-lead role.

### RC-06 Career leads review and confirm their own focus
In effect · Owner decision, 17 Nov 2026 · [#130](https://github.com/JesusFilm/lantern/issues/130)

A career lead follows RC-01 to RC-03 for their own focus. Their request appears in their own Review requests list, and they may confirm it themselves. Discussion with a senior or manager is optional; no second reviewer, note or wait is required. Self-review wording must not imply a second person took part.

Why: self-confirmation is intentional; skipping the review request was the defect. Replaces the earlier expectation that a senior or manager confirms a lead's focus.

### RC-07 Confirm exactly the requested version
In effect · Owner decision, 17 Nov 2026 · [#153](https://github.com/JesusFilm/lantern/issues/153)

Confirmation applies to the current saved version only when that exact version was requested. Cancellation or failure does not itself confirm the focus. A stale attempt cannot confirm unrequested content; another concurrent confirmation may already have confirmed and locked it.

Rationale (inferred): an agreement must not silently cover content the owner did not send for review.

### RC-08 Confirmation locks the agreement and discussion
In effect · Owner decision, 17 Nov 2026 · [#169](https://github.com/JesusFilm/lantern/issues/169)

Confirmation records who confirmed and when, and locks the focus title, dates, objectives, goals and review discussion, including against career leads. Lantern currently has no unlock or accidental-lock recovery.

Why: the confirmed focus is a retained baseline. Mid-cycle changes and recovery remain deferred under RC-D1 and RC-D2.

### RC-09 Confirmation records agreement
In effect · [Glossary](../../GLOSSARY.md#position-focuses)

Confirmation records agreement on the focus, not achievement of its goals. Progress and notes about objectives and goals are separate from the locked agreement.

Rationale (inferred): progress can change after agreement without rewriting it.

### RC-10 Confirmation removes private coaching checkpoints
In effect · [ADR 0010](../adrs/0010-integrated-focus-assistance.md)

Confirmation removes the owner's private coaching checkpoint. A failed confirmation leaves it intact; a career lead cannot read another member's checkpoint.

Why: not recorded in the cited decision.

### RC-11 Review notes belong to the review
In effect · [#153](https://github.com/JesusFilm/lantern/issues/153)

Before confirmation, the owner and career lead can add review notes and soft-delete their own notes; notes cannot be edited. The focus owner and the current active career lead of the owner's department can read the discussion, including a lead who did not participate in it. It becomes read-only on confirmation.

Rationale (inferred): the review retains a history of the discussion without allowing a participant to rewrite another's contribution.

### RC-12 Two full cycles per year
In effect · Owner decision · [#169](https://github.com/JesusFilm/lantern/issues/169)

The owner decision establishes two full cycles each year; the Guide depicts each as six months. Each includes preparing, requesting review and confirming a focus, a mid-cycle progress check-in, and an end-cycle review.

Rationale (inferred): the cycle supports agreement, progress review and learning.

### RC-13 Renewal creates a new focus
In effect · Owner decision · [#169](https://github.com/JesusFilm/lantern/issues/169)

After the end-cycle review, deliberately create a new focus with carryovers and/or new objectives and goals. The previous confirmed focus, discussion and progress remain history.

Why: renewal starts a new agreement rather than amending the previous cycle's baseline.

### RC-14 Cycle automation is not provided
In effect · Owner decision · [#169](https://github.com/JesusFilm/lantern/issues/169)

The agreed rhythm does not provide scheduling, automatic carryover or cycle renewal tooling.

Rationale (inferred): the agreement establishes the process without deciding those product features.

### RC-15 Explain unavailable review and confirmation actions
In effect · [#89](https://github.com/JesusFilm/lantern/issues/89) · [#149](https://github.com/JesusFilm/lantern/issues/149)

An ineligible focus does not offer actionable confirmation; the explanation identifies the missing step. The review-request form remains visible when sending is unavailable, with an accessible reason; the optional note is disabled with Send, and a failed request retains the note.

Why: people need to understand how to become ready without losing their work. See the [PRD](../PRD.md#product-behavior) for presentation and recovery details.

## Open and deferred decisions

### RC-D1 Changing a confirmed focus mid-cycle
Deferred · revisit after all members' first submissions in Dec 2026–Jan 2027 · [#169](https://github.com/JesusFilm/lantern/issues/169)

Question: amend a confirmed focus, or require a new position focus? The decision must also address who initiates and authorizes changes, review and confirmation, preservation of the prior agreement, discussion, progress and goal references, and how people identify the current focus. Current behavior: confirmed content cannot be edited or unlocked, including by career leads. Unlocking is not an approved future feature.

### RC-D2 Recovering from an accidental confirmation
Deferred with RC-D1 · [#169](https://github.com/JesusFilm/lantern/issues/169)

Question: how should accidental confirmation be recovered, and should that differ from a substantive change? Current behavior: Lantern has no recovery path.

### RC-Q1 Calendar months for the cycle
Open · [#169](https://github.com/JesusFilm/lantern/issues/169)

Question: are January and July fixed cycle boundaries, or illustrative guidance? The owner decision establishes two cycles per year; the Guide depicts six-month cycles. The decision does not specify exact duration or calendar boundaries.

## Retired IDs

None.
