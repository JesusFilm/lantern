Title: Position-focus guide — engineering beta
Milestone: M01
Status: ready-for-agent
Review: Four-slice beta breakdown approved; implementation tickets published
Implementation: Tickets 06–08 implemented; 09 automated evidence ready, human verification pending
Date: 14 October 2026

Current execution update (14 October 2026): Jaco authorized completing tickets 07–08 and automated/preparation work for 09, deferring Google setup and all human verification until final review. Tickets 06–08 are implemented; 09 remains ready-for-human. M01 is in Verify, not complete. See the [verification record](../../docs/system/guide-verification.md) and [private preview](https://jacobuntu.tail5c6dbf.ts.net/lantern-guide/).

This document consolidates the beta decisions. Historical publication-only statements below record the earlier planning boundary; the execution authorization above supersedes them. Later beta deferrals continue to override historical expansion requirements.

## Problem Statement

Engineers need to prepare a meaningful position focus, understand how it is agreed, and handle missing information without inventing answers. Jaco needs to dogfood that experience with one engineering department before investing in broader department administration and customization.

## Solution

Deliver fixed, curated guidance and an engineering example behind Google work-account sign-in and department membership. Backend setup configures approved email domains, creates the engineering department and assigns its single career lead. Ordinary eligible users register without administrator approval; the career lead adds them through the app. No department content editor or administrator approval UI is needed for beta.

The guide explains the position-focus contract. This milestone does not absorb full position-focus drafting, submission, storage or joint lock-in workflows owned by later milestones. A learner can prepare a focus in a separate document during guide verification.

## User Stories

1. As an operator, I want to configure approved work domains, the engineering department and its career lead through backend setup, so that beta needs no administration screens.
2. As an engineer, I want to register using my existing eligible Google work account without individual approval, so that my career lead can add me.
3. As an unassigned registered user, I want to understand that I must contact my career lead directly, so that I know how to gain department access without an in-app join request.
4. As a career lead, I want Add user on the department users/profile view to show a searchable list of registered users, so that I select an existing person rather than type an invitation address.
5. As a career lead, I want existing membership and unavailable choices identified, so that I cannot accidentally transfer someone or restore a former membership.
6. As a member, I want optional guidance for objectives and SMART goals, so that I can use the help relevant to me.
7. As a member, I want the mission and supplied department contribution accessible across walkthrough steps, so that I can connect my objective to the mission.
8. As a member, I want guidance for product work, internal contributions and discovery, so that the resources fit different starting situations.
9. As a member, I want to record gaps and next steps, so that uncertainty leads to active clarification rather than invented answers.
10. As a member, I want SMART examples using evidence suited to the objective, so that I need not force numerical targets or five written sections.
11. As a member, I want a full engineering example, so that I can see the agreed content in practice without treating illustrative details as requirements.
12. As a member, I want to understand optional development, joint review and lock-in, so that I know what is required and what completion means.
13. As a member, I want to distinguish review-process illustrations from actual departmental expectations, so that I ask my career lead when timing is absent.
14. As an operator, I want backend member removal to end department access while preserving data, so that exceptional cleanup does not destroy historical information.

## Implementation Decisions

### Confirmed beta access and membership

- One engineering department, one career lead and its members. Backend setup supplies the department, initial career-lead assignment and approved work email domains. Manual hosting-data modification is acceptable for beta; no live changes are authorized by this specification.
- Google work-account sign-in is the agreed direction. Approved-domain users register as ordinary users without individual administrator approval. Domain eligibility does not itself confer department or career-lead authority.
- Department functionality requires active membership. The career lead's backend assignment permits initial member management. Users coordinate registration and membership directly with their career lead outside the app; there is no join-request queue, invitation flow or automated messaging.
- Account settings may be accessed before department membership, as previously agreed, but career-lead request/status UI is deferred. Do not build a standalone settings feature solely for the removed request pathway. A minimal signed-in waiting state explaining the next step is proposed for beta.
- Add user lives in the department's users/profile view. It opens a dropdown of existing registered users, supporting selection and search by email name or email address. It does not create accounts from free text.
- Show all available registered users, including already-assigned users. Display a membership tick/tag and a hover tooltip naming the department. Users in another department remain visible but unavailable to add initially. Former members of the same department remain visible but unavailable, with “Rejoining is not yet supported.” Adding an existing member must not duplicate membership (implementation invariant).
- Single-department beta does not need multi-department creation, switching or management screens merely to demonstrate these restrictions. Use fixtures to check unavailable assignment states when necessary.
- Backend member removal preserves department data as soft deleted and ends the removed person's access to it. It does not globally revoke their account. Without an active membership, they cannot use department functionality. No automatic restore, transfer or fresh-start behavior is authorized.
- Department rename/deletion and exceptional cleanup are backend operations for beta, preserving existing data. No rename, delete, remove-member, role-management or account-revocation UI is required. Preserve the last-career-lead safeguard in backend operations; routine additional leads and succession screens are deferred.

### Confirmed guidance and example content

- Fixed, curated application-supplied guidance and a fixed engineering example are available from first run. No in-app text/example editor. Retain the ability to supply suitable engineering context in the delivered content without introducing an administration screen.
- Cover purpose/outcomes; responsibilities/current work and its source; users/beneficiaries; expectations; and gaps. These are content areas, not mandatory form fields. A critical mission objective and SMART goals are required; no fixed objective count or universal numerical targets.
- Preserve the mission: “We partner with the Body of Christ through heart language media, so everyone, everywhere can encounter Jesus.” Use organizational mission → department contribution → individual objectives, not separate missions at each level.
- A visible help indicator opens optional, user-initiated objective and SMART walkthroughs, independently selectable. Use small steps with Next transitions, professional restrained visuals, and application-controlled layout, typography and animation. No slide builder.
- A reader-controlled collapsible context banner stays accessible across steps, displays supplied mission/department context and omits missing context. Missing context never removes the requirement for an individual objective.
- Teach users' needs, intended outcomes and connection of work to mission. Internal contributions and discovery are valid; discovery must not shift leadership's responsibility for absent direction onto the engineer.
- Improve a vague goal through a worked SMART example considering specific, measurable, achievable, relevant and time-bound qualities. Evidence may be learning or demonstrated capability. Do not require five written sections or unsuitable numbers.
- Develop the supplied product-work reference into the full engineering example with gaps and next steps. Shorter walkthrough examples cover internal contributions and discovery. No mandatory organizational format exists; scenario counts, dates and targets are illustrative.
- Teach optional personal development and separate optional leadership development assignments, using the same SMART approach. Leadership development sits beneath personal development. Later drafting workflows own the discreet Add optional section control, hidden-until-added sections, drafter/career-lead editing and agreement before lock-in. These are taught here, not implemented as a focus editor.
- For known direction, initial discussion needs a mission-aligned objective, SMART goals, gaps/next steps, and users/needs/outcomes wherever known. Drafts may support exploratory discussion. Pursue clarification actively; gaps can remain with clear next steps.
- Engineer and career lead jointly refine and agree objective/goals and any included development. Lock-in completes the individual's focus for the cycle without additional sign-off; it does not mean objectives are achieved. The baseline can be revised together.
- Leadership supplies absent direction. Jaco coordinates with Tatai and Edmond, with Sushma involved for QA; disagreement calls for leadership support, not extra approvers. A focus remains draft until joint agreement.
- Career leads determine their departmental review process and timing. Beta communicates supplied expectations through fixed guidance or direct discussion, not an editor. No fixed one-month review, annual cadence, default schedule, external calendar requirement or calendar integration. Annual/quarterly cycles are illustrative only; absent timing directs readers to their career lead.

### Existing support and technical proposals

Inspection found only a React health page, Express health endpoint, PostgreSQL connectivity and HTTP health tests. Identity, membership and guide capabilities do not already exist. Ticket-board tests are not product authorization tests.

Proposed implementation direction, pending review: extend the existing app with verified Google identity, server-resolved career-lead/member authority and department-scoped access. Keep fixed resource content separate from presentation. Use the existing database/server test boundary for persisted membership and authorization. Exact authentication library, session design, schema and browser harness remain implementation choices, not previously agreed product requirements. Verify provider integration details against official documentation during authorized technical work.

Setup inputs still needed before deployment: initial career-lead Google account, approved domains, hosting/callback configuration and Google application credentials. These are configuration inputs, not reasons to reopen settled product behavior. No values are invented here.

## Testing Decisions

Confirmed approach: browser-level external behavior, focused HTTP authorization checks and practical walkthroughs. Prefer observable outcomes over private helpers or schema assertions. No product acceptance checks have yet been performed.

| Beta check | Observable evidence |
|---|---|
| Registration and assignment | Eligible users register; unassigned users cannot access department functionality; career lead finds and adds an existing user; the new member gains access. |
| Authorization and persistence | Unauthorized member-add requests fail; client-controlled identities/departments cannot grant authority; persisted assignments survive reopening. Backend removal ends access to retained department data, including through an existing signed-in session. |
| Assignment restrictions | Existing members are not duplicated; other-department users and former members are visible but cannot be added, with the agreed indicators/explanation. Test server enforcement as well as UI. |
| Fixed resources | Optional entry, independent walkthroughs, Next transitions, banner controls and missing-context behavior work; engineering example is discoverable. |
| Newcomer practical walkthrough | A newcomer prepares an objective/SMART goals and gaps/next steps, explains review/lock-in, finds examples and understands optional development. Preparation may happen outside the app's future editor. |
| Timing practical walkthrough | A reader distinguishes example cycles from departmental expectations and asks the career lead when timing is absent. |

The career-lead content-editing practical check and two-department guidance/example-browsing check are deferred with those features, not passed or discarded. No participant count or numerical success threshold is prescribed. Record anonymized observations and unmet criteria, correct relevant failures and rerun affected checks. Do not claim guide or team-cycle completion from automated tests alone.

## Out of Scope

For beta: administrator and career-lead approval/request screens, content editors, cross-department example browsing, multiple departments as a supported operating workflow, multiple career leads, multiple memberships, working-context switching, invitations, department join requests, membership-removal UI, department rename/delete UI, user-revocation/succession UI, data restoration/export and restructuring/migration workflows. See the [deferred feature register](deferred.md) for preserved decisions.

For this planning session: implementation, live backend changes, final resource production, implementation-ticket publication or milestone completion. Full focus drafting/submission/review remains separate milestone work. Scheduling, automated notifications, transcription, AI analysis and broad HR features remain outside the guide scope.

## Further Notes

Sources: consolidated answers [D01](issues/01-define-position-focus-content.md#answer), [D02](issues/02-agree-review-and-completion.md#answer), [D03](issues/03-agree-guide-supporting-resources.md#answer), [D04](issues/04-agree-shared-guidance-updates.md#answer), [D05](issues/05-agree-guide-review-timing.md#answer), plus the later beta decisions preserved in [discussion history](history/spec-before-beta-consolidation-2026-10-14.md). Later beta deferrals override initial delivery scope in the original answers; D05 still overrides earlier timing rules.

The [working reference](references/position-focus-working-example.png), [glossary](../../GLOSSARY.md) and [milestone](milestone.md) remain context. January 2027 team-cycle timing is provisional. Individual lock-in, guide delivery and whole-team completion are distinct.

The [four-slice breakdown](breakdown.md) is approved and its implementation tickets are published. Permission to implement remains separate and pending. M01's stage and completion criteria were not changed by this consolidation.

## Comments

### 14 October 2026 — Ticket publication approved

Jaco approved the four beta slices and their dependencies and authorized publication. Tickets 06–09 are published with an explicit implementation hold. No implementation or acceptance verification has occurred.
