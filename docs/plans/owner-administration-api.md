# Owner administration API and MCP plan

Status: Approved by the owner on 2026-11-16; not yet implemented.

The [PRD](../PRD.md#planned-owner-administration-api) defines the agreed product
scope. [ADR 0018](../adrs/0018-owner-administration-api.md) records the shared
service and identity boundaries. This plan is removed or incorporated into the
living guides when the work is complete.

## Versioned HTTP resources

All routes require owner authority for this increment. The HTTP interface publishes
an OpenAPI description and allows later role-specific extensions without requiring
them now.

| Method | Resource | Purpose |
| --- | --- | --- |
| GET, POST | `/api/v1/departments` | List and create departments. |
| GET | `/api/v1/departments/{departmentId}` | View a department. |
| GET | `/api/v1/departments/{departmentId}/members` | List its members. |
| GET | `/api/v1/accounts?email=...` | Find registered accounts. |
| PUT | `/api/v1/departments/{departmentId}/members/{accountId}` | Add an eligible member. |
| PUT | `/api/v1/departments/{departmentId}/career-lead` | Assign or atomically replace the lead. |
| DELETE | `/api/v1/departments/{departmentId}/career-lead` | Demote the lead to member. |
| GET, POST | `/api/v1/approved-emails` | List or add exact email approvals. |

The MCP server exposes these operations to a client acting for an authenticated
owner. Its calls enforce the same authority and audit behavior as HTTP. Do not
accept an ID token or browser cookie as a resource access token, or forward a
token to an audience for which it was not issued.

## Phases

1. **Design and governance.** Record the product and architecture decisions;
   define a tested Forge token contract for verified human identity and
   appropriate resource audiences. Propose the Ops policy change allowing
   authorized Lantern production administration from the VM through this HTTP
   API and MCP. Direct Railway and production-database access are outside that
   change. The plan itself does not change the VM's current access rules.
2. **Administration services.** Build shared permission-checked operations and
   narrowly scoped database privileges, reusing existing administration and
   enrollment logic where appropriate. Add compatible persistence for audit and
   unique active department names. Preserve unrelated browser workflows.
3. **Authorization and HTTP.** Register the resource and single admin scope in
   Forge; implement human token verification, owner-list checks, rate limits,
   versioned routes and the OpenAPI description. Extend the existing owner
   variable without breaking its single-email setting. Guard new behavior with
   feature flags and preserve browser session and origin protections.
4. **MCP.** Add agent-facing administration with JFP One sign-in, shared
   authorization and audit. Verify the token audiences and browser-to-VM login
   callback end to end; do not rely on manually extracting a session cookie.
5. **Verification and release.** Use test-first slices with isolated real
   PostgreSQL schemas for HTTP and browser behavior. Cover persistence,
   validation, access isolation and failures, including ambiguous accounts,
   duplicate names, concurrent lead replacement, other-department and former
   members, owner removal, token errors, audit failure and 90-day retention,
   limits and flag states.
   Preserve existing regression coverage. Perform a real JFP One staging sign-in
   and verify the MCP flow with synthetic staging data. Follow the
   [testing guide](../development/testing.md) and [release procedure](../operations/releasing.md):
   hold automatic promotion for auth changes, use compatible migrations and
   manually release schema changes. Include applicable QA manual updates and
   staging acceptance evidence; local fixtures do not prove hosted sign-in.

Later API and MCP paths, including members' own focuses and weekly goals, follow
[ADR 0021](../adrs/0021-gradual-api-first-access.md) and are prioritized in the
[operation inventory](../api/inventory.md). Observer views, a full CLI and an
interactive API page require a separate product decision. Remove this plan when
its work is completed and the lasting instructions are in the relevant guides.
