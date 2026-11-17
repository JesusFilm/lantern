# Lantern

Lantern helps team members prepare a position focus and agree it with their career lead. The product centers on a useful conversation supported by a clear, persistent document.

## Product behavior

- The application uses a geometric Lantern mark and labelled navigation icons. With `sidebar-collapse` enabled, members can collapse the desktop sidebar to an icon rail using the control above their profile at the bottom. With the same flag enabled, phones show a top-right three-bar button that opens a sliding menu panel. Selecting a destination, closing the panel, tapping outside it or pressing Escape dismisses it; keyboard focus returns to the menu button. Desktop icons stay anchored while labels fade out before the rail narrows; on expansion the labels fade in after the rail widens. Animations respect reduced-motion preferences. Destinations retain accessible names and hover labels. The choice is stored in the current browser, survives navigation and reload, and defaults to expanded when browser storage is cleared or unavailable. Storage failures do not prevent toggling for the current page. This preference does not change access or account data. The flag is enabled by default in local/stage and hidden by default in production.

- Guide → Example expands Single Example and Engineering Example as nested choices on desktop and phones, using the same submenu selection styling as other guide topics. The reading panel has no duplicate example toggle buttons.
- Guide includes a Procedures topic using the existing nested topic navigation: The year, Agree a focus, and Make a change. The year shows two full six-month cycles: prepare and request review, confirm and lock, a mid-cycle progress check-in, then an end-cycle review followed by deliberately creating a new focus with carryovers and/or new objectives and goals. Agree a focus explains the required system steps, including after offline agreement and for a career lead’s own focus. Make a change explains that confirmed content stays locked; mid-cycle amendment versus replacement and accidental-lock recovery remain undecided, not promised unlock functionality. These screens do not provide scheduling, automatic carryover, amendment or renewal tooling. The existing writing topics remain available.

- Position focuses is the only member authoring destination. Add objective offers Write myself or Guide with AI when inference is available. The choice covers one objective and its nested SMART goals. Existing objectives offer explicit manual editing or AI guidance; individual goal Add/Edit actions are compact manual shortcuts with parent context.
- Both methods edit the same pending objective. Manual authoring has only fields, type information and initiative choices; the Guide holds writing explanations. Guided authoring moves through Your work → Objective → SMART goals → Check objective using Back/Next and a cancellable loading overlay that retains the screen. Existing guidance first asks what the member wants to improve; skipping the optional question continues to goals. Existing wording is never regenerated merely by entering guidance. On Objective, Next requires an initiative or Other; correcting the selection clears the validation message immediately and retains entered work, answers, wording, type and goals. A member can switch methods without losing content.
- Save objective persists that objective and its goals once, directly to the position focus. It preserves unrelated objectives, goals, types and alignment. Partial objectives are saveable; unfinished goal plans cannot be silently omitted. Cancel and navigation warn about unsaved work. No separate suggestion acceptance, progress-save, resume or coaching-discard controls are shown.
- Contribution, Personal development and Leadership labels appear consistently in authoring and member/career-lead reading. Draft types are editable without changing wording, goals or initiative choices. AI recommendations are labelled for member confirmation; information controls explain each type. All types retain the same optional initiative selection rules.
- Existing private checkpoints are retained without an Earlier working notes interface. The authoring UI creates no separate saved coaching sessions. Confirmation retains its existing checkpoint cleanup behavior.
- Members open Review & discussion with their existing focus in a read-only review mode: title/date, objective and SMART goal editing, adding, removing and AI actions are absent. Notes and review requests remain available; Position focuses is the single return action, with an unsaved-note guard. Reopening a draft from the list restores authoring. Career leads review the submitted snapshot with the same objective cards and nested numbered goals. Check objective concerns only the pending objective and its goals. A saved focus needs a Contribution objective with at least one goal to request review or be confirmed; development-only drafts remain saveable.
- The review-request form stays visible when sending is unavailable, for members and career leads working on their own focus. The optional note is disabled whenever Send request is disabled. A visible reason sits beside Send on desktop and above it on phones, and describes both controls to assistive technology. Missing Contribution content, sending, stale versions, already-requested versions and locked focuses explain how to proceed. Saving a Contribution objective with at least one SMART goal restores readiness; sending still requires an explicit action. Notes remain optional, and a failed request retains the entered note for recovery. When a retained note is blocked and no send is in progress, Copy unsent note exposes a read-only, keyboard-selectable copy.
- Everyone, including a career lead working on their own focus, must explicitly request review of the current saved version before confirmation. Focus owners can send a newer saved version later. Requests retain complete immutable snapshots. The lead's separate review-request view shows changes and notes. Before confirmation, the owner and career lead can add notes and soft-delete their own notes; notes cannot be edited. For a lead’s own focus these roles belong to the same person. Confirmation locks the discussion, and the member sees the retained discussion beneath the confirmed objectives without an extra navigation step. New replies are indicated in the list and acknowledged when displayed. Saving alone neither requests review nor confirms agreement. A missing request or newer unsent draft prevents confirmation through every route, including Department, Review requests, a lead’s own focus and direct HTTP requests. Explanations identify missing Contribution content, a missing request or the need to send the latest changes; an ineligible focus never offers an actionable confirmation control. Current saved-version, request and confirmation checks are atomic, so stale dialogs and concurrent edits cannot confirm unrequested content.
- With `coach-redesign` enabled alongside `coach`, the authoring header labels the current method and makes the alternative an explicit Switch action. Guidance first asks for Contribution, Personal development, Leadership or Not sure. It uses the member's described work and role, the saved department mission and initiative descriptions, and the selected type's lens. Type recommendations offer an explicit switch without preselecting it. A personal interest can support development when the member explains its professional use; the coach asks when that connection is unclear.
- The redesigned coach can ask a focused question or show a concern during exploration, objective refinement, goal ideas or goal wording. The coach drafts early when intent is clear. After one follow-up, if it still cannot draft, the member can edit their own wording with the remaining question shown. A discovery objective labels what remains unknown rather than inventing facts or agreements. The coach applies the objective and SMART goal principles from the Guide without treating worked examples as member facts. Member role-type configuration remains follow-up work in [#102](https://github.com/JesusFilm/lantern/issues/102); role is currently supplied in the member's description, never inferred from an access role.
- In the redesigned flow, entering SMART goals with no existing goals requests possible actions immediately. Selecting an idea opens an editable action and date. Guided target dates start provisionally at the focus end and remain editable. They must fall inside the focus period; the server enforces this and adds the selected date to the generated goal itself, so a model cannot substitute a different deadline. Check objective displays the pending objective and goals without another model call. For an existing objective, members can ask the coach to improve it using the Guide, or continue without changes. Missing goals produce a visible warning but do not block saving. A failed coach call keeps the draft and offers retry or manual continuation. Coaching receives the complete current goals up to a 128,000-character context limit; larger contexts receive an explicit message to shorten the input or continue manually, without truncating or changing the draft. With `coach-redesign` off, the existing coaching flow remains available; the new review stage is hidden. The flag is on by default locally and on staging, off in production.
- Coaching uses Qwen with automatic OpenRouter/Gemini fallback, validated bounded responses, cancellation and a manual continuation path. Enabled hosting requires both provider keys. Additional repository/project context and email notifications are deferred. See [coaching operations](operations/coaching.md).

- Members create and edit their own titled, dated focuses with objectives and SMART goals. Empty and partial drafts are valid. Objectives can include Personal Development and Leadership types.
- The optional Guide starts with the draft → request review → review and agreement → confirmation process, using a responsive refinement-loop diagram instead of a repeated written walkthrough, with brief initiative-selection guidance, saved-draft visibility and confirmation locking. Separate lessons explain objectives and SMART goals. A simple onboarding example and an illustrative engineering example each show one objective and two goals with illustrative initiative badges using the team’s established icons and colours; their targets do not impose a template or cadence. The empty first-focus screen links to this introduction.
- Focuses open in a compact reading view. Objectives use a dedicated editing page; metadata and quick goal edits use compact dialogs. Writing guidance lives in the Guide, separate from the explicit AI-guided method. The Contribution objective remains `normal` in storage; Personal development and Leadership objectives are explicitly optional. Phone objective writing uses the page scroll; compact dialogs have one scrolling content region and stable Save and Cancel actions.
- Within Position Focuses, browser Back/Forward retains a pending editor and its input against the original document/version. Save writes that source and opens the saved document; Cancel reveals the navigation destination. Failed or stale saves retain input. Leaving Position Focuses or reloading the page ends the in-memory edit.
- Confirmed focuses offer Focus and Progress & notes views. The member can set or clear In progress, Achieved or Needs attention and edit one note per objective or SMART goal in a single dialog. An unset status has no badge; the action reads Add note when both fields are empty and Edit progress otherwise. Statuses also appear beside the relevant item in the Focus view. Career leads can read progress for current members in their department, but only the focus owner can write it. Progress is unavailable on drafts and is separate from locked focus content and review discussion notes. Failed saves retain the member's input.
- Career leads browse current department members and their focuses. After review and agreement, the lead confirms and locks the current requested version. Offline agreement still requires requesting review and then confirming in Lantern, immediately or later. Request and confirmation are separate deliberate actions; neither a note nor a waiting period is mandatory. A lead’s own request appears in their Review requests list, where they can review again and self-confirm; discussion with a senior or manager is optional and no second in-app reviewer is required. Self-facing guidance, note labels and confirmation copy must not imply two people participated. Confirmation records who confirmed it and when; the title, dates, objectives, goals and review discussion become read-only, including for career leads. Cancel leaves the draft unchanged; failed or stale confirmation leaves a recoverable draft with a clear message. Existing confirmed focuses retain their history and attribution without fabricated retrospective requests.
- Account offers Light, Dark and System appearance. The choice is stored in the current browser; clearing browser storage returns it to System, which follows the device setting.
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

Hosted access uses Jesus Film sign-in and server-issued sessions. The server checks the session on application document requests and redirects signed-out visitors before sending the app HTML or loading screen. Authentication uses prompt=login, requesting a fresh login at Auth. The redirect also works with JavaScript disabled. Ordinary valid Lantern sessions remain signed in; a coordinated identity cutover invalidates existing sessions and requires fresh JFP One sign-in. Failed or cancelled authentication shows an explicit retry screen instead of automatically looping; unavailable authentication shows its configuration state. An existing email held by a different sign-in identity requires administrative recovery; sign-in never creates another same-email account or transfers access automatically. Unresolved duplicate accounts are marked Account repair required in Add user and cannot gain membership. Recovery preserves the original account, department, role and focuses, and removes only a verified empty duplicate. Admission requires an exact approved email, with no domain restriction in any environment. Active department membership and server-assigned roles determine access. Members cannot read another member's focuses; career leads can read and confirm focuses within their department, but cannot edit another member's draft.

See [People and access](../GLOSSARY.md#people-and-access) for the account, approval, membership and career-lead relationships. A manager does not automatically gain access through their job title; application permissions come from active membership and role.

The configured owner can open a read-only feature flag page after signing in with an active department membership. It shows each registered flag's state for the current environment, without listing preview accounts. Other accounts cannot open the page; flags remain controlled through environment settings. In explicitly enabled local access, the synthetic local account uses the same owner-email and membership checks without signing in.

PostgreSQL stores account, membership and focus data. Saves detect concurrent edits. Ending membership removes access while preserving department-scoped history. Local access is explicitly configured and disabled by default.

## Delivery and scope

Staging receives application and schema changes automatically after a PR merges to main. An opt-in authenticated acceptance journey exercises the deployed build with disposable synthetic accounts and ordinary sessions, without a public login bypass. After hosted rehearsal, the owner may enable automatic production promotion of the latest main SHA with successful CI, readiness, authenticated acceptance and cleanup from the same run. Automatic promotion requires matching advertised staging/production schema versions; schema-changing releases remain manual. Manual promotion of a selected full main SHA remains available. Migrations and the application deploy from that same revision. See [Testing](development/testing.md) for coverage and limits, [Releasing](operations/releasing.md) for operator steps, and the README for provisioning and configuration.

Current work prioritizes reliable delivery and a usable hosted product. New product scope is chosen directly by the owner. The agreed rhythm is two full cycles each year, with confirmation, a mid-cycle progress check-in, and an end-cycle review before deliberately creating a new focus with carryovers and/or new goals. The previous cycle’s confirmed baseline, discussion and progress remain history. Automatic carryover, scheduling and cycle tooling are not included. Mid-cycle amendment versus a new focus and accidental-lock recovery are deferred to [#169](https://github.com/JesusFilm/lantern/issues/169), only after all members’ first submissions during December 2026–January 2027. Unlocking is not an approved future feature. Notifications, dashboards, and administration beyond the planned scope below also need a separate product decision before implementation.

## Planned owner administration API

This section is agreed product scope, not delivered behavior. The first API-first
increment lets an owner set up departments and career leads through a versioned
HTTP API and an MCP server. It publishes an OpenAPI description; an interactive
API page, a full CLI, and member-facing focus operations are deferred. An agent
may perform the requested administrative actions on the owner's behalf without
an additional confirmation for each write.

### Owners and access

- `LANTERN_FLAG_OWNER_EMAIL` will accept a comma-separated list of exact,
  normalized email addresses; an existing single-email value continues to work.
  The same list controls owner API access and the existing feature-flag page.
  That page retains its approved, signed-in account and active-membership checks.
- An active, verified human JFP One identity and a Lantern owner-list match authorize all
  administrative API operations. An owner needs neither ordinary Lantern email
  approval nor department membership to administer Lantern. There is one owner
  role, with no separate administrative or audit policies. Owner status alone
  does not grant focus, review-note or coaching-data access.
- An owner can assign themselves as career lead; that separate role grants the
  usual access to current members' focuses in that department. Assignments are
  audited. An owner-list change takes effect when the updated environment is
  serving; revoking a JFP One session alone may take until token expiry to affect
  an already issued token.

### Departments, accounts and membership

- Owners can list, create and view departments, list their members, find
  registered accounts by email, add eligible registered accounts as members,
  assign or replace a career lead, demote a lead to member, and list or add
  approved sign-in emails. Approval can precede the person's first sign-in.
- An account search returns name, email, account ID and membership status.
  Assignments target a specific registered account. When an email matches multiple
  Lantern accounts, do not silently choose or link them; resolve the ambiguity.
  Existing account linking and sign-in behavior do not change.
- A department may have no lead, but at most one active career lead. Assignment
  adds an eligible registered person with no membership or promotes an active
  member of that department. Replacing the lead is atomic: the former lead
  remains an ordinary member. Demotion also preserves membership and history.
  Reject other-department and former memberships; transfers and rejoining remain
  unsupported. Active department names are unique ignoring case and surrounding
  whitespace.
- Deleting departments, removing members and revoking email approval are outside
  this API increment. Existing administration commands remain available.

### Operations and audit

Record successful administrative reads and writes and denied attempts in PostgreSQL, including the
actor, action, target, outcome, time and calling client when available, without
bearer tokens or request secrets. A successful mutation and its audit record commit
together; record denials where possible. Retain records for 90 days using existing
trusted database access. Apply configurable rate limits before enabling the API.
New behavior follows the feature-flag and release procedures.

The agreed routes, technical boundaries, phases and verification requirements are
in [owner administration API plan](plans/owner-administration-api.md).

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
