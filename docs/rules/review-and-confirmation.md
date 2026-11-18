# Review, confirmation and the cycle

These rules cover review, confirmation and the position-focus cycle. The owner decisions in [#153](https://github.com/JesusFilm/lantern/issues/153), [#130](https://github.com/JesusFilm/lantern/issues/130), [#89](https://github.com/JesusFilm/lantern/issues/89) and [#169](https://github.com/JesusFilm/lantern/issues/169) are the decision record where cited. Other entries link to current documentation and do not by themselves establish a separate owner decision. Screen details remain in the [PRD](../PRD.md); other areas have not yet been migrated into the catalogue.

Find the rule: [request and content requirements](#rc-01-confirmation-needs-a-request-for-the-current-saved-version) · [agreement and optional discussion](#rc-04-saving-requesting-and-confirming-are-separate-actions) · [career lead self-confirmation](#rc-06-career-leads-review-and-confirm-their-own-focus) · [locking and progress](#rc-08-confirmation-locks-the-agreement-and-discussion) · [cycle and renewal](#rc-12-two-full-cycles-per-year) · [mid-cycle and accidental-lock decisions](#open-and-deferred-decisions).

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

Saving does not request review or confirm agreement; requesting review does not confirm it. Confirmation records agreement after review. Agreement can be reached offline, but the explicit request and confirmation in Lantern are still required; a note, waiting period and second reviewer are not mandatory. For a career lead's own focus, discussion with a senior or manager is optional (RC-06).

Only the focus owner can edit their draft and request its review. A career lead cannot rewrite another member's draft or request review on their behalf; see [access and data](../PRD.md#access-and-data) and the [review request checks](../../server/coach-store.ts).

Current interface and enforcement: the member-focus confirmation dialog refers to a discussion. In the review-request view, a career lead confirming a member's focus must tick an attestation that they discussed and agreed it; a lead confirming their own focus attests that they reviewed it. The server does not independently verify a conversation or agreement. The owner and career lead can use review notes; see RC-11. These interface details do not change the expected agreement or establish a second reviewer.

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

Confirmation removes the owner's private coaching checkpoint. A failed confirmation attempt does not itself remove it; another concurrent successful confirmation may already have done so. A career lead cannot read another member's checkpoint.

Why: not recorded in the cited decision.

### RC-11 Review notes belong to the review
In effect · [#153](https://github.com/JesusFilm/lantern/issues/153)

Before confirmation, the owner and career lead can add review notes and soft-delete their own notes; notes cannot be edited. The focus owner and the current active career lead of the owner's department can read the discussion, including a lead who did not participate in it. It becomes read-only on confirmation.

Current behavior: notes remain attached to the requested version they discuss. Earlier notes remain visible with their earlier draft after a new request and after confirmation. If someone starts a note on one request and a newer request arrives before it is submitted, Lantern rejects that stale submission and retains the typed text; it does not move the note to the new request. A newly started note can be submitted against the current request. See the [browser workflow](../../server/coach.browser.test.ts) and [request-version checks](../../server/coach-store.ts); the cited owner decision does not specifically decide this concurrency behavior.

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

Question: amend a confirmed focus, or require a new position focus? The decision must also address who initiates and authorizes changes, review and confirmation, preservation of the prior agreement, discussion, progress and goal references, and how people identify the current focus. Current behavior: confirmed content cannot be edited or unlocked, including by career leads. Unlocking is not an approved future feature. The mid-cycle check-in reviews progress; the distinct end-cycle renewal creates a new focus and retains history (RC-12–RC-14). Scheduling, automatic carryover and cycle tooling are not provided.

### RC-D2 Recovering from an accidental confirmation
Deferred with RC-D1 · [#169](https://github.com/JesusFilm/lantern/issues/169)

Question: how should accidental confirmation be recovered, and should that differ from a substantive change? Current behavior: Lantern has no recovery path.

### RC-Q1 Calendar months for the cycle
Open · [#169](https://github.com/JesusFilm/lantern/issues/169)

Question: are January and July fixed cycle boundaries, or illustrative guidance? The owner decision establishes two cycles per year; the Guide depicts six-month cycles. The decision does not specify exact duration or calendar boundaries.

### RC-Q2 Disagreement and escalation guidance
Open · owner decision status not established

The [current Guide text](../../server/guide-content.ts) describes a human escalation when a member and career lead cannot agree. Its status as an owner-approved business rule has not been established. Lantern's current confirmation checks do not independently verify agreement or provide a separate escalation or override workflow. Do not infer from this open question that the Guide text is approved, or that its absence from this catalogue means no guidance exists.

## Retired IDs

None.
