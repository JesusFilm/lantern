# Gradual API-first access through shared operations

Date: 2026-11-26
Status: Accepted by the repository owner; foundation design open in [#252](https://github.com/JesusFilm/lantern/issues/252)

## Decision

Lantern moves toward API-first access gradually. Each data operation is implemented
once as a shared operation in a domain module. It receives a server-resolved
principal and enforces ownership, validation and permissions. Callers reach it
through adapters that differ only in transport and credential: internal browser
routes with the signed-in session, the public versioned `/api/v1` routes, and an
MCP server.

The public API and MCP accept JFP One access tokens issued for Lantern's API
resource and scopes on behalf of a signed-in person; MCP accepts only these. JFP
One establishes identity, client and approved scopes. Lantern's approvals,
membership, roles and owner list remain authoritative, as in
[ADR 0015](0015-jesus-film-identity.md).

The team API token from [ADR 0020](0020-team-api-bearer-tokens.md) remains a
separate integration credential for unattended read-only callers. Its team-update
and avatar routes are the first `/api/v1` resources. MCP offers the same team data
through the member's own JFP One token.

Full interface parity is the direction, not a delivery requirement. The
[operation inventory](../api/inventory.md) records each operation's current path
and its API and MCP status, and the owner prioritizes new paths from it.
[Owner administration](0018-owner-administration-api.md) is the first increment.
The [API and MCP guide](../api/README.md) states the working rules.

## Rationale

A shared operation keeps one set of rules whichever caller uses it; the team-update
route already serves the browser and the TV this way. A separate API or MCP
implementation over the database would duplicate permission and validation logic
and let the paths drift. Converting every operation now would spend effort on
paths with no known need. Reusing team API tokens for MCP would give agents a
department-pinned credential with no person, consent or scope behind it;
person-delegated JFP One tokens match both Forge's existing MCP servers and
Lantern's authority model.

## Consequences

- Changes that add or change a data operation update the inventory in the same change.
- Routes that query the database inside the HTTP handler, such as the department
  and account routes in [access.ts](../../server/access.ts), move into domain
  modules before they gain API or MCP paths.
- `/api/v1` must send each bearer token to the right verifier, team API token or
  JFP One access token, without widening either.
- Forge must register Lantern's API resource and scopes before JFP One access
  tokens work. Forge Admin resolves a token's subject to its own account; Lantern
  can resolve it to the account linked at sign-in.
- Every MCP connection needs a person to sign in. Unattended callers, such as the
  office TV, need their own credential decision; the team API token is the current one.
- Per-person agent access, stored and managed in Lantern, gates every request made
  with a JFP One access token. JFP One scopes record what a client asked for and
  the person approved; they are not per-person permissions. This needs additive
  schema, designed in [#252](https://github.com/JesusFilm/lantern/issues/252).
- Layering, error model, observability, fault tolerance, rate limiting, audit and
  OpenAPI generation need a foundation design before broad exposure, tracked in
  [#252](https://github.com/JesusFilm/lantern/issues/252).
