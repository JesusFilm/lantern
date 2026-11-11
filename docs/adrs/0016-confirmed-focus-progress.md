# Progress on confirmed focuses

Date: 2026-11-12
Status: Accepted by the repository owner

## Decision

Store objective and goal progress separately from the focus and review discussions. Progress is available only once a focus is confirmed. Its locked section and goal positions identify targets; no draft identity or backfill is needed. The server validates each position against the confirmed document while holding the membership-write lock. The member can edit a current note and set or clear its status in one atomic operation. The active career lead can read the same records within the department but cannot change them.

## Rationale

An in-document field on `position_focuses` was rejected: the confirmed document is a locked baseline that owner edits must not touch, so writing progress into it would either reopen the confirmed state or require rewriting the locked document and its version for every status or note change. Reusing the review discussion tables was rejected: review notes belong to the department's review conversation and are visible to other review participants, while progress is the member's own record scoped to the owner and the active lead, and review snapshots must not silently gain progress entries.

Progress targets use the locked section and goal positions of the confirmed document rather than durable objective and goal IDs: because the confirmed document is read-only, its positions are stable for the focus's life, so durable IDs would add migration and schema work without changing what the member can do. That tradeoff is limited to confirmed focuses; the consequence below records the point at which durable IDs become necessary.

Notes append revisions while statuses store a current value: a note is a dated record the member writes at specific times, and the PRD keeps its wording when only the status changes; statuses change as work moves, and the PRD exposes only the current state, so retaining a status history has no visible use while adding retention.

## Consequences

The additive migration creates separate status and note tables with focus foreign keys. It leaves existing documents and review snapshots unchanged. Note changes append revisions, including clearing a note; reads expose only the latest note per item. Earlier note revisions remain stored. Statuses are current values, not a history of status changes. Status and note revision tokens reject stale combined writes, including changes after clearing either field. Authorization uses server-resolved membership and focus ownership. The runtime role has only the grants needed for these operations; history remains scoped to its original focus and department when membership ends.

Progress cannot be captured in drafts. If confirmed focuses later become editable, or draft progress is introduced, positions will no longer provide stable identities: introduce durable objective and goal IDs and migrate references before allowing either behavior. Migration runs before application replacement, so schema 10 is additive and compatible with the previous application. Schema-changing production release remains manual.
