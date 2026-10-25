# Focus writes own initiative snapshot history

Date: 2026-10-20
Status: Accepted by the repository owner

## Decision

The position-focus write module accepts draft alignment choices containing initiative
IDs and Other, and returns saved documents containing trusted names and appearance.
Draft choices and saved snapshots have separate shared types. HTTP validation accepts
legacy snapshot-shaped choices, validates any supplied name and appearance, then
discards those fields before crossing the write interface.

Snapshot resolution is private to [focus writes](../../server/focus.ts). Department
direction remains responsible for career-lead configuration and its authenticated
read interface. Focus writes read that configuration and their own persisted history
inside the existing membership-write transaction and advisory lock. HTTP continues
to resolve identity and validate requests; the browser captures choices and displays
saved snapshots.

## Rationale and alternatives

Keeping snapshot-shaped draft inputs and merely moving or renaming the exported
resolver would leave callers responsible for historical fields. A separate public
snapshot module would still require callers to supply previous sections and use the
correct transaction. Neither gives the write interface useful additional depth.

Owning resolution privately gives callers leverage: create/update need only member
intent, while trusted identity and archived-reference accounting have locality with
the persisted document. The authenticated HTTP/browser seam exercises this behavior
with real PostgreSQL; no generic snapshot framework or hypothetical storage adapter
is introduced.

## Consequences

- Active initiative names and appearance refresh from current trusted configuration
  on each draft save.
- Archived uses retain snapshots from the previous saved focus, consumed in section
  traversal order and counted across the whole focus. They are not tied to stable
  objective identities. Additional uses and cross-department choices remain invalid.
- Confirmation does not resolve alignment again: the agreed baseline stays unchanged.
- Saves remain atomic and versioned. Membership checks, configuration writes, focus
  saves and confirmation retain their transaction/locking relationship.
- Existing clients can continue sending validated snapshots; new clients send choices.
  Compatibility validation remains necessary while those clients are supported.
- Persistence and deployment require no schema change or migration. Objective IDs,
  different history semantics and authoring workflow redesign are outside this decision.
