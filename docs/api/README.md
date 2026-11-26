# API and MCP

This guide is the source of truth for how callers outside Lantern's browser app reach its data: the public API, MCP and the team API. The [operation inventory](inventory.md) lists every data operation, how it is reached today, and whether it has or should get an API or MCP path.

## Intent

Lantern moves toward API-first access gradually. In time, everything a person can do in the interface should also be possible through Lantern's API, so Lantern can be managed headlessly and agents can work with it through MCP. Full parity is a direction, not a deadline: an operation gets an API or MCP path when a need arises or time allows, in the owner's priority order. What matters now is an architecture that keeps every path open.

- Build each data operation once, as a shared operation that takes a server-resolved identity and enforces ownership, validation and permissions. Browser routes, the public API and MCP are thin adapters over it, each accepting its own credential.
- Keep the [operation inventory](inventory.md) current, so anyone can see what is available, what is wanted and what comes next.
- Open new paths on a designed foundation. Layering, errors, observability, fault tolerance and rate limiting are being designed in [#252](https://github.com/JesusFilm/lantern/issues/252).

[ADR 0021](../adrs/0021-gradual-api-first-access.md) records this decision.

## Ways in

| Caller | Routes | Credential | Status |
| --- | --- | --- | --- |
| Lantern's browser app | Internal `/api/...` | Session cookie from JFP One sign-in | Live |
| Unattended integration, such as the office TV | Team routes under `/api/v1` | Team API token | Live, behind the `team-api` flag |
| A person's app or agent | `/api/v1` | JFP One access token | Planned |
| A person's agent | `/mcp` | JFP One access token | Planned |

- **JFP One proves identity; Lantern grants authority.** JFP One establishes who is calling, through which client, and which Lantern scopes the person approved. Lantern's approvals, active membership, roles and owner list decide what that person may do. A credential never adds to that authority.
- **Each credential has its own routes.** Session cookies work on internal routes, where Lantern rejects bearer tokens. Team API tokens work only on the read-only team routes. JFP One access tokens must be issued for Lantern's API and carry the scope an operation requires.
- **MCP acts for one person.** Every MCP connection signs a person in through JFP One, so the agent works within that person's Lantern authority and approved scopes. Forge Admin and Changelog already work this way; Lantern needs its own API resource and `lantern:*` scopes registered in Forge.
- **Internal routes serve the browser app only.** They are unversioned and change with the interface. Other callers use `/api/v1`, whose versioning rules come with the foundation design.

## Team API and API-first

The team API is Lantern's first public API, and it already follows the API-first pattern. One team-updates operation serves the web app's **My team** page at `/api/team-updates` with a session and the office TV at `/api/v1/team-updates` with a team API token; only the identity check differs.

The team API token stays as Lantern's integration credential for unattended servers: a member issues it, it reads one department, and it never writes. See the [team API contract](../development/team-api.md) and [ADR 0020](../adrs/0020-team-api-bearer-tokens.md). A member who wants the same team data in an agent uses MCP with their own JFP One sign-in.

## MCP goals

The owner's current goals, reflected in the inventory's MCP column:

1. **Owner administration.** Manage departments, career leads, members and sign-in approvals through an agent, with validation and audit, instead of changing the database directly. The [owner administration plan](../plans/owner-administration-api.md) approves the first scope.
2. **Members' own work.** Members read and update their own position focuses and weekly goals from a terminal or IDE, and their own agents use Lantern context to give guidance.
3. **Team updates.** Members read their department's team updates through MCP.

## Changing this area

- When a change adds, removes or changes a route, `access:ops` command, operator script or other data operation, update its inventory row in the same change.
- To add an API or MCP path, check that the inventory marks it as wanted, put its logic in a shared domain operation, keep the adapter thin, and test it like other HTTP interfaces: isolated real PostgreSQL schemas, access isolation and failure paths. Update the inventory and the relevant contract document.
- Until the foundation in [#252](https://github.com/JesusFilm/lantern/issues/252) is agreed, public paths beyond the approved owner administration plan need the owner's agreement.
