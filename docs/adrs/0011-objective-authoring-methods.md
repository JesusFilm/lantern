# Objective authoring methods

Date: 2026-10-29
Status: Accepted for shared authoring state ownership

## Decision

Manual and AI-guided authoring share one in-memory pending objective, including
its nested goals, owned by the source-bound draft workflow. AI output changes that
pending state through typed intents; the ordinary focus write interface persists
the original document/version. Authoring method is presentation state rather than
a persisted domain flag. The current authoring path does not write separate
coaching checkpoints.

The shared document renderer owns objective/goal hierarchy across member and
career-lead views. Edit callbacks carry the displayed snapshot. Review requests
and notes retain their separate module and persistence contracts; server-resolved
authority remains independent of the authoring method.

## Rationale and alternatives

Separate manual and coaching drafts would require synchronization, competing
save lifecycles and additional rules for reconciling generated content. A shared
pending objective uses the existing optimistic version checks and keeps changes
local to the source document. A common renderer avoids divergent representations
of the same saved hierarchy across roles.

## Consequences

This replaces authoring state ownership in [ADR 0010](0010-integrated-focus-assistance.md).
Its legacy checkpoint concurrency, ownership and history safeguards remain in force;
stored checkpoints are retained without exposing a second authoring lifecycle.
No database migration, provider or authentication change is required. Pending edits
are transient rather than durably saved assistance sessions. UI flows, controls,
validation and recovery behavior belong in the [PRD](../PRD.md).
