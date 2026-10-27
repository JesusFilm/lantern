# Lantern

Lantern helps team members prepare a position focus and agree it with their career lead. The product centers on a useful conversation supported by a clear, persistent document.

## Product behavior

- Guide → Example expands Single Example and Engineering Example as nested choices on desktop and phones, using the same submenu selection styling as other guide topics. The reading panel has no duplicate example toggle buttons.
- Guide includes a Procedures topic using the existing nested topic navigation: The year, Agree a focus, and Make a change. The year is a minimal circular January–December diagram with two six-month focuses, quarterly check-ins and half-year reviews. Agreement and amendment guidance use ordered icon flows with member/career-lead responsibilities. These screens retain a Proposed label: this UI addition does not schedule reviews, unlock confirmed focuses, or implement revision history. The existing writing topics remain available.

- Goal coach starts from project work, asks concise contribution questions, then proposes an editable objective and goal. Initiative details show their configured color and icon, centered in the content area. Action choice and editable target date are separate steps. Back/Next replace accumulated chat; a small cancellable loading overlay retains the current screen.
- Coaching saves private checkpoints atomically with a versioned draft. A member can resume saved work; unsaved input remains in the browser. Coaching one objective or goal preserves every other section/goal, including personal development and leadership. Manual editing remains available.
- Members explicitly request career-lead review of a saved version and can send a newer saved version later. Requests retain complete immutable snapshots. The lead's separate review-request view shows changes and notes. Both people can add notes and soft-delete their own notes; notes cannot be edited. New replies are indicated in the list and acknowledged when displayed. Saving alone neither requests review nor confirms agreement. A newer unsent draft prevents confirmation through every route.
- Coaching uses Qwen with automatic OpenRouter/Gemini fallback, validated bounded responses, cancellation and a manual continuation path. Enabled hosting requires both provider keys. Additional repository/project context and email notifications are deferred. See [coaching operations](operations/coaching.md).

- Members create and edit their own titled, dated focuses with objectives and SMART goals. Empty and partial drafts are valid. Objectives can include Personal Development and Leadership types.
- The optional Guide starts with the draft → conversation → confirmation process, using a responsive refinement-loop diagram instead of a repeated written walkthrough, with brief initiative-selection guidance, saved-draft visibility and confirmation locking. Separate lessons explain objectives and SMART goals. A simple onboarding example and an illustrative engineering example each show one objective and two goals with illustrative initiative badges using the team’s established icons and colours; their targets do not impose a template or cadence. The empty first-focus screen links to this introduction.
- Focuses open in a compact reading view and are edited through dialogs. Objective and goal dialogs provide contextual, collapsible writing help without navigating away or replacing pending input. The contribution objective remains `normal` in storage; personal-development and leadership objectives are explicitly optional. Phone writing uses a scrolling form with stable Save and Cancel actions.
- Within Position Focuses, browser Back/Forward retains a pending dialog and its input against the original document/version. Save writes that source and opens the saved document; Cancel reveals the navigation destination. Failed or stale saves retain input. Leaving Position Focuses or reloading the page ends the in-memory edit.
- Career leads browse current department members and their focuses. After discussion, the lead confirms and locks a focus. Confirmation records who confirmed it and when; the title, dates, objectives and goals become read-only for both people.
- Account display names persist. Career leads can add eligible registered users to their department. Rejoining former members is not currently supported.
- A career lead configures the organizational mission and strategic initiatives in Department → Mission & initiatives. Saves persist the department's configuration atomically and reject concurrent stale edits. An empty mission hides the banner; no mission is seeded automatically.
- Position Focuses shows a configured mission in an always-visible editorial card, with no hide control or remembered visibility preference. The card includes the selected geometric Jesus illustration, mirrored horizontally, to the right of the mission text on desktop and below it on narrow screens. Department settings use a preview-first mission editor: a live banner sits above the mission statement, with Change image on the artwork. A blank mission hides the banner but leaves the image chooser available. Career leads can choose a PNG, JPEG or WebP, restore the default geometric illustration, or remove the artwork. The whole image fits without cropping or stretching; only the bundled default is mirrored. Image edits remain pending until Save changes and can be cancelled with other mission edits. Images persist per department with the same ownership, concurrent-edit protection and atomic save as mission text. The browser accepts files up to 10 MB and 16 million pixels and resizes them; the server validates and re-encodes bounded raster data before storage. The Position Focuses heading has no explanatory subtitle.
- The objective dialog presents initiative checkboxes beneath the objective, without search or a selected-chip field. Members can choose several active initiatives, or **Other — none of these apply**, which excludes named initiatives. Unselected initiatives remain valid in partial drafts. Objective selections persist with the focus and are visible to its member and career lead.
- Initiatives can be renamed, archived, or restored. Archived initiatives disappear from new choices; existing selections remain. Saved objectives snapshot initiative names, so later configuration edits cannot rewrite confirmed focus history. The mission provides context outside objective authoring rather than a required alignment field.
- Initiative add/edit dialogs include an optional plain-text description directly below the name, limited to 500 characters. The lead explains what the initiative means and why it matters; descriptions persist with the department configuration through the existing Save changes flow. Existing initiatives without descriptions remain valid.
- Guide includes Strategic initiatives alongside Objectives, SMART goals and Example. Selecting the topic expands active initiative names and their configured identities beneath it, using the existing nested lesson navigation. Selecting an initiative displays its name, color, icon and current description in the main reading panel. Missing descriptions, no active initiatives and failed reads have explicit states; failed reads can be retried. On phones, initiative navigation expands vertically so names remain readable. Descriptions are current department guidance, not part of saved objective snapshots or confirmed focus history.
- Department → Mission & initiatives ends its initiative table with a fixed grey Other identity. This is the existing alignment fallback, not a configured initiative: it has no status or actions and is not stored in the initiatives array. The previous multiple-selection and Other/archive explanatory paragraphs are omitted; configured initiatives retain Active/Archived status and Edit/Archive/Restore actions.
- Initiative add/edit dialogs offer a quick palette of twelve predefined SVG icons and eight distinct preset colors (red, orange, yellow, green, blue, purple, pink and slate). There is no SVG upload or custom color picker; new appearance writes are restricted to the presets. Previously saved custom appearances can be retained unchanged or replaced with presets. The list, objective choices and saved alignment badges show the configured identity alongside its name. Appearance is optional for existing initiatives and can be cleared. Newly saved objectives snapshot appearance from department configuration alongside names; confirmed documents and old documents without appearance are not rewritten. Dialog updates remain pending until the department panel's Save changes action succeeds.
- The optional post-deployment [initiative setup script](../tools/database/seed-initiative-appearance.sql) adds the four agreed initiatives and their approved descriptions if missing and assigns pink/heart, blue/light bulb, green/sprout and yellow/people, matching Engineering’s staging configuration. The separate [description-only script](../tools/database/update-initiative-descriptions.sql) updates existing descriptions while preserving configured appearances. It targets an explicitly chosen department and preserves existing IDs, mission, archive status and focus history.

- With `LANTERN_ENV=local`, synthetic local access and a loopback database, startup fills the synthetic account’s active department with the four known initiatives, their approved descriptions and staging appearances. Repeated startup preserves IDs, order, archive status, existing appearances, mission, extra initiatives and saved focuses. It fills missing appearances and absent description fields but does not reset local edits, restore removed membership or seed hosted environments.

## Desktop and mobile support

Lantern supports desktop and mobile browsers. Preserve the desktop composition;
phone layouts prioritize the member's immediate task, not simply stacked panels.
On phones:

- Show one objective and its goals at a time. For multiple objectives, provide
  swipe, Previous/Next, a direct chooser and optional full-document reading.
  Keep navigation reachable during long reads. Dates/status details are available
  on demand, and document records precede mission context.
- Keep Guide topic/lesson choices compact, with persistent progression controls.
  Example choices reveal their content. Swipe has tap and keyboard alternatives;
  long content scrolls freely without forced vertical snapping or auto-advance.
- Use full-screen objective/goal writing with stable Save/Cancel and one content
  scroll area. Preserve input and the existing source-bound editing behavior.
- Support 320 CSS pixels and short landscape: wrap prose, stack simple records,
  constrain artwork, keep standalone touch targets at least 44px and form text
  at least 16px. Do not conceal broken reflow with page-level overflow clipping.

Apply the [responsive review checklist](development/testing.md#responsive-ui-review)
to UI work. Native apps and offline operation are outside this decision.

## Access and data

Hosted access uses Google sign-in and server-issued sessions. Admission requires an exact approved email, with no domain restriction in any environment. Active department membership and server-assigned roles determine access. Members cannot read another member's focuses; career leads can read and confirm focuses within their department, but cannot edit another member's draft.

See [People and access](../GLOSSARY.md#people-and-access) for the account, approval, membership and career-lead relationships. A manager does not automatically gain access through their job title; application permissions come from active membership and role.

PostgreSQL stores account, membership and focus data. Saves detect concurrent edits. Ending membership removes access while preserving department-scoped history. Local access is explicitly configured and disabled by default.

## Delivery and scope

Staging receives application and schema changes automatically after a PR merges to main. An opt-in authenticated acceptance journey exercises the deployed build with disposable synthetic accounts and ordinary sessions, without a public login bypass. After hosted rehearsal, the owner may enable automatic production promotion of the latest main SHA with successful CI, readiness, authenticated acceptance and cleanup from the same run. Automatic promotion requires matching advertised staging/production schema versions; schema-changing releases remain manual. Manual promotion of a selected full main SHA remains available. Migrations and the application deploy from that same revision. See [Testing](development/testing.md) for coverage and limits, [Releasing](operations/releasing.md) for operator steps, and the README for provisioning and configuration.

Current work prioritizes reliable delivery and a usable hosted product. New product scope is chosen directly by the owner. Later review cycles, unlocking or copying confirmed focuses, notifications, dashboards, and broader administration need a separate product decision before implementation.

## Release testing scope

Use synthetic staging data for Playwright mutation journeys and cleanup. Gate
automatic production promotion on successful exact-revision acceptance, while
retaining an engineer's manual SHA override with successful prerequisite checks
and readiness. Use built-in GitHub notifications and engineer-led recovery; no
automatic rollback is in scope. Production initially receives readiness smoke
without synthetic business records or extra departments. Authenticated production
reads and permanent staging password logins remain optional, unresolved extensions.
[ADR 0008](adrs/0008-staging-gate-and-production-smoke.md) records the decision,
coverage limits and the current manual-override implementation gap.

## Proposed weekly reporting

The intended addition lets people state plans for a week and report whether they achieved them, alongside their position focuses in Lantern's UI using its existing authentication and database. This is not implemented. Before implementation, agree who can see/edit reports, how weeks and outcomes are defined, and whether reports link to particular focuses or goals. Confirmation of a focus records agreement, not achievement. Record consequential architecture choices through the [ADR process](adrs/AGENTS.md); sharing infrastructure does not grant access to another person's records.
