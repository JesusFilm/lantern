# Confirmed position focuses

Ticket: team-trial/03. Implementation is local/reviewable; no hosted migration or
application deployment is implied by this document.

A focus starts as a draft. Drafts may have no objectives or goals. After discussion,
the active career lead can confirm a current member's focus in the same department,
including the lead's own focus. Confirmation requires the existing title/date/content
validation and at least one Normal objective with a goal. It does not assess the
quality of SMART prose. The confirmation dialog identifies the person and document.

`POST /api/department/members/:memberId/focuses/:id/confirm` accepts only an integer
`version`. Identity and lead authority come from the authenticated session and
active membership. The operation serializes with membership changes, locks the
focus row, checks the expected version and atomically records confirmed status,
actor and time. Repeating confirmation at the current confirmed version returns
the original result; an older version conflicts. A concurrent edit and confirmation
cannot both succeed at the same version.

The persisted lifecycle (`draft` / `confirmed`) is separate from `version`, which
remains the optimistic concurrency counter, not historical version storage.
Owner and lead reads include `status`, `confirmedAt`, and `confirmedBy` (actor ID
and current display name). No focus content or metadata can be changed through
application routes after confirmation, including by the lead. Stale dialogs keep
rejected text so the member can copy it before closing; reopening reads the baseline.
The member and lead both see who confirmed it and when. There is no unlock, copy,
submission queue or later review workflow in this ticket.

## Migration and operational limits

Migration 4 adds lifecycle/confirmation columns and a consistency constraint to
existing focuses, defaulting them to draft without altering content, owner,
department or save version. It updates the restricted runtime column grants;
migrations remain a separate privileged process. Health readiness requires ledger
versions 1–4 and the lifecycle columns, and reports schema version 4.

Staging evidence recorded for schema 3 remains historical evidence. Before any
hosted rollout, rehearse/apply migration 4 through the existing human-run release
procedure and refresh checks affected by this feature. This task authorizes no
hosted migration or production execution. Existing production preparation records
must be refreshed to the reviewed schema-4 revision before execution.

After any confirmation, **do not roll back to code that predates confirmation**:
schema-3 application code does not enforce these locks. Select only a compatible,
confirmation-aware revision or stop traffic and prepare a tested forward correction.
Do not reset lifecycle metadata to enable a rollback. No backup recovery is promised
under the current backup decision.

These are application authorization and persistence controls. Trusted database
administrators can still change records; this feature does not introduce a database
trigger, RLS policy or cryptographic protection against them. Existing controlled
production-operation policy continues to apply.

## Verification

HTTP tests use disposable local PostgreSQL databases with separate migration,
admin and runtime logins. They cover defaults, upgrade/data preservation, completeness,
request validation, member/lead boundaries, stale versions, duplicate confirmation,
concurrent save/confirm, locked mutations, failed-write recovery and fresh app reads.
Browser tests use the real HTTP/storage path and synthetic sessions to cover explicit
confirmation/cancellation, error/retry, unchanged content, rejected-input preservation
and read-only owner/lead views. They are not the parked live Google two-member
acceptance case and do not claim hosted acceptance.
