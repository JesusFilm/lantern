# Operation inventory

Every create, read, update and delete operation Lantern performs on its data, how each is reached today, and whether it has or should get an API or MCP path. This is the record of where API-first stands; the [API and MCP guide](README.md) explains the direction and [when to update this file](README.md#changing-this-area). Checked against `main` on 26 November 2026.

## Priorities

1. **Owner administration**: DEP-1, DEP-2, DEP-4 to DEP-8, APR-1 and APR-2. Approved in the [owner administration plan](../plans/owner-administration-api.md) and authorized by the owner list; waits on the foundation design in [#252](https://github.com/JesusFilm/lantern/issues/252) and Lantern's registration in Forge.
2. **Members' own work and team updates through MCP**: agent access first (AGT-1 to AGT-3), then FOC-1 to FOC-4, WK-1 to WK-4 and WK-6. Wanted by the owner; not yet planned.

Other operations wait for a need. The owner sets this order; record changes here.

## Reading the tables

- **Op**: C create, R read, U update, D delete.
- **Path today**: `UI` is the browser app through an internal route. `CLI` is an `npm run access:ops` command using the admin database connection. `SQL` is a manual operator script or direct database change. `Config` is an environment setting. `Integration` is a public API caller. `Not built` is agreed but has no implementation yet.
- **API**: `v1` is available under `/api/v1`. `planned` is in an approved plan. `wanted` means the owner has asked for it but it is not yet planned. `—` means none yet.
- **MCP**: `wanted` means the owner has asked for it. `candidate` fits a stated owner goal and awaits the owner's confirmation. `—` is undecided. `n/a` is a browser or deployment mechanism rather than an operation for agents.
- IDs are stable. When an operation is removed, mark the row removed instead of reusing its ID.

## Accounts and sign-in

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ACC-1 | Sign in with JFP One, creating or matching the account, and start a session | C R U | Approved person | UI | `GET /auth/jesusfilm`, `GET /auth/jesusfilm/callback` | — | n/a | Production aliases redirect with HTTP 308 to `APP_ORIGIN` before sign-in; paths and query strings are retained. API and MCP callers use JFP One access tokens instead. |
| ACC-2 | Read own session: account, department, role and enabled features | R | Signed-in person | UI | `GET /api/session` | — | candidate | An agent needs this to know whose account and department it acts for. |
| ACC-3 | Sign out | D | Signed-in person | UI | `POST /api/sign-out` | — | n/a | Deletes the session. |
| ACC-4 | Change own display name | U | Signed-in person | UI | `PATCH /api/account` | — | — | |
| ACC-5 | Read or save own GitHub username | R U | Member | UI | `GET` and `PATCH /api/integrations/github/profile` | — | — | |
| ACC-6 | Link a JFP One identity to an existing account | U | Operator | CLI | `link-auth` | — | — | Identity repair; see [ADR 0019](../adrs/0019-sign-in-collision-recovery.md). |
| ACC-7 | Plan and apply recovery of a duplicate sign-in | R U D | Operator | CLI | `plan-auth-recovery-by-email`, `plan-auth-recovery`, `apply-auth-recovery` | — | — | Removes only a verified empty duplicate. |
| ACC-8 | Plan and apply a session cutover | D | Operator | CLI | `plan-auth-session-cutover`, `apply-auth-session-cutover` | — | n/a | Ends existing sessions during an identity cutover. |
| ACC-9 | Prepare the synthetic local account | C | Developer | CLI | `local-account` | — | n/a | Local loopback database only. |

## Agent access

Agent access is the planned per-person setting described in the [API and MCP guide](README.md#ways-in). Its design, including the new schema it needs, is part of [#252](https://github.com/JesusFilm/lantern/issues/252).

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AGT-1 | List people's agent access | R | Owner | Not built | — | wanted | wanted | Owner administration. |
| AGT-2 | Grant agent access to a person | C | Owner | Not built | — | wanted | wanted | Records who granted it and when. |
| AGT-3 | Revoke a person's agent access | U | Owner | Not built | — | wanted | wanted | Applies from the next request, even while the agent's token is still valid; keeps history. |
| AGT-4 | Read own agent access | R | Signed-in person | Not built | — | — | candidate | Lets a person, or their agent, see what it may do. |

## Sign-in approval

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APR-1 | List approved emails | R | Operator | CLI | `list-approved-emails` | planned | wanted | Owner administration. |
| APR-2 | Approve an email for sign-in | C | Operator | CLI | `approve-email` | planned | wanted | Owner administration. Approval can precede the first sign-in. |
| APR-3 | Revoke an email approval | D | Operator | CLI | `remove-approved-email` | wanted | wanted | Owner administration outside the first increment. |

## Departments and membership

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEP-1 | Create a department | C | Operator | CLI for the first department, otherwise SQL | `setup DEPARTMENT LEAD_EMAIL` | planned | wanted | `setup` creates the first department with its career lead and refuses once any department exists. The planned API creates departments without a lead; DEP-7 assigns one. |
| DEP-2 | List departments and view one | R | Operator | SQL | — | planned | wanted | |
| DEP-3 | Rename or delete a department | U D | Operator | SQL | — | wanted | wanted | Owner administration outside the first increment; needs a product decision. |
| DEP-4 | List a department's members | R | Career lead, own department | UI | `GET /api/department` | planned | wanted | Planned for owners across departments; career leads keep the UI. |
| DEP-5 | Find registered accounts and their membership status | R | Career lead | UI | `GET /api/department/registered-users` | planned | wanted | Planned for owners, searching by email; career leads keep the UI. |
| DEP-6 | Add a registered account as a member | C | Career lead, own department | UI | `POST /api/department/members` | planned | wanted | Planned for owners across departments; career leads keep the UI. |
| DEP-7 | Assign or replace the career lead | C U | Operator | CLI at first setup, otherwise SQL | `setup` | planned | wanted | Only SQL can replace a lead today. The planned API replaces atomically and keeps the former lead as a member. |
| DEP-8 | Demote the career lead to member | U | Operator | SQL | — | planned | wanted | |
| DEP-9 | End a membership | U | Operator | CLI | `remove-member USER_UUID` | wanted | wanted | Sets `deleted_at` and keeps history; refuses the career lead. Owner administration outside the first increment. |
| DEP-10 | Read department direction: mission, artwork and initiatives | R | Member | UI | `GET /api/department/direction` | — | candidate | Context for members' agents giving guidance. |
| DEP-11 | Change department direction | U | Career lead | UI | `PUT /api/department/direction` | — | — | |
| DEP-12 | Seed initiatives or update their descriptions | C U | Operator | SQL | `tools/database/seed-initiative-appearance.sql`, `tools/database/update-initiative-descriptions.sql` | — | — | Manual scripts described in the README. |

## Position focuses

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FOC-1 | List own focuses | R | Member | UI | `GET /api/focuses`, `GET /api/coach/focuses` | — | wanted | Members' own work. |
| FOC-2 | Read one of own focuses | R | Member | UI | `GET /api/focuses/:id`, `GET /api/coach/focuses/:id` | — | wanted | |
| FOC-3 | Create a focus draft | C | Member | UI | `POST /api/focuses`, `POST /api/coach/save` | — | wanted | |
| FOC-4 | Update own draft | U | Member | UI | `PUT /api/focuses/:id`, `POST /api/coach/save` | — | wanted | Versioned: stale saves are rejected, and confirmation locks the focus. |
| FOC-5 | Save or clear the guided-writing checkpoint | U D | Member | UI | `PUT` and `DELETE /api/coach/focuses/:id/progress` | — | — | Records where guided writing stopped. |
| FOC-6 | Get an AI coach suggestion | R | Member, `coach` flag | UI | `POST /api/coach/suggest` | — | — | Calls the coach provider and stores nothing. Members' own agents can guide from FOC-2, DEP-10 and GDE-1. |
| FOC-7 | List a member's focuses | R | Career lead | UI | `GET /api/department/members/:memberId/focuses`, `GET /api/coach/focuses?view=lead` | — | — | |
| FOC-8 | Read a member's focus | R | Career lead | UI | `GET /api/department/members/:memberId/focuses/:id` | — | — | |
| FOC-9 | Confirm a member's focus | U | Career lead | UI | `POST /api/department/members/:memberId/focuses/:id/confirm`, `POST /api/coach/focuses/:id/confirm` | — | — | Confirmation locks the agreement. |

## Review and discussion

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REV-1 | Request a review, with an optional note | C | Member | UI | `POST /api/coach/focuses/:id/request` | — | — | |
| REV-2 | Add a review note | C | Member or career lead | UI | `POST /api/coach/focuses/:id/notes` | — | — | |
| REV-3 | Remove a review note | U | Note author | UI | `DELETE /api/coach/focuses/:id/notes/:note` | — | — | Marks the note deleted and keeps the record. |
| REV-4 | Mark review notes read | C | Member or career lead | UI | `POST /api/coach/focuses/:id/read` | — | — | |
| REV-5 | Read unread review activity | R | Member or career lead, `review-activity` flag | UI | `GET /api/review-activity` | — | — | |
| REV-6 | Mark a review request seen | C | Career lead, `review-activity` flag | UI | `POST /api/coach/focuses/:id/request-read` | — | — | |

## Progress on confirmed focuses

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRG-1 | Read own focus progress | R | Member, `focus-progress` flag | UI | `GET /api/focuses/:id/progress` | — | candidate | Part of members' own focus work. |
| PRG-2 | Read a member's focus progress | R | Career lead, `focus-progress` flag | UI | `GET /api/department/members/:memberId/focuses/:id/progress` | — | — | |
| PRG-3 | Save a progress status or note | C U | Member, `focus-progress` flag | UI | `PUT /api/focuses/:id/progress-entry`, `POST /api/focuses/:id/progress-fence` | — | candidate | The fence settles an uncertain save; see [#242](https://github.com/JesusFilm/lantern/issues/242). |
| PRG-4 | Report a progress-save diagnostic | C | Member's browser, `focus-progress` flag and active membership | UI | `POST /api/progress-diagnostics` | — | n/a | Writes a privacy-preserving log event; stores no data. |

## Weekly work

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WK-1 | List the weeks with own plans or updates | R | Member | UI | `GET /api/weeks` | — | wanted | |
| WK-2 | Read own week: plans, plan history and daily updates | R | Member | UI | `GET /api/weeks/:week` | — | wanted | **Copy last week's goals** reuses WK-2 and WK-3. |
| WK-3 | Save weekly goals with links and visibility | C | Member | UI | `POST /api/weeks/:week/plans` | — | wanted | Each save adds a plan version. Focus targets and visibility have flags: `weekly-focus-links`, `weekly-goal-privacy`. |
| WK-4 | Save today's update and goal statuses | C U | Member | UI | `POST /api/weeks/:week/updates` | — | wanted | Keeps one displayed entry per day. |
| WK-5 | Read weekly work linked to a focus | R | Member or career lead, `weekly-focus-links` flag | UI | `GET /api/focuses/:id/weekly-work` | — | candidate | |
| WK-6 | Read the department's team updates for a date | R | Active member; integration | UI, Integration | `GET /api/team-updates`; `GET /api/v1/team-updates` | v1 | wanted | The public route takes a team API token. MCP will use the member's own JFP One sign-in. |
| WK-7 | Read a teammate's GitHub picture | R | Active member; integration | UI, Integration | `GET /api/github-avatars/:username`; `GET /api/v1/github-avatars/:username` | v1 | — | Cached on Lantern's disk. |

## Department changelog

The `changelog` flag guards all four internal routes.

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CHG-1 | Read a week of entries and the product catalogue | R | Active department member | UI | `GET /api/changelog` | — | — | Team includes former members’ entries. Mine selects the reader’s entries. |
| CHG-2 | Add a department product | C | Active department member | UI | `POST /api/changelog/products` | — | — | Shared within the department. |
| CHG-3 | Publish an entry | C | Active department member | UI | `POST /api/changelog/entries` | — | — | Requires verified default-branch merges. |
| CHG-4 | Edit an entry | U | Author with active membership in the original department | UI | `PUT /api/changelog/entries/:id` | — | — | Rechecks each PR before saving. |

## Team API tokens

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TOK-1 | List own team API tokens | R | Member, `team-api` flag | UI | `GET /api/team-api-tokens` | — | — | A bearer credential cannot manage tokens ([ADR 0020](../adrs/0020-team-api-bearer-tokens.md)). |
| TOK-2 | Create a team API token | C | Member, `team-api` flag | UI | `POST /api/team-api-tokens` | — | — | Shown once; Lantern stores only a digest. |
| TOK-3 | Revoke a team API token | U | Member, `team-api` flag | UI | `DELETE /api/team-api-tokens/:id` | — | — | Marks the token revoked. |

## GitHub integration

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GH-1 | Read the GitHub connection status | R | Member | UI | `GET /api/integrations/github` | — | — | |
| GH-2 | List repositories and search repositories, projects and issues for work links | R | Member | UI | `GET /api/integrations/github/repositories`, `GET /api/integrations/github/search` | — | candidate | Would let an agent add links to weekly goals (WK-3). Needs a team connection. |
| GH-3 | Connect the team GitHub installation | C | Career lead; the administrator registers the app | UI | `GET /auth/github/connect`, `/auth/github/admin/create`, `/auth/github/app/callback`, `/auth/github/app/setup` | — | n/a | Browser redirect flow, currently available only with explicitly configured local access. |

## Guide and configuration

| ID | Operation | Op | Who | Path today | Route or command | API | MCP | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GDE-1 | Read the Guide | R | Member | UI | `GET /api/guide` | — | candidate | Static content; context for members' agents giving guidance. |
| CFG-1 | Read feature flag states | R | Owner with active membership | UI | `GET /ops/feature-flags` | — | — | |
| CFG-2 | Change flags, the owner email or provider settings | U | Operator | Config | `LANTERN_FEATURES`, `LANTERN_FLAG_OWNER_EMAIL` and other Railway variables | — | n/a | Deployment configuration. |

## Outside the inventory

Schema and deployment tooling (`db:bootstrap`, `db:migrate`, `db:transition`, `db:verify`, `db:rehearse:local`) and `GET /health` manage the database and runtime rather than Lantern's records. They follow [Releasing](../operations/releasing.md) and are not API or MCP candidates.
