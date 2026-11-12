# Owner-only feature flag reporting

Date: 2026-11-11
Status: Accepted by Jaco.

## Decision

Provide a read-only `/ops/feature-flags` page in the running Lantern environment. It reports registered flag names and resolved states, not preview account addresses. Hosted access requires an admitted session, active department membership and an exact match to the normalized `LANTERN_FLAG_OWNER_EMAIL` environment setting. Explicitly enabled loopback-only local access instead uses its synthetic local account without a session or admission check; the owner email and active membership still must match. Unset means no account can view the page. The environment owner sets the optional value; a malformed value stops startup. Railway remains authoritative for changes.

As an exception to [ADR 0014](0014-feature-flags.md), this page has no separate registered feature flag. The owner email setting controls access and is disabled when unset.

The private LanternBot board links to this page; the owner's browser accesses the environment directly. Agents and the VM do not fetch production state. Product behavior is in the [PRD](../PRD.md); flag configuration remains governed by [ADR 0014](0014-feature-flags.md).

## Rationale and consequences

A server-resolved hosted session and explicit owner identity avoid making flag configuration public or inventing a client-supplied role. A generic department role would grant access to other people; a separate database admin role would require a schema and operational lifecycle. A VM proxy would violate the production access boundary. The page adds no schema, preview-list disclosure or flag mutation interface. The owner must set the email in each environment before the page can be used; changing it redeploys that environment. In hosted environments, losing admission or active membership immediately removes access.
