# Owner-only feature flag reporting

Date: 2026-11-11
Status: Proposed; awaiting Jaco's decision on the feature-flag exception.

## Decision

Provide a read-only `/ops/feature-flags` page in the running Lantern environment. It reports registered flag names and resolved states, not preview account addresses. Access requires an admitted session, active department membership and an exact match to the normalized `LANTERN_FLAG_OWNER_EMAIL` environment setting. Unset means no account can view the page. The environment owner sets the optional value; a malformed value stops startup. Railway remains authoritative for changes.

The private LanternBot board links to this page; the owner's browser accesses the environment directly. Agents and the VM do not fetch production state. Product behavior is in the [PRD](../PRD.md); flag configuration remains governed by [ADR 0014](0014-feature-flags.md).

## Rationale and consequences

A server-resolved session and explicit owner identity avoid making flag configuration public or inventing a client-supplied role. A generic department role would grant access to other people; a separate database admin role would require a schema and operational lifecycle. A VM proxy would violate the production access boundary. The page adds no schema, preview-list disclosure or flag mutation interface. The owner must set the email in each environment before the page can be used; changing it redeploys that environment. Losing admission or active membership immediately removes access.
