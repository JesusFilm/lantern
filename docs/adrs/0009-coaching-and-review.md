# Production coaching and versioned review

Date: 2026-10-28
Status: Accepted for provider isolation and versioned review storage
Superseded: 2026-10-29 — authoring and checkpoint lifecycle replaced by [ADR 0010](0010-integrated-focus-assistance.md) and [ADR 0011](0011-objective-authoring-methods.md).

Product intent and exceptions for review are recorded in the [review and confirmation rules](../rules/review-and-confirmation.md).

## Decision

Implement the accepted member and career-lead flows as ordinary authenticated
Lantern features. Preserve existing manual focus editing and all objective types.
Coaching targets one objective/goal while retaining the rest of its source document;
a stale source cannot silently overwrite newer work. Save, request review and
career-lead confirmation remain separate actions.

Store review requests as immutable full-focus version snapshots; notes reference
a request and use per-user read acknowledgments. Focus writes, notes and confirmation
share server-enforced authority and transaction locking. The shared confirmation path and a database guard enforce the current-version
request requirement ([RC-01 and RC-02](../rules/review-and-confirmation.md));
the guard also covers older instances during rollout.

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
