# Jesus Film Auth identity and explicit account matching

Date: 2026-11-11
Status: Accepted by the repository owner

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

Match the one existing production account through the administrative
`link-auth USER_UUID AUTH_SUBJECT VERIFIED_EMAIL` operation. The operator obtains
the subject and verified email from trusted Auth records before execution.
Require the exact existing account ID, its approved email and an unclaimed
subject. Preserve the account ID, profile, documents and membership, and revoke
its old sessions atomically. Repeating the same match is safe; replacing an
already matched Auth identity is refused.

## Rationale and alternatives

Automatic email linking would allow a different provider subject to inherit
existing department authority. Keeping Google alongside Auth adds a second login
and linking surface the owner chose to replace. The explicit one-account match
preserves the requested production history without granting the runtime role
permission to change identity bindings.

## Consequences

No schema migration or additional runtime database grant is required. Future
provider or account recovery work must use an explicit administrative decision.
An approved but unmatched subject receives a separate account without inheriting
membership. Coordinate the production match with the Auth-enabled release;
matching early would prevent the old Google identity from reaching its account.
A real staging Auth journey remains required before production promotion, as
described in [releasing](../operations/releasing.md). Local signed-token fixtures
and post-login acceptance do not prove the hosted provider journey.

This replaces provider-specific Google references in
[ADR 0006](0006-authenticated-release-acceptance.md) and
[ADR 0008](0008-staging-gate-and-production-smoke.md); their post-login acceptance
architecture remains current.
