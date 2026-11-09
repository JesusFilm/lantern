# Progress on confirmed focuses

Date: 2026-11-09
Status: Accepted by the repository owner

## Decision

Store objective and goal progress separately from the focus and review discussions. Progress is available only once a focus is confirmed. Its locked section and goal positions identify targets; no draft identity or backfill is needed. The server validates each position against the confirmed document while holding the membership-write lock. The member can edit a current note and set or clear its status in one atomic operation. The active career lead can read the same records within the department but cannot change them.

## Consequences

The additive migration creates separate status and note tables with focus foreign keys. It leaves existing documents and review snapshots unchanged. Note changes append revisions, including clearing a note; reads expose only the latest note per item. Earlier note revisions remain stored. Statuses are current values, not a history of status changes. Status and note revision tokens reject stale combined writes, including changes after clearing either field. Authorization uses server-resolved membership and focus ownership. The runtime role has only the grants needed for these operations; history remains scoped to its original focus and department when membership ends.

Progress cannot be captured in drafts. If confirmed focuses later become editable, or draft progress is introduced, positions will no longer provide stable identities: introduce durable objective and goal IDs and migrate references before allowing either behavior. Migration runs before application replacement, so schema 10 is additive and compatible with the previous application. Schema-changing production release remains manual.
