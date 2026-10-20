# Lantern

Lantern helps team members prepare a position focus and agree it with their career lead. The product centers on a useful conversation supported by a clear, persistent document.

## Product behavior

- Members create and edit their own titled, dated focuses with objectives and SMART goals. Empty and partial drafts are valid. Objectives can include Personal Development and Leadership types.
- Separate guides explain objectives and SMART goals, with a worked example. Focuses open in a compact reading view and are edited through dialogs.
- Career leads browse current department members and their focuses. After discussion, the lead confirms and locks a focus. Confirmation records who confirmed it and when; the title, dates, objectives and goals become read-only for both people.
- Account display names persist. Career leads can add eligible registered users to their department. Rejoining former members is not currently supported.
- A career lead configures the organizational mission and strategic initiatives in Department → Mission & initiatives. Saves persist the department's configuration atomically and reject concurrent stale edits. An empty mission hides the banner; no mission is seeded automatically.
- Position Focuses shows the mission in an editorial card that members can expand or collapse. Browser storage remembers this preference separately for each account and department; it defaults to expanded and still works for the current visit when storage is unavailable.
- The objective dialog presents initiative checkboxes beneath the objective, without search or a selected-chip field. Members can choose several active initiatives, or **Other — none of these apply**, which excludes named initiatives. Unselected initiatives remain valid in partial drafts. Objective selections persist with the focus and are visible to its member and career lead.
- Initiatives can be renamed, archived, or restored. Archived initiatives disappear from new choices; existing selections remain. Saved objectives snapshot initiative names, so later configuration edits cannot rewrite confirmed focus history. The mission provides context outside objective authoring rather than a required alignment field.

## Access and data

Hosted access uses Google sign-in and server-issued sessions. Admission requires an approved email; production additionally requires the configured work domain. Active department membership and server-assigned roles determine access. Members cannot read another member's focuses; career leads can read and confirm focuses within their department, but cannot edit another member's draft.

See [People and access](../GLOSSARY.md#people-and-access) for the account, approval, membership and career-lead relationships. A manager does not automatically gain access through their job title; application permissions come from active membership and role.

PostgreSQL stores account, membership and focus data. Saves detect concurrent edits. Ending membership removes access while preserving department-scoped history. Local access is explicitly configured and disabled by default.

## Delivery and scope

Staging should receive application and schema changes automatically after a PR merges to main. Production releases are manually initiated for a selected full main commit SHA, with migrations and the application deployed from that same revision. Deployment commands and configuration belong in the repository's executable release tooling and README.

Current work prioritizes reliable delivery and a usable hosted product. New product scope is chosen directly by the owner. Later review cycles, unlocking or copying confirmed focuses, notifications, dashboards, and broader administration need a separate product decision before implementation.

## Proposed weekly reporting

The intended addition lets people state plans for a week and report whether they achieved them, alongside their position focuses in Lantern's UI using its existing authentication and database. This is not implemented. Before implementation, agree who can see/edit reports, how weeks and outcomes are defined, and whether reports link to particular focuses or goals. Confirmation of a focus records agreement, not achievement. Record consequential architecture choices through the [ADR process](adrs/AGENTS.md); sharing infrastructure does not grant access to another person's records.
