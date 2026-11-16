# Jesus Film Auth identity and explicit account matching

Date: 2026-11-11
Status: Accepted by the repository owner

Superseded in part: 2026-11-16 — unmatched-subject registration and account
recovery/cutover replaced by [ADR 0019](0019-sign-in-collision-recovery.md).
The single JFP provider and token-validation boundaries remain current.

## Decision

Replace Google sign-in with Jesus Film Auth using its public authorization-code
client and PKCE. Verify signed OIDC ID tokens against the fixed Auth issuer and
JWKS, including audience, lifetime, nonce, verified email and human actor type.
Keep tokens server-side and retain Lantern's state cookie, session and admission
boundaries. Forge's first-party registry owns exact environment callback URLs;
its normal deployment seeds the public clients.

Use the stable provider subject as the identity key, namespaced as
`jesusfilm:<subject>` in the existing `users.google_sub` column. Its legacy name
is retained to avoid an unnecessary schema and runtime-privilege migration.
Lantern's exact-email approval, active department membership and local roles
remain authoritative; upstream membership and role claims grant no Lantern access.

Account recovery and the completed session cutover follow
[ADR 0019](0019-sign-in-collision-recovery.md).

## Rationale and alternatives

Automatic email linking would allow a different provider subject to inherit
existing department authority. Keeping Google alongside Auth adds a second login
and linking surface the owner chose to replace. The explicit one-account match
preserves the requested production history without granting the runtime role
permission to change identity bindings.

## Consequences

The original provider replacement required no schema or additional runtime grant.
Schema 11 and current recovery rules are documented in ADR 0019.
A real staging Auth journey remains required before production promotion, as
described in [releasing](../operations/releasing.md). Local signed-token fixtures
and post-login acceptance do not prove the hosted provider journey.

This replaces provider-specific Google references in
[ADR 0006](0006-authenticated-release-acceptance.md) and
[ADR 0008](0008-staging-gate-and-production-smoke.md); their post-login acceptance
architecture remains current.
