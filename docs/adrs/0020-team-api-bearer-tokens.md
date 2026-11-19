# Read-only bearer tokens for the separate TV app

Date: 2026-11-19
Status: Proposed implementation of the owner-requested bearer API

The owner requested splitting the TV dashboard into a separate application and
accessing Lantern data with bearer authentication. Use versioned, read-only
team-update and cached-avatar endpoints. Retain the existing browser sign-in
and session boundary from [ADR 0015](0015-jesus-film-identity.md).

Use opaque random tokens with a recognizable prefix and 256 bits of entropy.
Store only their SHA-256 digests, creator, department, expiry and revocation
metadata in PostgreSQL. The normal authenticated Account flow creates and
revokes tokens; a bearer credential cannot manage credentials or edit data.

Resolve approval, active membership and the original department on every bearer
request. Reuse the team snapshot store with an expected department check inside
its membership transaction. Do not allow a token to follow its creator into a
different department. The separate TV app holds the secret on its backend and
proxies data/images to its browser.

Opaque database-backed tokens give immediate revocation without adding a JWT
issuer, signing-key rotation or broad OAuth grant system. A shared environment
secret would not provide per-member department scope or individual revocation.
The tradeoffs are one indexed lookup per request, additive migration 17 and token
renewal after 90 days. The capability remains behind `team-api` and the existing
`team-updates` feature. See [the API contract](../development/team-api.md) and
[product requirements](../PRD.md#weekly-goals-and-daily-updates).
