# Owner administration API and MCP

Date: 2026-11-16
Status: Accepted by the repository owner; implementation planned.

Superseded in part: 2026-11-26 — the deferral of broader browser-operation migration
is replaced by [ADR 0021](0021-gradual-api-first-access.md).

## Decision

Introduce versioned administration HTTP resources and an MCP interface using
shared, permission-checked administration services. The [PRD](../PRD.md#planned-owner-administration-api)
defines the operations and product behavior. Publish an OpenAPI description;
defer an interactive API page. [ADR 0021](0021-gradual-api-first-access.md) sets
how further browser operations gain API and MCP paths.
Preserve existing browser routes, authorization and account-linking behavior.

JFP One issues resource-bound tokens for active, verified human identities. Lantern
validates the token, its intended audience, expiry, scope and verified identity,
then matches the identity against `LANTERN_FLAG_OWNER_EMAIL`, extended to a
comma-separated list. One Lantern admin scope and one owner role cover this
increment; the scope alone does not grant owner authority. Owner administration
does not require ordinary Lantern admission or department membership. A client
must not supply its own owner or role grant. Forge must provide a tested contract
for verified identity claims or an equivalent trusted identity resolution; its
current access-token claims cannot be assumed to include verified email.

The existing flag-reporting behavior in [ADR 0017](0017-owner-flag-reporting.md)
remains in force until the list change is released. The list then replaces its
single configured email while retaining the report's session, admission and
membership checks. Existing browser tokens remain server-side under
[ADR 0015](0015-jesus-film-identity.md); resource access tokens have their own
audience and are not browser session cookies or ID tokens.

## Rationale and consequences

An owner-configured list and delegated JFP One identity fit the existing
environment configuration and avoid a separate admin grant database or policy
per operation. Owner removal takes effect after the configuration redeploy;
upstream session revocation may take until an issued token expires. MCP clients
perform an authorized sign-in and use the same checks and audit trail as HTTP.
An owner may separately grant themselves a career-lead role, whose normal
department-scoped focus access applies; owner status itself exposes no focus data.

The admin path requires narrowly scoped database write privileges, transactional
audit records, rate limits, and coordinated Forge resource registration. Browser
and bearer authentication must retain their respective protections. Agree and
verify the API/MCP token audiences and the browser-to-VM sign-in flow during
implementation; do not assume the existing JFP One client issues a Lantern API
token. Schema changes require a compatible migration and manual production
release. The [plan](../plans/owner-administration-api.md) records the phases and
the proposed VM governance change; it does not itself grant production access.
