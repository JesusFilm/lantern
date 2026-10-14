> Historical snapshot. Superseded for initial delivery by the current beta specification and breakdown. Original relative links below are relative to the parent feature directory.

Title: Agree the position-focus guide
Milestone: M01
Status: ready-for-agent
Review: Beta scope clarified; main specification and breakdown require consolidation; implementation not authorized
Date: 14 October 2026
Summary: Give engineers and career leads clear position-focus guidance, useful examples and departmental support without imposing a universal review process.

---

The Status line is the to-spec skill’s specification triage metadata, separate from milestone progress. It does not approve implementation, an implementation breakdown or milestone completion. M01 is `Kind: milestone`, `Status: Specification`: all five planning decisions are resolved and specification review is in progress. This draft synthesizes resolved product decisions; technical proposals below are not prior agreements.

## Problem Statement

Engineers need to understand what a meaningful position focus contains, how to prepare one when information or direction is missing, and what agreement and completion mean. Career leads need to provide relevant support without learning design tools or accepting another department’s process. Readers need examples that teach useful thinking without turning illustrative targets, dates or layouts into organizational requirements.

## Solution

Provide concise in-app supporting resources alongside the position-focus experience: optional walkthroughs for critical mission objectives and SMART goals, an initial full engineering example, shorter internal-contribution and discovery examples, and guidance on gaps, development, joint review and lock-in. Each reader receives their own career lead’s departmental guidance and may independently browse all departments’ examples.

Begin with curated, fixed generic guidance available on first run. Career leads can keep it unchanged or customize their own department’s heading/body text and examples. The application controls presentation. Departmental guidance describes review processes and timing; when timing is absent, readers ask their career lead.

The guide explains the agreed position-focus contract. It does not deliver the entire drafting, submission or review workflow under M01; those neighboring milestones must carry the applicable interactions into their own approved specifications and breakdowns.

## User Stories

Source keys D01–D05 refer to the consolidated decisions linked in Further Notes. Later decisions take precedence over older wording.

1. As an engineer, I want to understand my role’s purpose, outcomes, responsibilities, current work and its source, users, expectations and gaps, so that my focus reflects my actual situation without requiring a prescribed set of form fields. [D01]
2. As an engineer, I want a critical mission objective connected to the organizational mission, so that I can explain my intended contribution. [D01, D03]
3. As an engineer with known work, I want to connect users’ needs, intended outcomes and my contribution, so that my objective explains why the work matters. [D01]
4. As an engineer making an internal contribution, I want examples that recognize fellow engineers as users and collaboration as useful work, so that product delivery is not the only valid contribution. [D01, D03]
5. As an engineer discovering a direction, I want to describe what I will learn or agree through an objective and SMART goals, so that discovery can be a useful initial contribution. [D01, D03]
6. As an engineer with unanswered questions, I want to record gaps and next steps and pursue clarification, so that uncertainty leads to useful discussion and action. [D01, D02, D05]
7. As an engineer without assigned direction, I want leadership to help put direction in place, so that the absence of work is not treated as my failure. [D01, D02]
8. As an engineer, I want to understand that a draft can support exploratory discussion before an objective is agreed, so that I need not invent answers. [D01, D02]
9. As an engineer, I want SMART guidance that considers all five qualities using evidence and timeframes suited to my objective, so that I can judge progress without unsuitable numerical targets or five mandatory written sections. [D01, D03]
10. As a reader, I want a visible help/guidance indicator and independently selectable objective and SMART walkthroughs, so that I can request the support I need. [D03]
11. As a reader, I want short steps and Next transitions, so that I can work through guidance at my own pace. [D03]
12. As a reader, I want professional, restrained visuals and examples, so that they help explain the content. [D03]
13. As a reader, I want a collapsible mission-context banner available across steps, so that I can refer to supplied organizational and departmental context without invented or duplicated statements. [D03]
14. As a reader, I want a worked example that improves a vague goal, so that I understand how each SMART quality helps. [D03]
15. As an engineer, I want a full product-work example with gaps and next steps and shorter internal-contribution and discovery examples, so that I can learn from a relevant starting situation. [D03]
16. As a reader, I want example counts, dates and layouts identified as illustrative, so that I do not mistake them for requirements. [D01, D03, D05]
17. As an engineer, I want to understand optional personal development and its practical application, so that I can include growth goals where useful. [D01, D03]
18. As an engineer, I want to understand optional coach-given leadership development assignments and their goals and outcomes, so that I can distinguish them from personal development. [D03]
19. As a drafter or career lead, I want separate optional development sections hidden until added through a discreet Add optional section control, with leadership development beneath personal development, so that optional content does not clutter the initial focus. [D03; downstream drafting contract]
20. As a drafter or career lead, I want to add and edit both optional sections and agree their contents before lock-in using the same SMART approach, so that included development is meaningful and jointly understood. [D03; downstream drafting/review contract]
21. As an engineer, I want to review and refine the focus with my career lead and jointly agree the mission objective and SMART goals, so that lock-in establishes our baseline for the cycle. [D02]
22. As an engineer, I want to understand that gaps with clear next steps can remain at lock-in and objectives need not already be achieved, so that completion has a clear meaning. [D02]
23. As an engineer or career lead, I want leadership support when direction is absent or we disagree, so that we can reach agreement without adding approvers. [D01, D02]
24. As an engineer, I want to understand that we can revise a locked-in baseline together, so that the focus remains useful as circumstances change. [D02, D05]
25. As a career lead, I want curated generic guidance available from first run, so that my department can begin without authoring its own resources. [D04]
26. As a career lead, I want to edit only my department’s guidance and examples through text, so that I can support the people I coach without design or animation skills. [D03, D04]
27. As a career lead, I want a custom departmental example independently of guidance customization, so that I can retain generic support text and still show relevant work. [D04]
28. As a coached person, I want my career lead’s guidance while browsing examples across departments, so that changing an example does not change the support or process expectations applicable to me. [D04]
29. As a career lead, I want to describe my department’s review process and timing in editable guidance, so that the application accommodates our approach. [D05]
30. As a reader, I want to distinguish illustrative annual or quarterly cycles from departmental expectations and know to ask my career lead when timing is absent, so that I do not infer a default schedule. [D05]

## Implementation Decisions

### Agreed product behavior

- **Content and teaching [D01, D03]:** Cover the five content areas in story 1 without converting them into mandatory form fields. Require a critical mission objective and SMART goals. Consider specific, measurable, achievable, relevant and time-bound qualities; evidence can demonstrate learning or capability rather than numerical outcomes. No fixed objective count, universal targets or mandatory organizational format is established.
- **Mission context [D01, D03]:** Use organizational mission → department contribution → individual objectives. Preserve the organizational mission exactly: “We partner with the Body of Christ through heart language media, so everyone, everywhere can encounter Jesus.” There are no separate missions at each level. Keep the reader-controlled collapsible context banner accessible across steps; omit missing context rather than inventing it. Missing context does not remove the required individual objective.
- **Starting situations [D01, D02, D05]:** For known direction, the initial discussion minimum is a mission-aligned objective, SMART goals and explicit gaps with next steps, explaining users, needs and outcomes where known. Drafts can also support exploratory discussion. Discovery is valid but must not transfer leadership’s responsibility for absent direction to the engineer. Maintain active pursuit of clarification; no fixed first-review interval applies.
- **Agreement and support [D02, D03]:** Engineer and career lead jointly review/refine and agree the mission objective, SMART goals and any included development before lock-in. This ends draft status and completes the individual focus for the cycle without further sign-off; it does not mean objectives are achieved. Gaps may remain with clear next steps. Jaco coordinates direction follow-up with Tatai and Edmond both named, without imposing a single primary leader; Sushma’s QA involvement remains applicable. Jaco involves Tatai and Edmond in disagreements. The focus remains draft until engineer and career lead agree; leadership support adds no approvers. A locked-in focus can be revised together.
- **Walkthrough presentation [D03]:** Visible help opens optional, user-initiated support. Objective and SMART walkthroughs are independently selectable, use short steps and Next transitions, and use helpful professional, minimalist visuals. The application owns typography, layout, navigation, transitions and animation. Career leads edit heading/body text and examples, not design.
- **Examples [D03, D04]:** Develop the supplied product-work scenario into the full engineering example, including gaps and next steps. Include shorter internal-contribution and discovery examples in walkthroughs. Mark development as optional and scenario details, counts and dates as illustrative. Engineering supplies the initial full example; other departments may add content later. Examples are independently customizable and browsable across all departments.
- **Optional development [D03]:** Personal development is optional and encouraged. Leadership development assignments are separately optional, beneath personal development, and pair coach-given assignments with specific goals and outcomes. Both sections are hidden until added through a discreet Add optional section control; drafter and career lead can add/edit both. Both use the same SMART approach and are jointly agreed before lock-in. The guide teaches this behavior; its operational integration belongs with drafting/review delivery.
- **Department ownership [D04]:** Generic guidance is curated, fixed, hard-coded system data available on first run, not an editable shared template. Career leads may retain it unchanged or customize only their own department’s resources. A department may retain generic guidance and supply a custom example. Readers get the guidance their career lead provides. The department selector changes only the example viewed, never the reader’s support guidance.
- **Timing [D05]:** Career leads define all departmental review processes and timing in editable guidance. There is no fixed one-month first review, including engineering, no universal annual cadence and no fallback schedule. Annual drafting/confirmation, mid-year adjustment and year-end retrospective/restart, or quarterly rewriting, may be labeled examples only. Missing timing directs readers to their career lead. No required external calendar or calendar integration follows from this decision.

### Existing support observed

The repository has a React entry page, an Express application with a database-backed health endpoint, a PostgreSQL connection factory and a shared health-response contract. It has no implemented guide, department resources, identity/department association, resource editing, position-focus drafting or lock-in workflow. Existing database connectivity is not a resource persistence model or authorization system.

### Technical proposals for review, not agreed requirements

- Extend the existing application with one cohesive supporting-resources area that resolves the reader’s departmental guidance separately from the selected example. Keep presentation under application control and textual content separate from that presentation.
- Represent generic content as application-supplied data and departmental customization as independently stored guidance and example content. Exact storage shape, copy-versus-override mechanics, API contracts and editing granularity remain technical design work; no shared-update lifecycle is implied.
- Determine the reader’s and editor’s department from a trusted identity/department association, independently of the example selector, and enforce editing boundaries on the server. Identity provisioning and association are absent today; choose the minimum integration during the approved breakdown rather than pretending a client selector establishes permission.
- Carry the optional-section and lock-in contracts into the later drafting/review specifications. Review dependency and delivery placement during breakdown without modifying or expanding other milestones now. M01 owns usable guide resources, departmental resource editing/example browsing and their verification; it does not silently absorb the whole position-focus application.

## Testing Decisions

### Agreed practical acceptance checks — not yet performed

| Check | Observable result | Source |
|---|---|---|
| Newcomer preparation | Someone unfamiliar with the process uses resources to prepare a mission objective and SMART goals, records gaps/next steps, explains joint review and lock-in, finds useful examples and understands optional development. | D03 |
| Career-lead authoring | A career lead adapts departmental heading/body text and examples without design or animation skills. | D03 |
| Two departments | One retains generic guidance with a custom example; the other customizes guidance. Readers receive their own career lead’s guidance and browse both examples without changing that guidance. Editors remain within their own department. | D04 |
| Review timing | A reader distinguishes illustrative cycles from departmental expectations and asks their career lead when timing is absent. | D05 |

Perform these once the resources and relevant application behavior exist. No numerical success target or fixed participant count has been agreed. Automated checks cannot establish that a newcomer understands the material; retain the practical walkthrough.

### Confirmed test seams

Prefer external behavior at the highest useful boundary, without testing component internals, storage layouts, animation implementation or private helper calls.

1. **Primary new seam: running application through the browser.** Exercise support discovery, optional entry, independent walkthrough selection, Next navigation, banner collapse/expand across steps, omission of missing context, guidance editing, example browsing and the two-department scenario. Verify saving/reopening content through observable behavior. Inspect teaching content and timing labels alongside the practical walkthrough. This is a new seam: no browser test harness currently exists. Tool choice and fixtures remain proposals for the breakdown, not settled dependencies.
2. **Reuse existing HTTP integration seam for editing boundaries.** The existing application factory and real HTTP/database tests provide prior art. Once resource endpoints and identity exist, attempt an own-department edit and a cross-department edit, checking observable response and resulting content; a hidden UI control alone cannot prove enforcement. Verify fixed generic data cannot be edited through departmental operations. Reuse the current real-server pattern rather than introducing multiple lower-level unit seams.

The modules exercised would be the guide/reader experience, departmental content editing and resource access boundary. Existing health tests prove only health behavior; ticket-board tests concern tracker records and are not evidence for these product capabilities. Optional-section editing and lock-in behavior need acceptance coverage in their later owning workflows; M01 checks that its resources explain them accurately.

Jaco confirmed on 14 October 2026: “Yes, those test seams match my expectations.” Browser-level behavior checks, focused HTTP editing-boundary checks and the agreed practical walkthroughs are confirmed. Harness/tool selection remains a technical choice. No application acceptance test or practical verification was run for this drafting task.

## Out of Scope

- Implementation, final teaching copy, finished artwork/resources or implementation tickets in this specification-drafting session.
- The full submission, personnel-record, review or lock-in workflow under this guide milestone; preserve the agreed cross-feature contracts for later delivery.
- Mandatory five-field content forms, five written SMART sections, universal objective counts, numerical targets, participant counts or imposed assignments.
- Visual customization, slide builders, editable animation or department-owned layout.
- Editing the generic guidance as a shared template; ongoing shared corrections, adoption, synchronization, versioning or update notifications. Future software-release changes to defaults are outside D04.
- Scheduling or notification features, fixed review intervals, a universal annual cycle, required external calendars or calendar integration.
- Extra approval roles, treating objective achievement as lock-in, or equating individual lock-in with guide delivery or whole-team completion.
- Fixing the provisional January 2027 deadline, changing other milestones, automated messaging, transcription, AI analysis or broad HR functionality.

## Further Notes

### Decision traceability and precedence

| Key | Authoritative source | Requirements carried forward |
|---|---|---|
| D01 | [Content and quality — Answer](issues/01-define-position-focus-content.md#answer) | Content areas, mission wording, objective/SMART requirements, starting situations and initial-discussion quality |
| D02 | [Review and completion — Answer](issues/02-agree-review-and-completion.md#answer) | Joint agreement, lock-in, gaps, leadership coordination, disagreement and revisable baseline |
| D03 | [Supporting resources — Answer](issues/03-agree-guide-supporting-resources.md#answer) | Walkthroughs, context banner, examples, optional development and practical acceptance |
| D04 | [Shared guidance — Answer](issues/04-agree-shared-guidance-updates.md#answer) | Fixed defaults, own-department editing, independent examples, selector behavior and two-department check |
| D05 | [Review timing — Answer](issues/05-agree-guide-review-timing.md#answer) | Department-defined processes/timing, missing-timing instruction and reader check |

D05 supersedes the fixed first-review interval in D01/D02 and any interpretation of D02 as a universal annual schedule. Do not combine first and annual reviews as an application rule. D04 supersedes broader selector wording in D03: only examples switch. Its fixed defaults remove the earlier proposed shared-correction adoption workflow. D03 confirms there is no mandatory organizational format and adds separate optional leadership development. Historical comments and older remaining-question lists do not reopen resolved decisions.

The [working example](references/position-focus-working-example.png) is an illustrative source for later resource production, not a mandatory template. This specification does not invent or reproduce its detailed scenario.

Repository context: [glossary](../../GLOSSARY.md), [roadmap](../../docs/ROADMAP.md), [milestone](milestone.md), [planning map](map.md), [tracker conventions](../../docs/agents/issue-tracker.md) and [triage vocabulary](../../docs/agents/triage-labels.md). The relevant parent review-timing discussion and supporting-resource/shared-guidance closing discussions were consulted. No applicable ADR records were found in the repository inspection.

The October guide target is a planning window. January 2027 team-cycle timing remains provisional. An individual locked-in focus, usable guide delivery and whole-team completion are distinct outcomes.

### Review and next action

The test seams are confirmed. The [six-slice implementation breakdown](breakdown.md) and its dependencies are approved. Settle the department identity prerequisite one question at a time before finalizing implementation-ready tickets; implementation requires explicit approval separately. Resource production, implementation and the four practical checks remain outstanding; the guide milestone is unfinished.

Milestone progress follows the [tracker conventions](../../docs/agents/issue-tracker.md#milestone-progress): Planning → Specification → Delivery → Verify → Learn → Complete. These stages describe progress rather than enforce a mandatory sequence. Verify and Learn may be skipped when appropriate, and earlier stages may be revisited. For this guide, the four agreed practical checks remain requirements; making the Verify stage optional does not cancel them. A failed verification can lead to rollback, learning and closure, with unmet criteria and the outcome recorded. Successful verification can lead directly to Complete without a separate Learn stage. Complete records closure, not an automatic claim that the guide succeeded.

## Comments

### 14 October 2026 — Test seams confirmed; breakdown requested

Jaco: “Yes, those test seams match my expectations. Record that confirmation and prepare the implementation breakdown for review, keeping implementation separate until I approve it.”

Recorded the test-seam confirmation and prepared the adjacent breakdown proposal. This authorizes planning, not implementation, and does not record practical verification or milestone completion.

### 14 October 2026 — Breakdown approved; identity planning next

Jaco approved the six slices and dependencies and requested department identity planning one question at a time. Implementation remains pending explicit approval. The breakdown records this confirmation; identity source and assignment of departmental authority remain unresolved.

### 14 October 2026 — Preferred sign-in source

Jaco prefers existing Google work accounts for sign-in. Department membership, career-lead permissions and account eligibility remain to be settled; this preference does not authorize implementation or choose directory synchronization. See the breakdown’s identity discussion.

### 14 October 2026 — Assignment authority confirmed

Jaco or a designated administrator assigns each person’s department and career-lead permissions in the application. Existing Google work accounts remain the preferred sign-in source; sign-in alone does not grant departmental editing authority. Account admission and administrator designation details remain unresolved. Implementation remains pending explicit approval.

### 14 October 2026 — Account admission confirmed

Each Google work account requires individual approval by Jaco or a designated administrator and must be within the approved work email domains configured by an administrator. An approved domain alone does not grant access. Department and career-lead assignments remain separate administrative decisions. Initial administrator setup and the admission workflow remain unresolved. Implementation remains pending explicit approval.

### 14 October 2026 — Initial administrator confirmed

Initial setup will designate Jaco’s Google work account as the first administrator, and Jaco may appoint additional administrators. The account address and initial domain configuration remain setup inputs; no configuration or implementation has occurred. Account admission still requires individual approval and an administrator-approved work domain. The access-request/preapproval workflow remains unresolved. Implementation remains pending explicit approval.

### 14 October 2026 — Access requests and assignment responsibilities clarified

Eligible Google work-account holders request access after sign-in, stating whether they seek career-lead or user access. The administrator sees the requested role and must approve access before application use. Administrators create departments and assign career leads to them. A career lead assigns users to their own department; users have no application functionality until assigned, and assignment does not replace administrator approval. This supersedes the earlier broad wording that administrators assign every person’s department: department setup and career-lead assignment are administrative responsibilities, while ordinary user assignment belongs to the career lead. Requested roles do not grant permissions.

How an approved user reaches the appropriate career lead remains unresolved. The breakdown records the next question. These are planning decisions only; implementation remains pending explicit approval.

### 14 October 2026 — Reconsidering administrative and department responsibilities

Jaco reopened the allocation of responsibilities for brainstorming. Administrators should guard important access and govern system management; they cannot be assumed to know which departments are needed or where to route users. The previously proposed administrator routing approach is not accepted.

Directions under consideration, not finalized replacements:

- Career leads may create departments because they understand the needed team structure, rather than requiring administrators to create them.
- Career leads remain the likely owners of assigning users to their own departments; administrators should not need to know team membership.
- Ordinary users from allowed work domains may not need individual administrator approval. This explicitly reopens the earlier individual-approval rule; do not treat either admission policy as final while this discussion is unresolved.
- Career-lead authority should at minimum be administrator-controlled. A person could request it explicitly during access registration; an administrator would see the request, contact the person to verify their identity/team and approve or deny the elevated access. Requesting career-lead access would not itself grant it. The precise workflow is still being discussed.

The earlier approved-domain Google sign-in direction and initial administrator arrangement are not reopened here. The prior no-user-functionality-before-department-assignment rule has not yet been explicitly removed. Do not infer invitations, automated contact, team guardianship, a multi-department model or new implementation scope from this brainstorming.

Next proposed decision: allow an ordinary user with an approved-domain Google account to register without administrator approval, while requiring administrator approval specifically for career-lead permissions. Ask this one question before settling department creation and membership mechanics. No implementation is authorized.

### 14 October 2026 — Ordinary registration and career-lead approval confirmed

Jaco confirmed: “Yes, ordinary users from approved domains can register without admin approval but need department assignment to use the app. Career-lead access needs admin approval.”

Current agreed admission policy:

- Ordinary users signing in with Google work accounts from administrator-approved domains may register without individual administrator approval.
- Ordinary users require department assignment before accessing application functionality. Registration alone does not grant that access.
- Career-lead permissions require explicit administrator approval; requesting the role does not grant it.
- This supersedes the earlier requirement for individual administrator approval of every ordinary user. Approved-domain eligibility remains required.
- Department creation ownership remains unresolved. Career-lead-owned creation is a proposal, not yet an agreement. The proposed administrator routing of users was not accepted.

Next question: should an administrator-approved career lead be able to create their own department and become its career lead, without a separate administrator approval for department creation? This is a proposal for confirmation, not an implemented or approved capability.

Implementation remains pending explicit approval. No accounts, permissions or departments have been changed.

### 14 October 2026 — Department ownership and lifecycle confirmed

Jaco confirmed:

- An administrator-approved career lead can create their own department and become its career lead without further administrator approval. This supersedes the earlier requirement that administrators create departments.
- Administrators can revoke career-lead access and assign other users as career leads.
- A department can have multiple career leads; do not assume a single-owner department model.
- Career leads can rename departments.
- Career leads can soft delete departments containing existing user data. Departments may be hard deleted only when no user data has been captured yet; existing user data must not be destroyed through department hard deletion.

These departmental management capabilities apply within career leads’ own departmental authority, not unrestricted cross-department access. Detailed effects of revocation, replacement and deletion remain to be specified. In particular, the meaning of “user data” for hard-deletion eligibility, whether an empty department may instead be soft deleted, restoration, and handling of a department with no remaining career lead have not been settled. No automatic data transfer or cascade deletion is authorized.

Next question: when a department is soft deleted, should its users lose access to application functionality until assigned to an active department, while their existing data is retained? This proposed behavior remains unconfirmed.

The six-slice breakdown structure was approved before these lifecycle requirements. Carry these requirements into P4/P5 scope and reassess sizing/dependencies once their behavior is settled; do not imply the earlier approval covers an expanded implementation-ready ticket. Implementation remains pending explicit approval. No accounts, departments or data were modified.

### 14 October 2026 — Department deletion constrained; advanced lifecycle work deferred

Jaco clarified that department deletion is an unlikely cleanup edge case, for example an unused team setup or an entire team becoming redundant. Renaming is more likely. Soft deletion is a safeguard against destroying existing user data and the old department context, not a request to build a retention, backup/recovery or organizational-restructuring product. Preserved position-focus data is for users’ potential personal need, not automatic transfer to another department. Recording this requirement does not establish an independent backup mechanism or recovery guarantee.

For now, preserve the agreed minimum: do not destroy existing user data through department deletion; hard deletion is eligible only before user data has been captured. Defer further soft-deletion workflow design. The preceding question about users losing access after soft deletion was not answered and must not be recorded as an agreed rule.

On-demand user data extraction needs a future pathway, but is an edge case and not a priority for this delivery. Department migration/splitting was identified as a possible future concern: differing missions could require new position focuses. No migration behavior, regeneration, carry-over or restructuring workflow was agreed. Do not add these features to the current implementation breakdown or reopen them as current blockers.

Keep initial planning focused on ordinary admission, career-lead authority and active-department membership. Next proposed question: should users request to join a department and have one of its career leads approve the request? This is a proposal, not a recorded agreement; alternative invitation/selection mechanisms remain undecided. Implementation remains pending explicit approval.

### 14 October 2026 — Direct department assignment; no request workflow

Jaco clarified that users and career leads already have an established relationship. They coordinate directly outside the application: a user asks their career lead to add them, or the career lead asks them to register first. Once an eligible user has registered, a career lead adds that user to their own department.

Do not build department-join requests, an approval queue/dashboard for career leads, invitations or automated messages for this process. This rejects the preceding proposed in-app department-request mechanism. Ordinary approved-domain Google registration remains distinct from access to product functionality: the user must still be assigned to a department before using the app. Administrator approval remains necessary for career-lead authority, not for ordinary registration.

The means by which a career lead identifies a registered user for assignment is not yet agreed. Next proposed question: should the career lead add a registered user by entering their exact Google work email address? This is a proposal, not an agreed search or directory feature. Implementation remains pending explicit approval.

### 14 October 2026 — Add user through a searchable existing-user dropdown

Jaco specified that a career lead clicks **Add user** on their department’s user profile page, then selects an existing registered user from a dropdown list. The list supports browsing/selection and searching by email name or email address. Selection of an existing user is required; this is not a free-text email submission, invitation or account-creation flow. This supersedes the preceding proposal to add someone by entering an exact email address alone.

The scope of users shown in that dropdown remains unresolved, particularly users already assigned to another department. Next question: should the dropdown show only registered users who are not yet assigned to any department? Restricting it that way is a proposal to keep initial onboarding separate from deferred migration, not an agreed membership/cardinality rule.

Direct coordination outside the application, career-lead assignment within their own department, and no department-join request mechanism remain agreed. Implementation remains pending explicit approval.

### 14 October 2026 — Show available users with department membership indicators

Jaco rejected limiting the Add user dropdown to users without a department. Show all available users. For a user already in a department, display a visual tick/tag next to their name; hovering over the indicator shows a tooltip naming their current department. Preserve browsing and search by email name or email address, and selection of an existing registered user.

This settles list visibility and membership indication only. It does not authorize transferring a user, simultaneous membership in multiple departments, or replacing an existing assignment. The meaning of “available” beyond the existing registered-user list has not been expanded to external accounts.

Next question: should a user already assigned to another department remain visible but unavailable for selection for now, leaving department transfers deferred? This is a proposal, not agreed behavior. Implementation remains pending explicit approval.

### 14 October 2026 — Multiple department memberships and department-scoped user data

Jaco confirmed that users already assigned to another department remain selectable in Add user. Multiple department memberships are permitted even though uncommon. User data is stored by department.

Adding an existing user to a further department establishes an additional membership, not an implicit transfer or removal of their existing membership. Department-specific user data must remain associated with its department; do not infer automatic copying, sharing, migration or regeneration of position focuses across memberships. This replaces any earlier single-department assumption. The membership indicator/tooltip must accommodate the departments a user belongs to rather than imply there can only be one.

The earlier example-browser department selector still changes examples only. A multi-department user’s active working department and its guidance context need a separate decision; do not repurpose that example selector to silently change their working context.

Next question: should users belonging to multiple departments choose an active department through a separate department switcher, with their guidance and position-focus data reflecting that department? This is a proposal, not yet agreed. Implementation remains pending explicit approval. Reconcile these expanded membership requirements into the breakdown after the identity discussion is settled.

### 14 October 2026 — Multi-department working context agreed for later; implementation deferred

Jaco confirmed that users with multiple department memberships should have a working-context department switcher, separate from browsing examples. However, implementation of multi-department ability is explicitly deferred as excessive work for an unproven case. The initial priority is a single department’s users.

Treat multiple memberships, department-scoped user data and a distinct working-context switcher as future design direction, not requirements to implement in the initial delivery. Do not build multi-membership management or a working-context switcher now. The existing example-browsing selector remains separate and does not switch support guidance. This clarification alone does not cancel the agreed two-department guidance/example isolation check or departmental ownership boundaries; it defers a person working across multiple departments.

An initial-delivery behavior still needs confirmation: the previously agreed Add user list shows all available users with department membership indicators, but actually assigning an already-assigned user to an additional department would implement the deferred ability. Do not silently implement a transfer, second membership or disabled-selection rule. Next question: for the initial version, should users already assigned to another department remain visible with their department tag but be unavailable to add? This is a proposal made in light of the new deferral, not a reversal already approved by Jaco.

The expanded identity and department decisions still need consolidation into the specification and breakdown before implementation-ready tickets. Implementation remains pending explicit approval.

### 14 October 2026 — Initial Add user restriction confirmed

Jaco confirmed that users belonging to another department remain visible in the Add user dropdown with their department tag, but are unavailable to add for now. Retain the hover tooltip identifying their department and search by email name/address. This supersedes selectable cross-department membership for the initial delivery, consistent with deferring multi-department ability. Do not transfer the user or create a second membership. Future multi-department behavior remains deferred; implementation remains pending explicit approval.

Next question: when adding a career lead to an existing department, should an administrator select that department as part of granting career-lead access? Multiple career leads per department and administrator authority to grant/revoke career-lead access are already agreed; the assignment interaction is not yet settled. This question does not reopen career leads’ authority to create their own departments after approval.

### 14 October 2026 — Department career-lead designation by an existing career lead

Jaco clarified that administrators approve career-lead access only; they do not choose or assign the person's department. An existing career lead adds the person to their department. Within the same department users panel/view that lists department members, the existing career lead has an option to flag a user as a career lead for that department.

Separate administrator approval of career-lead eligibility from departmental designation by an existing career lead. This supersedes earlier administrator-owned department assignment for career leads. Multiple career leads within one department remain supported; an approved career lead's ability to create their own department remains agreed. Departmental designation must not silently bypass the previously agreed administrator approval requirement.

Next question: should the department's career-lead option be disabled until that user has administrator-approved career-lead access, with an explanation that administrator approval is needed? This interaction is proposed, not yet agreed; no automatic approval request or notification is implied. Implementation remains pending explicit approval.

### 14 October 2026 — Career-lead designation requires prior administrator approval

Jaco confirmed that the department users panel's career-lead option is disabled until the selected user has administrator-approved career-lead access. Show the previously proposed explanation that administrator approval is needed. Department-level designation cannot confer administrator approval or bypass it. Existing career leads assign the departmental role only once that prerequisite is satisfied.

Administrator revocation of career-lead access is already agreed, but its effect on ordinary department membership and access remains unresolved. Next question: if an administrator revokes career-lead access, should the person lose career-lead permissions immediately but remain an ordinary user in their department? This is a proposal, not yet agreed; do not infer removal of membership or deletion of data. Implementation remains pending explicit approval.

### 14 October 2026 — Protective administrator revocation versus departmental role removal

Jaco distinguished two actions:

- **Administrator revocation for protection:** intended to prevent malicious or damaging actions, including after dismissal. The person must not remain an ordinary participant or retain application access to read, copy or use department data. This supersedes the proposed administrator demotion-to-ordinary-user behavior. Blocking future application access cannot recall copies already obtained outside the application; no such recall capability is implied.
- **Departmental role management:** another existing career lead can remove a colleague's departmental career-lead role through the same users-panel control used to grant it. This is separate from the administrator's protective access block. The precise ordinary-user access remaining after departmental role removal has not yet been explicitly confirmed.

Before protective administrator revocation completes, at least one career lead must remain in the department. If the target is the only career lead, clicking Revoke prompts that a career lead is required and lets the administrator nominate a replacement in the same operation. The nominee may be a user in that department or a user from the global users list. Replacement and revocation must not leave the department without a career lead. This is an explicit exception to the normal rule that administrators only approve eligibility and existing career leads assign departmental leadership.

Still to clarify for that exceptional replacement flow: whether nomination also grants required administrator approval and department membership, and how nominees already assigned elsewhere interact with the initial multi-department restriction. Do not silently implement transfers or multiple memberships. No replacement, revocation or data change has been performed.

Next question: should the same at-least-one-career-lead rule prevent departmental career leads from removing the last career lead's role? This is a proposal for confirmation, not an already settled extension of the administrator-revocation rule. Implementation remains pending explicit approval.

### 14 October 2026 — Last career-lead removal prohibited

Jaco confirmed: a department must always have at least one career lead. Prevent career leads from removing the last career lead's role. This extends the already agreed replacement requirement for protective administrator revocation to ordinary departmental role management. Enforce this rule in the authoritative operation, not only by disabling a UI control; concurrent removals must not leave the department without a career lead.

Next question: when an administrator nominates a replacement during protective revocation, should that same confirmation also grant the nominee administrator-approved career-lead eligibility if they do not already have it? This is a proposal, not an agreed bypass or additional approval flow. Department assignment and eligibility of nominees already belonging elsewhere remain separate unresolved details. Implementation remains pending explicit approval.

### 14 October 2026 — User revocation and replacement approval confirmed

Jaco confirmed that the administrator's replacement confirmation also grants the nominee career-lead approval if needed. No separate administrator-approval step is required for that nominee in this flow.

The protective action is **user revocation**, available to administrators for both ordinary users and career leads. It removes the person's ability to participate or access department data; it is not merely removal of career-lead eligibility. If the revoked user is a career lead, preserve the department's at-least-one-career-lead invariant. If no other career lead remains, the administrator must nominate a successor before completing revocation, even if the successor's assignment is intended to be temporary. Temporary intent does not establish automatic expiry or a scheduling feature. Ordinary users require no career-lead succession check unless they also hold that role.

Departmental career-lead role removal by another career lead remains a separate action, subject to the last-career-lead safeguard. No revocation, replacement, approval or implementation has occurred.

Next question: for the initial single-department delivery, should replacement nominees be restricted to existing department members or registered users with no department, while users already in another department remain visible but unavailable for selection? This proposed constraint reconciles the global-user replacement list with the explicit deferral of multi-department membership and transfers. It is not yet agreed and narrows the earlier unrestricted nominee description only if confirmed. Implementation remains pending explicit approval.

### 14 October 2026 — Initial replacement eligibility confirmed

Jaco confirmed that administrator replacement selection permits members of the affected department and registered users with no department. Users already in another department remain visible but disabled for selection for now. This narrows the earlier global-user nominee description for initial delivery, consistent with deferring multiple memberships and transfers. Selecting a replacement does not authorize moving someone from another department.

The existing succession rule and combined administrator confirmation remain: the department must retain at least one career lead, and confirmation approves the replacement's career-lead access if needed. Implementation remains pending explicit approval.

Next question: when a career lead removes another person's departmental career-lead role, should that person retain ordinary user access within the same department? This would distinguish routine role management from administrator user revocation, which blocks participation and data access. The ordinary-user access outcome remains a proposal until confirmed.

### 14 October 2026 — Departmental demotion and membership removal confirmed

Jaco confirmed that removing a departmental career-lead role leaves the person as an ordinary user in the same department. Administrator user revocation is the action that blocks the person's system access entirely; departmental role removal must not implicitly revoke their account.

A career lead may also remove a user from their own department. If the target is a career lead, this is explicitly two steps: first remove their departmental career-lead role, then remove their ordinary department membership. Preserve the previously agreed last-career-lead safeguard at the role-removal step; do not permit membership removal to bypass that safeguard or combine the two actions silently.

When a user is removed from a department, retain that user's department data in the system and flag it as soft deleted, analogous to the data-preservation behavior for department soft deletion. Do not hard delete it, transfer it or imply an implemented restoration/export pathway. This is department-scoped membership/data handling, not administrator account revocation. Existing ordinary registration and the requirement for active department assignment before app functionality remain relevant.

Next question: should department removal also prevent that user from viewing or using the retained data for that department? This clarifies the effect of soft-deleted membership/data on access without designing restoration or export. Implementation remains pending explicit approval.

### 14 October 2026 — Removed user's access to retained department data

Jaco confirmed that removal from a department prevents that user from viewing or using their retained data in that department. The data remains in the system flagged as soft deleted; retention does not confer continuing access. This does not revoke the person's account globally. In the initial single-department delivery, a person without an active department assignment has no application functionality, consistent with the existing admission rule.

Next question: if the person is later added back to the same department, should their previously soft-deleted department data remain archived while they start fresh? This proposes a minimal initial behavior rather than an automatic restoration workflow; no reactivation, restoration or fresh-start rule has yet been agreed. Implementation remains pending explicit approval.

### 14 October 2026 — Rejoining with historical data deferred

Jaco identified rejoining the same department as an exceptional scenario. The future experience should offer a choice between restoring historical department data and starting fresh. Implementation of that choice and workflow is explicitly deferred until later; do not implement automatic restoration or silently start fresh in the initial version. Retained soft-deleted data remains preserved and inaccessible to the removed user under the existing rule.

The initial Add user behavior for a former member of the same department still needs a bounded decision, because proceeding would require choosing the deferred data behavior. Next question: should such former members remain visible but unavailable to add in the initial version, with an explanation that rejoining is not yet supported? This is proposed, not agreed. No restoration, reactivation, account or data changes have occurred. Implementation remains pending explicit approval.

### 14 October 2026 — Initial same-department rejoining restriction confirmed

Jaco confirmed that former members remain visible but unavailable to add back to the same department in the initial version. Show the explanation “Rejoining is not yet supported.” Preserve their soft-deleted historical data without restoring it or starting a fresh membership. The future restore-or-start-fresh choice remains deferred. This restriction must also hold at the authoritative assignment boundary rather than only in the dropdown; replacement nomination must not silently bypass the deferred same-department rejoining workflow.

Next question: should an ordinary registered user be able to request career-lead approval from their account settings after registration? The initial registration request can identify desired career-lead access, but the later request entry point is not yet settled. This proposal does not add department-join requests or automatic notifications. Implementation remains pending explicit approval.

### 14 October 2026 — Career-lead requests from account settings confirmed

Jaco confirmed that existing ordinary users can request administrator approval for career-lead access from their account settings after registration. This supplements the initial registration request option. Submitting a request does not grant career-lead eligibility or departmental leadership; administrator approval and the applicable departmental designation/create-department rules still apply. This is not a department-join request workflow. Implementation remains pending explicit approval.

Next question: should administrators review pending career-lead requests in an in-app list with Approve and Deny actions, handling any identity/team verification through direct contact outside the app? This proposed review surface would support the agreed administrator verification responsibility without introducing messaging or automated notifications. The exact review interface has not yet been agreed.

### 14 October 2026 — Administrator career-lead request review confirmed

Jaco confirmed an in-app list of pending career-lead requests with Approve and Deny actions. Administrators handle verification through direct contact outside the app. Do not introduce in-app messaging or automated notifications for verification. Approval grants career-lead eligibility; it does not silently assign a department or bypass the established departmental leadership rules. Denial does not itself constitute administrator user revocation. Implementation remains pending explicit approval.

Next question: should the requester see Pending, Approved or Denied status in account settings, with another request disabled while one is pending? This proposes visible feedback and duplicate-request handling without adding notifications. These details are not yet agreed.

### 14 October 2026 — Career-lead request status and pending restriction confirmed

Jaco confirmed that account settings show the career-lead request status as Pending, Approved or Denied. Disable submission of another request while a request is pending; prevent duplicate pending requests at the authoritative request boundary as well as in the UI. Approval remains career-lead eligibility rather than automatic department assignment. Implementation remains pending explicit approval.

Next question: after a request is denied, should the user be able to submit a new career-lead request from account settings? The confirmed pending restriction does not yet establish the behavior after denial. No cooldown, appeal process or automatic notification is proposed.

### 14 October 2026 — Single career-lead request pathway and retry after denial

Jaco confirmed that users may submit a new career-lead request after denial. The existing prohibition on duplicate pending requests remains.

Jaco directed simplification of initial registration: remove the initial career-lead request/role-choice mechanism. Register as an ordinary user, then request career-lead access through account settings. Account settings becomes the sole self-service career-lead request entry point, avoiding duplicate registration and post-registration implementations. The agreed administrator replacement flow remains a separate governance action, not another self-service request pathway.

Jaco referred to requesting career-lead access “once you have approved access.” This wording needs clarification against the existing agreement that ordinary users from approved domains register without individual administrator approval and cannot use app functionality until department assignment. Do not silently reinstate ordinary-account approval or require department assignment before a prospective first career lead can request eligibility and create a department.

Next question: should an approved-domain user be able to access account settings and request career-lead approval immediately after registration, before department assignment, while other app functionality stays blocked? This onboarding exception is proposed, not yet confirmed. Implementation remains pending explicit approval.

### 14 October 2026 — Pre-membership account settings and initial career-lead flow confirmed

Jaco confirmed that account settings are accessible before department membership so registered users can request career-lead approval. The agreed initial flow is:

- An ordinary user registers with an approved-domain Google work account without individual administrator approval.
- Account settings are available before department membership, including the single career-lead request entry point and Pending/Approved/Denied status. Other department functionality remains unavailable until membership exists.
- An ordinary user joins a department when its career lead adds them through the agreed existing-user selection flow.
- A prospective career lead can request administrator approval without department membership. Once approved, they can create their department and become its career lead without further administrator approval.

Jaco explicitly deferred the edge case of an approved career lead with no department being added to someone else's department. Do not implement that onboarding path initially. This deferral does not itself cancel the existing ability to promote an ordinary member of a department after administrator approval, or the separately agreed administrator succession flow. Avoid extending or cancelling either without confirmation.

Next question: should the initial version still let an existing ordinary department member obtain administrator career-lead approval through account settings and then be flagged as an additional career lead by an existing lead in that department? This checks the boundary of the newly deferred edge case against the earlier multiple-career-lead agreement. Implementation remains pending explicit approval.

### 14 October 2026 — Initial dogfooding scope: one department and one career lead

Jaco clarified that initial delivery is for a single department, a single career lead and that department's members. Promoting an existing ordinary member to an additional career lead is explicitly deferred, alongside the already deferred unassigned-career-lead joining scenario and multi-department membership. These expansion capabilities are for after dogfooding, when opening the system to other departments; they are not initial implementation requirements.

This supersedes initial-delivery wording that assumed multiple career leads and routine departmental career-lead promotion/demotion controls. Retain those earlier decisions as future direction rather than implementing them now. Preserve the confirmed ordinary registration, pre-membership account settings, administrator-approved initial career-lead creation and ordinary member-assignment flow. Do not infer removal of protective administrator revocation or its succession requirement: that previously agreed safeguard needs a separate scope reconciliation rather than silently treating it as routine additional-lead promotion.

The previously approved six-slice breakdown predates this scope reduction. Cross-department example browsing and the two-department practical check also predate it; their initial delivery placement requires explicit reconciliation. Do not claim the earlier breakdown is implementation-ready or that all cross-department requirements have automatically been cancelled.

Next question: should browsing other departments' examples also be deferred until after dogfooding, with only the engineering example available initially? This proposes an initial-scope change to the earlier example-browsing requirement; it is not yet confirmed. Implementation remains pending explicit approval. No product code, permissions or department records were changed.

### 14 October 2026 — Engineering-only example for initial dogfooding

Jaco confirmed that browsing other departments' examples is deferred until after dogfooding. Initial delivery includes only the engineering example. Do not implement the cross-department example selector in the initial release. Retain cross-department browsing as future scope, separate from the already deferred multi-department working-context switcher.

This supersedes the initial-delivery placement of cross-department browsing in D04 and P5. The previously agreed two-department practical check remains associated with that deferred capability; it cannot be claimed as performed or required to demonstrate an initial cross-department UI that is now out of scope. Reconcile the initial acceptance plan and six-slice breakdown when consolidating the dogfooding scope. Engineering guidance, example authoring and the other applicable practical checks remain in scope unless separately changed.

Next question: should initial dogfooding retain administrator user revocation, including the required replacement when revoking the sole career lead? This is distinct from deferred routine promotion of additional career leads. Its initial-delivery placement needs confirmation in light of the single-department/single-career-lead scope. Implementation remains pending explicit approval.

### 14 October 2026 — Administrator revocation deferred; backend career-lead assignment sufficient for beta

Jaco deferred administrator user revocation and its successor/replacement workflow from initial dogfooding. For prototyping/beta testing, the ability to specify the single career lead through a backend process is sufficient, including manual data modification in the hosting system. A user-facing career-lead assignment or succession administration interface is not required to satisfy that initial need.

Retain the earlier revocation and succession decisions as future direction, not initial implementation requirements. Backend assignment is a planning allowance, not authorization to modify live accounts or hosting data now, and not an assertion that a hosting system or operational procedure already exists. Initial scope remains one department, one career lead and its members. Implementation remains pending explicit approval.

One related scope question remains: should the career-lead request/status screens and administrator Approve/Deny list also be deferred, with the initial career lead assigned solely through the backend process? This simplification is proposed, not yet confirmed. Do not silently remove Google work-account sign-in, approved-domain eligibility or membership-based access checks.

### 14 October 2026 — Career-lead request and approval screens deferred for beta

Jaco confirmed that career-lead request screens and administrator approval screens are deferred. Assign the initial single career lead through the backend for beta testing. This supersedes initial-delivery requirements for account-settings career-lead requests, Pending/Approved/Denied request status, resubmission after denial, duplicate-pending handling and the administrator Approve/Deny list. Preserve those decisions as future expansion direction, not beta implementation tasks.

No manual hosting/account change is authorized by this planning decision. Google work-account sign-in, approved-domain eligibility and membership-based access remain established requirements unless separately changed. Do not build account-settings request UI solely to support the now-deferred approval pathway. Initial department creation setup remains to be clarified.

Next question: should the single engineering department also be created through backend setup for beta, with the career lead using the application to add members? This would defer department-creation UI while retaining the agreed member-management interaction; it is a proposal, not yet agreed. Implementation remains pending explicit approval.

### 14 October 2026 — Backend engineering department setup confirmed for beta

Jaco confirmed that the single engineering department is created through backend setup for beta. The initial career lead is also assigned through the backend, as previously agreed. Department-creation UI is deferred; this supersedes the initial-delivery requirement for an approved career lead to create a department through the application.

The career lead adds members through the application using the agreed Add user searchable existing-user dropdown. Ordinary users still register through eligible Google work accounts and require department membership for department functionality. Backend setup does not authorize creating accounts, departments or hosting records during this planning session. Implementation remains pending explicit approval.

Next question: should approved work email domains also be configured through backend settings for beta, deferring an administrator domain-management screen? Domain eligibility remains required; only the management interface is under discussion. This is a proposal, not yet agreed.

### 14 October 2026 — Backend approved-domain configuration confirmed for beta

Jaco confirmed that approved work email domains are configured through backend settings for beta. Defer the administrator domain-management screen. Approved-domain eligibility for Google work-account registration remains required; this changes how the domain list is managed, not the admission rule. No actual domain values have been supplied or configured in this session.

The beta setup now includes backend creation of the engineering department, backend assignment of its single career lead and backend configuration of approved domains. The career lead adds registered members through the application. Implementation remains pending explicit approval.

Next question: should department rename and deletion controls also be deferred for beta, with any exceptional department cleanup handled through the backend while preserving existing data? This proposes deferring UI scope only; it does not authorize deletion, change the agreed data-preservation requirement, or defer ordinary member assignment. It is not yet agreed.

### 14 October 2026 — Department rename and deletion controls deferred for beta

Jaco confirmed that department rename and deletion controls are deferred for beta. Exceptional department cleanup is handled through the backend while preserving existing data. This supersedes initial-delivery UI requirements for department renaming and soft/hard deletion; the earlier lifecycle decisions remain future direction. Backend cleanup is not permission to destroy retained data, nor authorization to perform a live cleanup during planning.

The initial engineering department remains backend-configured. In-app member addition remains agreed. Whether individual member removal remains an initial UI capability requires a separate scope decision; department-control deferral does not silently remove that capability.

Next question: should removing an individual member from the department also be handled through the backend for beta, leaving the career lead's in-app member controls focused on adding members? If deferred, any backend removal must still end the removed user's department access and preserve their department data as previously agreed. This is a proposal, not yet confirmed. Implementation remains pending explicit approval.

### 14 October 2026 — Backend member removal confirmed for beta

Jaco confirmed that member removal is handled through the backend for beta. Preserve the removed person's department data and remove their department access. The previously agreed soft-deleted retention behavior remains applicable; retaining data does not grant the removed person access to it. In-app membership controls focus on adding members, not removal, role management or restoration.

This supersedes initial UI requirements for member removal and the two-step career-lead-role/member-removal interaction. Those remain future direction alongside deferred additional-career-lead management. Backend operations must not silently destroy user data or bypass the agreed last-career-lead safeguard. No backend data change is authorized or performed during this planning session. Implementation remains pending explicit approval.

Next question: should the career lead still be able to edit engineering guidance and its worked example through the app during beta, or should those resources remain fixed until after dogfooding? In-app text editing remains in the recorded scope unless Jaco changes it; this question checks its priority following the administrative UI reductions without treating deferral as already agreed.

### 14 October 2026 — Fixed guidance and engineering example for beta

Jaco confirmed that guidance and the engineering example remain fixed for beta. Defer in-app resource editing until after dogfooding. This supersedes initial-delivery requirements for departmental heading/body/example editors and P4/P5 resource-editing behavior. Produce the agreed guidance and example as application-supplied content; do not introduce editable shared templates or a content-management workflow.

The career-lead text-authoring practical check and resource-write HTTP checks belong with the deferred editing capability, rather than being claimed as passed or required against nonexistent beta editors. Preserve browser-level behavior testing, newcomer preparation/understanding and review-timing checks for the fixed resources. Reassess HTTP authorization checks against the remaining beta member-assignment and membership-access boundaries when revising the breakdown; do not imply the confirmed testing approach has been discarded.

Current beta scope is one backend-created engineering department, one backend-assigned career lead, backend-configured approved Google work email domains, ordinary registration, in-app addition of registered members, membership-gated department functionality, and fixed guidance/engineering examples. Removal and exceptional cleanup are backend operations preserving data and ending removed memberships' access. Previously recorded expansion features remain deferred.

The earlier approved six-slice breakdown is no longer an accurate initial-delivery plan after these explicit scope changes. Next proposed action: consolidate the confirmed beta decisions into the main specification and prepare a smaller revised breakdown for review, preserving superseded decisions as history and deferred capabilities as future scope. This consolidation does not authorize implementation or automatically approve the revised breakdown. Implementation remains pending explicit approval.
