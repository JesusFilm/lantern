# Private experimental AI members

Date: 2026-11-03
Status: Accepted — implementation of the owner's agreed specification

## Decision

Keep AI members separate from human accounts, department membership and human
focus/review history. Store owner profiles, one optional current focus, and named
hash-only credentials in three additive schema-10 tables. The server resolves
immutable owner identity from an admitted Google session; a server-only exact
email allowlist and current active membership gate management and each retrieval.
Expose only the resolved capability to the browser. Local synthetic access does
not confer this capability.

Reuse the existing restricted runtime pool, with explicit table grants and
column-specific updates excluding IDs and ownership/relationship fields. Keep
migration and administration credentials separate. The HTTP layer validates
requests; the store enforces eligibility, ownership and persistence. All operations
that mutate a member or read a consistent detail snapshot lock the member row
before any focus/token child. Consumer credential lookup is an untrusted hint:
lock its member, then recheck the verifier and current eligibility. Commit exact
served-version telemetry before returning success. Profile revision, focus version
and credential revision are independent; retrieval never increments editor versions.
Deleting a member cascades its children; deleting a human is restricted and
requires explicit handling of owned AI members.

Coaching uses the existing provider/fallback interface and the same per-human and
global admission controller as human coaching. A provider call holds no database
locks. Its sole member-specific input is stored purpose and pending objective/goals;
output is bounded and validated. Suggestions remain transient browser state until
Apply and Save. Consumer credentials cannot authenticate management or coaching.

## Rationale and alternatives

Reusing human focuses would couple agent credentials to departments, confirmation
and retained human history. Separate tables preserve the experimental boundary and
allow narrow grants. A SELECT-only consumer connection cannot commit retrieval
evidence; the service pool supplies SQL authority while server checks enforce
individual owner/token isolation. Per-member serialization is simpler than several
independent child locks and prevents rotation/deletion races from resurrecting
credentials. It briefly serializes reads, an acceptable cost for the small pilot.

SHA-256 verification of 256-bit random secrets avoids recoverable credential
storage and additional encryption keys. A bounded per-instance limiter avoids an
extra distributed service at pilot load. It is not a cross-instance quota.

## Consequences

Schema 10 must be applied before the replacement app through the normal manual
schema-release process. Keep the additive schema on rollback and retain data when
the allowlist is disabled. Previously authorized in-flight snapshots may complete;
revocation cannot recall content already retrieved. There is no retained focus
revision history, agent write API, token expiry or ownership transfer.

Product behavior and QA exclusion belong to the
[contract](../specs/experimental-ai-members.md) and [PRD](../PRD.md#experimental-ai-members).
[Operations](../operations/ai-members.md) describes limits and staging activation.
This decision authorizes no hosted changes or production activation.
