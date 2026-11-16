# Complete the JFP One account cutover

Date: 2026-11-16
Status: Accepted by the repository owner on 2026-11-16

Refs [#136](https://github.com/JesusFilm/lantern/issues/136) and
[#142](https://github.com/JesusFilm/lantern/issues/142).

## Decision

JFP One is Lantern's sole hosted interactive authentication provider. Retain
[ADR 0015](0015-jesus-film-identity.md)'s fixed issuer, signed human identity,
verified email, PKCE and Lantern-owned admission/membership boundaries. Preserve
stable Lantern account IDs when migrating their sign-in identity. The physical
`google_sub` column continues storing namespaced JFP subjects; its legacy name
neither enables Google sign-in nor justifies a separate rename migration.

Use a one-time administrative plan/apply workflow. Administrators look up the
affected email; the tool discovers internal IDs and produces a private plan
showing the original profile, department, role and focus count for review. JFP's provider-account records can establish continuity from
an original Google subject to a JFP user ID; source availability does not prove
any particular user's mapping. Lantern receives no runtime Auth-database access.
Email equality detects ambiguity and never transfers account authority. A refused
provider-verified JFP sign-in leaves a private 24-hour identity receipt, enabling
review before a duplicate exists. The receipt grants no access. Multiple original
accounts or JFP identities refuse email-based planning; expired or changed
receipts and changed original summaries refuse apply.

Registration refuses an identity whose normalized email belongs to another
account, including existing duplicates and conflicting email changes. Account
registration, administrative linking/recovery and membership writes share the
existing transaction lock. Runtime cannot change identity bindings or delete
accounts. Schema 11 adds a membership-insert trigger, protecting both the runtime
enrollment function and administrative inserts without rewriting existing history.
It also adds the private identity-receipt table with scoped runtime/admin grants.
Add user exposes unresolved conflicts as unavailable for enrollment.

Recovery plans bind the database/schema, original account, expected binding,
verified JFP subject/email and optional duplicate. Apply revalidates the plan,
revokes both accounts' sessions, removes only the explicitly selected empty
duplicate and binds the original in one transaction. Every foreign-key business
reference prevents duplicate removal, including future cascading references.
Keep the original profile, memberships, department scope, focuses and authorship.
Stale/conflicting/populated cases fail closed; a populated merge needs a separate
reviewed decision. Repeating a completed recovery preserves fresh sessions.

Finish the hosted cutover with separately planned whole-environment session
invalidation. Session rows lack provider provenance; a reviewed digest/count
prevents applying a stale plan. New JFP logins then establish ordinary Lantern
sessions. Preserve explicitly local and private acceptance fixtures.

## Rationale and consequences

Automatic email linking lacks continuity evidence. Two active providers and a
self-service linking workflow add unwanted authentication surfaces. A separate
multiple-provider identity table is unnecessary for a single-provider cutover.
The former unclaimed-subject-only command cannot recover existing duplicates.

This replaces ADR 0015's unmatched-subject registration and account-recovery
procedure. Its JFP provider/token-validation decision remains accepted. Schema 11
is additive and compatible with the serving application; it blocks new ambiguous
enrollment but retains existing accounts/memberships. Production requires the
manual schema-release path and real staging JFP verification. Cutover operations
remain separately reviewed administrative actions, with production human-operated.
See the [cutover procedure](../operations/identity-cutover.md) and
[testing boundaries](../development/testing.md).
