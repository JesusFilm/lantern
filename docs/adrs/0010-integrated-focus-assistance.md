# Integrated position-focus assistance

Date: 2026-10-29
Status: Accepted through the owner's authoring walkthrough and implementation request

## Decision

Position focuses owns member authoring. Optional assistance starts inside the
source-bound objective/goal edit, or with project exploration for a new objective.
Accepting a suggestion changes only the pending editor; the ordinary focus save
persists it. Goal assistance cannot change its parent objective or siblings.
All objective types remain visible and member-editable on drafts; changing a type
preserves wording, goals and initiative choices.

Keep review requests in a separate presentation module. Member whole-focus review
is entered from authoring; the lead retains a distinct review-request destination.
Immutable requested versions, notes, confirmation authority and locks are unchanged.
Legacy `page=coach` links resolve to Position focuses rather than another editor.

Extend the existing checkpoint JSON and add owner-only progress writes, using the
same membership transaction and focus lock. Saving private progress does not change
the focus or its version. Unique checkpoint revision tokens prevent a competing progress save
or deletion from silently replacing newer answers, including delete/recreate races. Manual document saves retain
checkpoints at their original source version, including legacy checkpoints.

A current checkpoint resumes its named edit. A stale checkpoint remains readable;
the member explicitly chooses a current objective/goal before reusing its answers.
There is no implicit rebasing by array index. Confirmation still removes progress.
Applying a resumed suggestion and saving clears only the consumed checkpoint
revision; if cleanup races or fails, the saved document stands and progress is kept.

## Consequences

This supersedes the manual-save checkpoint invalidation in [ADR 0009](0009-coaching-and-review.md).
It extends [ADR 0005](0005-draft-focus-workflow.md) without replacing its source-bound
save or navigation guarantees. [ADR 0004](0004-focus-alignment-history.md)'s trusted
initiative snapshots remain unchanged. No schema migration, new provider, production
activation or deployment-switch change is required.

There is one saved coaching session per focus. Replacing it requires an explicit
member choice. Suggestions remain bounded and validated; type recommendations are
advice, not changes until the member accepts and saves them.
