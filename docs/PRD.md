# Lantern

Lantern helps team members prepare a position focus and agree it with their career lead. The product centers on a useful conversation supported by a clear, persistent document.

## Product behavior

- Members create and edit their own titled, dated focuses with objectives and SMART goals. Empty and partial drafts are valid. Objectives can include Personal Development and Leadership types.
- Separate guides explain objectives and SMART goals, with a worked example. Focuses open in a compact reading view and are edited through dialogs.
- Within Position Focuses, browser Back/Forward retains a pending dialog and its input against the original document/version. Save writes that source and opens the saved document; Cancel reveals the navigation destination. Failed or stale saves retain input. Leaving Position Focuses or reloading the page ends the in-memory edit.
- Career leads browse current department members and their focuses. After discussion, the lead confirms and locks a focus. Confirmation records who confirmed it and when; the title, dates, objectives and goals become read-only for both people.
- Account display names persist. Career leads can add eligible registered users to their department. Rejoining former members is not currently supported.
- A career lead configures the organizational mission and strategic initiatives in Department → Mission & initiatives. Saves persist the department's configuration atomically and reject concurrent stale edits. An empty mission hides the banner; no mission is seeded automatically.
- Position Focuses shows a configured mission in an always-visible editorial card, with no hide control or remembered visibility preference. The card includes the selected geometric Jesus illustration, mirrored horizontally, to the right of the mission text on desktop and below it on narrow screens. Department settings use a preview-first mission editor: a live banner sits above the mission statement, with Change image on the artwork. A blank mission hides the banner but leaves the image chooser available. Career leads can choose a PNG, JPEG or WebP, restore the default geometric illustration, or remove the artwork. The whole image fits without cropping or stretching; only the bundled default is mirrored. Image edits remain pending until Save changes and can be cancelled with other mission edits. Images persist per department with the same ownership, concurrent-edit protection and atomic save as mission text. The browser accepts files up to 10 MB and 16 million pixels and resizes them; the server validates and re-encodes bounded raster data before storage. The Position Focuses heading has no explanatory subtitle.
- The objective dialog presents initiative checkboxes beneath the objective, without search or a selected-chip field. Members can choose several active initiatives, or **Other — none of these apply**, which excludes named initiatives. Unselected initiatives remain valid in partial drafts. Objective selections persist with the focus and are visible to its member and career lead.
- Initiatives can be renamed, archived, or restored. Archived initiatives disappear from new choices; existing selections remain. Saved objectives snapshot initiative names, so later configuration edits cannot rewrite confirmed focus history. The mission provides context outside objective authoring rather than a required alignment field.
- Initiative add/edit dialogs offer a quick palette of twelve predefined SVG icons and eight distinct preset colors (red, orange, yellow, green, blue, purple, pink and slate). There is no SVG upload or custom color picker; new appearance writes are restricted to the presets. Previously saved custom appearances can be retained unchanged or replaced with presets. The list, objective choices and saved alignment badges show the configured identity alongside its name. Appearance is optional for existing initiatives and can be cleared. Newly saved objectives snapshot appearance from department configuration alongside names; confirmed documents and old documents without appearance are not rewritten. Dialog updates remain pending until the department panel's Save changes action succeeds.
- The optional post-deployment [initiative setup script](../tools/database/seed-initiative-appearance.sql) adds the four agreed initiatives if missing and assigns red/heart, purple/light bulb, green/sprout and orange/people. It targets an explicitly chosen department and preserves existing IDs, mission, archive status and focus history.

## Access and data

Hosted access uses Google sign-in and server-issued sessions. Admission requires an exact approved email, with no domain restriction in any environment. Active department membership and server-assigned roles determine access. Members cannot read another member's focuses; career leads can read and confirm focuses within their department, but cannot edit another member's draft.

See [People and access](../GLOSSARY.md#people-and-access) for the account, approval, membership and career-lead relationships. A manager does not automatically gain access through their job title; application permissions come from active membership and role.

PostgreSQL stores account, membership and focus data. Saves detect concurrent edits. Ending membership removes access while preserving department-scoped history. Local access is explicitly configured and disabled by default.

## Delivery and scope

Staging receives application and schema changes automatically after a PR merges to main. An opt-in authenticated acceptance journey exercises the deployed build with disposable synthetic accounts and ordinary sessions, without a public login bypass. After hosted rehearsal, the owner may enable automatic production promotion of the latest main SHA with successful CI, readiness, authenticated acceptance and cleanup from the same run. Automatic promotion requires matching advertised staging/production schema versions; schema-changing releases remain manual. Manual promotion of a selected full main SHA remains available. Migrations and the application deploy from that same revision. See [release confidence](operations/release-confidence.md) for the testing layers and limits; executable delivery commands and configuration remain in the release tooling and README.

Current work prioritizes reliable delivery and a usable hosted product. New product scope is chosen directly by the owner. Later review cycles, unlocking or copying confirmed focuses, notifications, dashboards, and broader administration need a separate product decision before implementation.

## Proposed system test workspace

The owner is considering one permanent career-lead login and two member logins
for an isolated system-test department in each environment, including production.
These accounts would use dedicated password authentication and create disposable
content through normal product workflows. Real users must not discover or join
the test workspace, and test accounts must not discover or join real teams.
A restricted reset operation would remove test content without changing ordinary
history-retention rules. This is not implemented; the [draft plan](operations/system-test-team-plan.md)
records cleanup gaps, isolation requirements and decisions needed before implementation.

## Proposed weekly reporting

The intended addition lets people state plans for a week and report whether they achieved them, alongside their position focuses in Lantern's UI using its existing authentication and database. This is not implemented. Before implementation, agree who can see/edit reports, how weeks and outcomes are defined, and whether reports link to particular focuses or goals. Confirmation of a focus records agreement, not achievement. Record consequential architecture choices through the [ADR process](adrs/AGENTS.md); sharing infrastructure does not grant access to another person's records.
