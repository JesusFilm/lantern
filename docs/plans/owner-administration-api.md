# Owner administration API and MCP plan

Status: Approved by the owner on 2026-11-16. The staging department list is
the first implementation slice, in [#255](https://github.com/JesusFilm/lantern/issues/255).

The [PRD](../PRD.md#planned-owner-administration-api) defines product scope.
[ADR 0018](../adrs/0018-owner-administration-api.md) records identity and
authorization boundaries. Remove or incorporate this plan into the living
guides when the work is complete.

## Slice 1

The [API guide](../api/README.md#owner-department-list) covers the read-only
contract, and [onboarding](../api/owner-onboarding.md) covers the Forge
registration, separate REST/MCP owner list, account linking and Mac consent.
The existing feature-flag page retains its own configuration and browser
authorization. This slice ships with no schema change and production disabled
under the [release decision](../operations/releasing.md#owner-api-slice-1).
Production activation is tracked in
[#270](https://github.com/JesusFilm/lantern/issues/270).

## Later versioned HTTP resources

The owner API will publish an OpenAPI description. MCP calls use the same
shared authorization, validation and audit as HTTP.

| Method | Resource | Purpose |
| --- | --- | --- |
| POST | `/api/v1/departments` | Create a department. |
| GET | `/api/v1/departments/{departmentId}` | View a department. |
| GET | `/api/v1/departments/{departmentId}/members` | List its members. |
| GET | `/api/v1/accounts?email=...` | Find registered accounts. |
| PUT | `/api/v1/departments/{departmentId}/members/{accountId}` | Add an eligible member. |
| PUT | `/api/v1/departments/{departmentId}/career-lead` | Assign or atomically replace the lead. |
| DELETE | `/api/v1/departments/{departmentId}/career-lead` | Demote the lead to member. |
| GET, POST | `/api/v1/approved-emails` | List or add exact email approvals. |

## Remaining work

1. Agree the common [API foundation in #252](https://github.com/JesusFilm/lantern/issues/252),
   including audit, rate limits, error contracts and OpenAPI. Slice 2 adds
   department creation under [#256](https://github.com/JesusFilm/lantern/issues/256).
   Use narrowly scoped write grants and compatible migrations for transactional
   audit records and unique active department names.
2. Test each operation against isolated PostgreSQL, including ambiguous accounts,
   duplicate names, concurrent lead changes, former and cross-department members,
   owner removal, audit failure and retention, rate limits and flag states.
3. Preserve browser sessions, origin checks and credential isolation. Use real
   JFP One consent on staging with synthetic data and follow the
   [release procedure](../operations/releasing.md) for live auth changes and
   manual schema releases. Verify VM-over-SSH agent sign-in separately.
4. Any production administration from the VM through the API and MCP needs a
   separate Ops policy decision. Direct Railway and production database
   administration stay with the human operator.

Members' own operations and team data follow [ADR 0021](../adrs/0021-gradual-api-first-access.md).
Ownership remains server-resolved and agent access for members defaults to
none. Prioritize later paths through the [inventory](../api/inventory.md).
