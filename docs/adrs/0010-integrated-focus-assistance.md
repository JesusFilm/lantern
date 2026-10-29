# Integrated position-focus assistance

Date: 2026-10-29
Status: Accepted for checkpoint concurrency and data protection
Superseded: 2026-10-29 — authoring state ownership replaced by [ADR 0011](0011-objective-authoring-methods.md).

## Decision

Protect the existing checkpoint JSON and owner-only legacy progress writes using the
same membership transaction and focus lock. Saving private progress does not change
the focus or its version. Unique checkpoint revision tokens prevent a competing progress save
or deletion from silently replacing newer answers, including delete/recreate races. Manual document saves retain
checkpoints at their original source version, including legacy checkpoints.

Legacy HTTP contracts retain source-version and revision checks. There is no
implicit rebasing by array index. Confirmation still removes progress. Current
authoring behavior is defined in the [PRD](../PRD.md).

## Consequences

This supersedes the manual-save checkpoint invalidation in [ADR 0009](0009-coaching-and-review.md).
It extends [ADR 0005](0005-draft-focus-workflow.md) without replacing its source-bound
save or navigation guarantees. [ADR 0004](0004-focus-alignment-history.md)'s trusted
initiative snapshots remain unchanged. No schema migration, new provider, production
activation or deployment-switch change is required.

There is at most one legacy checkpoint per focus. Retaining its concurrency contract
protects stored data and older clients without making it part of current authoring.
