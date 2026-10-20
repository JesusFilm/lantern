# A source-bound draft focus workflow

Date: 2026-10-20
Status: Accepted by the repository owner

## Decision

The client [draft-workflow module](../../client/workspace/useDraftFocusWorkflow.ts)
owns selection and read ordering for the member's own focuses, the pending edit's
source document and version, typed metadata/objective/SMART-goal
changes, initiative readiness, and successful save completion. Its interface
exposes presentation state and editing/navigation intents. React views render that
state and capture intent; the generic Dialog retains busy, error and cancellation
behavior.

Within Position Focuses, browser Back/Forward changes the reading destination
without replacing or discarding a pending edit. The dialog remains attached to its
original document/version. Save writes that source and opens the saved document;
Cancel reveals the navigation destination. Superseded reads cannot change the
selected document or overwrite save completion. Failed saves retain pending input
and never silently rebase it onto a newer version.

## Rationale and alternatives

Array helpers alone leave callers coordinating source identity, version, initiative
loading and navigation. A generic form engine or routing replacement adds a larger
interface than this workflow needs. A dedicated module provides depth by hiding
that coordination behind a small intent-based interface, with locality for lifecycle
rules. [Browser workflows](../../server/draft-workflow.browser.test.ts) and HTTP
reads against isolated PostgreSQL exercise the public seam, including deliberately
reordered real responses.

## Consequences

- Saved snapshots are read-only inputs to editing. Writes send initiative IDs and
  Other under [ADR 0004](0004-focus-alignment-history.md); the server still owns all
  alignment history, identity, membership, ownership, persistence and confirmation
  locking. No schema, HTTP contract or deployment change is required.
- The source snapshot remains fixed until save succeeds or the edit is cancelled.
  Stale or confirmed writes keep the server's recovery message and pending input.
- Superseded and unmounted workflow instances ignore asynchronous completions.
  Leaving Position Focuses or reloading the page still ends the in-memory edit;
  cross-page retention, durable drafts and navigation interception are outside
  this decision.
- The owner agreed to the module and Back/Forward behavior before implementation
  on 20 October 2026.
