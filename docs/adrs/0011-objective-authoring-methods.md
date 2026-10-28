# Objective authoring methods

Date: 2026-10-29
Status: Implemented for owner UX feedback under the requested reimplementation

## Decision

Use one objective, including its goals, as the scope of manual or AI-guided
writing. The owner rejected the layered suggestion, coaching-progress and draft
states in the first implementation. Both methods now update the same pending
objective and use one ordinary Save objective action. Quick manual goal edits
remain shortcuts. Method choice is local presentation state, not a stored flag.

Guidance has explicit work, objective, goals and check-objective stages. Generation
occurs during relevant transitions. Merely opening an existing objective does not
regenerate it. Existing-objective guidance first asks what the member wants to
improve; an empty answer continues to its goals. Back and method switching retain
input. Goal planning has one date control; changing the plan regenerates wording
for inspection, while unchanged plans retain member edits. Failures and stale saves
retain the pending edit.
Saving writes the original focus version, preserving unrelated sections.

The UI no longer writes separate coaching progress. Existing checkpoints and
legacy HTTP contracts remain protected and readable; the member can copy earlier
working notes into a new unsaved objective. Notes are never implicitly deleted or
rebased onto a different current objective. No migration is required.

A shared document renderer owns objective/goal hierarchy for member authoring,
whole-focus review and career-lead reading. It carries the displayed snapshot in
edit callbacks. Review requests, notes and confirmation remain separate role tasks.
Shared spacing, typography and form rules replace conflicting per-editor styles.

## Consequences

This replaces the authoring interaction of [ADR 0010](0010-integrated-focus-assistance.md),
not its checkpoint concurrency, ownership or history safeguards. No provider/model,
authentication, deployment switch or database-schema change is needed. Unsaved
pre-objective answers follow ordinary unsaved-form behavior with leave warnings.
The detailed experience remains subject to the owner's walkthrough of this preview.
