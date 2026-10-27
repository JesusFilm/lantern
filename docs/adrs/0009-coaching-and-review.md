# Production coaching and versioned review

Date: 2026-10-28
Status: Accepted scope from the owner's approved prototype and production request

## Decision

Implement the accepted member and career-lead flows as ordinary authenticated
Lantern features. Preserve existing manual focus editing and all objective types.
Coaching targets one objective/goal while retaining the rest of its source document;
a stale source cannot silently overwrite newer work. Save, request review and
career-lead confirmation remain separate actions.

Extend the focus write transaction to include an optional owner-only coaching
checkpoint. Normal manual saves invalidate the checkpoint and confirmation removes
it. Store review requests as immutable full-focus version snapshots; notes reference
a request, allow addition/author soft-deletion, and use per-user read acknowledgments.
Require the latest requested version to match the latest saved version before
confirmation whenever a request exists. Enforce that rule in the shared confirmation
path and a database guard covering older instances during rollout. Existing manual
confirmation without a request remains supported.

Keep model access behind a server-only provider interface with bounded HTTP calls
and output validation. Use the existing Qwen gateway protocol first, then OpenRouter
Gemini on primary failure. Cool down a failed primary, cancel on disconnect, and
retain manual editing when both providers fail. Enabled deployments require both
credentials. Models receive no authority to save, confirm, call tools or query other
members. Project-context retrieval and notifications remain deferred.

## Rationale and consequences

The prototype's scratch JSON storage, role-switch URLs and non-atomic two-step saves
cannot provide production authority or consistency. Normalized requests/notes/read
markers allow narrow grants and immutable submitted history. Checkpoints belong to
focus writes, extending [ADR 0005](0005-draft-focus-workflow.md) with explicit durable
save/resume while preserving [ADR 0004](0004-focus-alignment-history.md)'s server-owned
initiative snapshots. There are no stable objective IDs or implicit merge/rebase.

Schema 9 is additive and requires a manual schema release under the existing delivery
policy. No live provider credentials or external calls are needed for deterministic
HTTP/browser failure tests. Live staging connectivity still requires the dedicated
keys and separate release evidence; fixtures do not certify model quality or uptime.
Operational limits and key setup are in [Coaching](../operations/coaching.md).
