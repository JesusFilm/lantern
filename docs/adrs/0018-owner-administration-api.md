# Owner administration API and MCP

Date: 2026-11-16
Status: Accepted by the repository owner. The read-only staging slice was approved in [#255](https://github.com/JesusFilm/lantern/issues/255) on 27 November 2026.

Superseded in part: 2026-11-26 — the deferral of broader browser-operation migration
is replaced by [ADR 0021](0021-gradual-api-first-access.md).

## Decision

Use versioned REST resources and MCP adapters over shared, permission-checked
administration operations. The first operation lists active department IDs and
names on staging. Enable it with `owner-api`, which defaults off in all
environments. Production activation has a separate decision in
[#270](https://github.com/JesusFilm/lantern/issues/270).
The [PRD](../PRD.md#planned-owner-administration-api) defines product behavior.
OpenAPI belongs to the later increment.

A dedicated JFP One registration issues delegated tokens for the environment's
`APP_ORIGIN/mcp` resource. The owner routes check the signature against JFP One's
published keys and verify the issuer, resource audience, expiry, app and
environment claims and the `lantern:admin` scope. The fixed issuer's exact
UserInfo endpoint is the only permitted extra audience. Lantern resolves the
signed subject to its existing `jesusfilm:<subject>` account. The verified human
browser sign-in supplies that link. Lantern checks the linked account's email
against the dedicated `LANTERN_ADMIN_API_OWNER_EMAILS` list. A duplicate normalized
email or an unexpired recovery receipt for a competing verified subject blocks
owner access. The owner read requires neither continuing email approval nor
active department membership.

The feature-flag report keeps the single-email setting and session requirements
in [ADR 0017](0017-owner-flag-reporting.md). Browser sessions retain
[ADR 0015](0015-jesus-film-identity.md)'s boundary. Existing team API routes keep
their integration token verifier. Dispatch by route so each public credential
is only accepted for its operation.

## Rationale and consequences

Linking by subject establishes continuity with Lantern's verified sign-in and
lets Forge keep email out of its token contract. Resource scope records what the
person consented to. Owner configuration grants the operation without a new
schema or database grant. Owner removal takes effect when the new configuration
is serving. An access token may remain valid until expiry after upstream
sign-out. An owner who also holds a career-lead role has the usual access
through that role.

The [plan](../plans/owner-administration-api.md) covers writes, transactional
audit and rate limits. Use a compatible migration and manual release for schema
changes. Follow the [scoped release decision](../operations/releasing.md#owner-api-slice-1)
for shipping the read-only code with production disabled.
