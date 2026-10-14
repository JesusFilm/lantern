> Historical snapshot. Superseded for initial delivery by the current beta specification and breakdown. Original relative links below are relative to the parent feature directory.

# Position-focus guide — approved breakdown structure

Milestone: M01
Review: Original six-slice structure superseded by beta scope reductions; revised breakdown pending review
Implementation: Not authorized
Date: 14 October 2026

This is the approved six-slice structure accompanying the [specification](spec.md), not published implementation tickets. Test seams are confirmed: browser-level behavior, focused HTTP department-boundary checks and the four practical walkthroughs. Tool selection is not yet agreed. Existing decision records 01–05 stay intact; after settling the identity prerequisite, publish individual implementation tickets using the next unused numbers (currently 06 onward), translating proposal references below into actual ticket numbers.

Each application slice includes its usable content, UI, any required server/persistence behavior and externally observable tests. There is no separate infrastructure-only or test-only build phase. The existing health-only application does not warrant a standalone prefactor. P6 is intentionally practical verification rather than an application feature.

## Approved slices

### P1 — Open mission-objective guidance with mission context

**Blocked by:** None within this proposal. All execution remains approval-gated.

**Delivers:** A reader can open help in a minimal position-focus support entry point and use a short mission-objective walkthrough with fixed generic content available on first run. This entry point allows M01 to be demonstrated before the drafting workflow exists.

Acceptance criteria:

- Help is visible and opens only on reader action; short steps use Next transitions and application-controlled professional, restrained presentation.
- The objective walkthrough explains whom the engineer serves, intended outcomes and mission connection; product work, internal contributions and discovery are valid starting situations.
- The supplied organizational mission is preserved exactly. A reader-controlled collapsible context banner remains accessible across steps, displays supplied organizational mission/department contribution, and omits missing context.
- Generic content is hard-coded system data, usable without a department author first editing it. No editable shared template is introduced.
- Browser checks demonstrate entry, navigation and banner behavior, including missing context. Introduce only the browser harness needed for this slice; preserve existing health checks.

**Traceability:** D01/D03/D04; stories 2–5, 10–13, 25.

### P2 — Teach SMART goals, gaps, development and agreement

**Blocked by:** P1, which supplies the walkthrough presentation and support entry.

**Delivers:** A reader independently selects the SMART walkthrough and can learn how to prepare a meaningful focus and understand review and lock-in.

Acceptance criteria:

- A worked example improves a vague goal through all five SMART qualities, allowing suitable observable evidence without compulsory numbers or five written sections.
- Guidance covers the agreed content areas without presenting them as required form fields. Known-direction initial-discussion guidance covers a mission-aligned objective, SMART goals, explicit gaps and next steps, and users/needs/outcomes where known.
- Explain active pursuit of clarification and leadership responsibility for absent direction. Preserve Jaco’s coordination with Tatai/Edmond and Sushma’s QA involvement without extra approvers.
- Explain draft, joint review/refinement, agreement and lock-in, outstanding gaps with next steps, revisability and the distinction between agreement and objective achievement.
- Explain optional personal development and separate leadership development assignments, their SMART approach and joint agreement. Describe their later Add optional section behavior without implementing a drafting form here.
- Timing text directs readers to departmental guidance and to their career lead when timing is absent. Annual/quarterly illustrations are clearly examples; there is no one-month requirement, default cadence or schedule feature.
- Browser checks cover independent walkthrough selection and displayed guidance. Human content review checks fidelity to D01–D05; understanding remains subject to P6.

**Traceability:** D01–D05; stories 1, 6–9, 14, 17–24, 30.

### P3 — Browse the full engineering position-focus example

**Blocked by:** P1, which supplies the usable support entry. P2 does not gate production of the independently specified example.

**Delivers:** Readers can find and read the full engineering product-work example in the application, including gaps and next steps.

Acceptance criteria:

- Inspect the supplied reference when producing the example; develop its product-work scenario rather than inventing a mandated organizational template.
- Show mission objective/SMART goals, users, needs, outcomes and contribution, with explicit gaps and next steps.
- Illustrate personal development and leadership development distinctly and label them optional; explain the shared SMART approach.
- Keep counts, targets and dates illustrative. Do not imply achieved objectives, mandatory fields or a universal review cycle.
- Browser checks demonstrate discovery and reading of the example with its illustrative/optional labels. Content review checks the source scenario and agreed coverage.

**Traceability:** D01/D03; stories 15–18.

### P4 — Save and read own-department guidance

**Blocked by:** P2. Also gated by selection of a trusted identity/department-association approach before this slice can be published as implementation-ready.

**Delivers:** A career lead edits their department’s support text and readers receive that guidance; departments without customization continue to use generic guidance.

Acceptance criteria:

- Resolve reader/editor identity, career-lead authority and department independently of the example selector. A client-supplied department or demo identity selector must not establish editing authority.
- A career lead can save heading/body text and teaching examples for their own department, including review process/timing text and supplied department contribution. Presentation and animation remain application-controlled.
- Saved edits survive reopening and server restart. Retaining generic guidance requires no customization. Missing timing still directs the reader to their career lead.
- Reader requests resolve the appropriate departmental guidance. Editing another department is rejected by the server and leaves that department unchanged; readers cannot invoke career-lead editing operations.
- Departmental editing cannot modify fixed generic data. There is no shared correction/adoption/synchronization/versioning workflow.
- Browser checks cover edit, save and subsequent reader views; HTTP checks cover authorized edits, unauthorized and cross-department attempts, unchanged content after rejection and immutable defaults.

**Technical proposal:** Persist optional departmental guidance separately from system defaults; absence of customization means use generic guidance. Keep guidance content separate from independently stored full position-focus examples. Use the existing application/database boundary; exact schema and API contracts remain implementation design details.

**Identity dependency:** No identity integration exists today. Before execution, select an existing trusted identity source if available, or explicitly scope minimal identity/association work. Do not silently add account administration, choose an external provider or use fixtures as production authorization. This is a technical prerequisite, not a reopened product interview. It may require splitting P4 after its size is known.

**Traceability:** D03–D05; stories 13, 25–26, 29–30.

### P5 — Customize and browse departmental examples independently

**Blocked by:** P3 and P4, which provide the full-example experience and trusted department editing boundary.

**Delivers:** Career leads save their own departmental full examples; all readers browse available department examples without changing their own support guidance.

Acceptance criteria:

- Full departmental examples are independently editable from guidance. A department can retain generic guidance with its own custom example.
- Engineering has the initial populated full example; other departments can add theirs. Missing examples are not replaced with invented departmental content.
- The department selector changes only the example displayed. The reader’s walkthroughs, context and review-process guidance remain associated with their own department.
- Own-department example edits persist; unauthorized/cross-department writes are rejected and fixed system defaults remain unchanged.
- Browser and HTTP checks exercise two departments: A retains generic guidance with a custom example; B customizes guidance and provides an example. Readers from both browse both examples while retaining their own guidance; editing boundaries hold.

**Traceability:** D04; stories 26–28; agreed two-department check.

### P6 — Run the agreed practical acceptance walkthroughs

**Blocked by:** P2 and P5, collectively delivering all resources and department behavior.

**Delivers:** Recorded evidence of whether the usable guide meets the four agreed practical checks, with findings and follow-through rather than assumed success.

Acceptance criteria:

- A newcomer uses the resources to prepare an objective/SMART goals and gaps/next steps, explains joint review and lock-in, finds useful examples and understands optional development. Preparation can use a separate document while the application’s drafting workflow is absent.
- A career lead edits departmental content without design or animation skills.
- Run the two-department scenario with real reader/editor interactions, checking retained guidance, independent examples and editing boundaries.
- A reader distinguishes illustrative cycles from departmental expectations and knows whom to ask when timing is absent.
- Record observations, unmet criteria and any corrective follow-up without invented participant counts or numerical success targets. Rerun affected checks after relevant corrections; do not substitute automated pass results for observed understanding.
- Report evidence for milestone review without automatically marking it Complete or claiming whole-team cycle completion. Production personnel data stays outside Git; repository evidence uses anonymized observations.

**Traceability:** D03/D04/D05; all four agreed practical checks.

## Dependency and scope review

The approved graph is P1 → P2 and P3; P2 → P4; P3 + P4 → P5; P2 + P5 → P6. P4 also needs the explicit identity decision. P2 and P3 can proceed independently after P1. No other milestone is declared a blocker simply because it appears earlier or later in the roadmap.

M01 delivers guide resources and departmental guidance/example capabilities. Later drafting/review work owns operational Add optional section controls, drafter/career-lead editing of a person's development sections, joint lock-in and revisions. Their contracts remain in the specification; no tickets or edits for other milestones are created here. Integrating help into the eventual drafting experience belongs with that later workflow. The provisional January 2027 deadline remains unchanged.

The scope of P4’s identity prerequisite is the main technical uncertainty affecting ticket sizing. The six-slice structure and dependencies are approved; settle that prerequisite before publishing P4 as ready for execution. Approval of this breakdown permits ticket preparation/publication only; implementation still requires explicit user approval.

## Next planning action

Settle P4’s identity prerequisite with Jaco one question at a time, then publish approved, individually numbered tickets without overwriting decision records 01–05. No implementation or practical verification has occurred during this planning work.

## Comments

### 14 October 2026 — Breakdown structure approved

Jaco: “The six slices and dependencies look right. Record my approval of the breakdown, then help me settle the department identity prerequisite one question at a time. Keep implementation pending my approval.”

The six slices and blocking edges are approved. This does not select an identity provider, determine who assigns department membership or career-lead authority, or authorize implementation. Identity planning is the next action; no implementation tickets have yet been published.

### Department identity — opening question

Repository records leave authentication options open and identify no existing trusted identity integration. First establish whether the intended users already have an organizational sign-in this application should reuse. Provider selection and department/role assignment remain undecided.

### 14 October 2026 — Google work-account preference

Jaco: “I’d prefer people to use their existing work accounts - google”. Use existing Google work accounts as the preferred sign-in direction. This does not yet establish allowed organizations/accounts, automatic access, department membership or career-lead editing authority. Google sign-in must not by itself grant departmental editing rights.

Next question: who assigns each person’s department and career-lead permissions? Proposed initial approach, not yet agreed: Jaco or a designated administrator assigns them in the application. No Google directory synchronization or administration UI is assumed. Implementation remains unauthorized.

### 14 October 2026 — Department and permission assignment confirmed

Jaco confirmed that he or a designated administrator assigns each person’s department and career-lead permissions in the application. This settles assignment authority; Google sign-in does not automatically establish departmental membership or career-lead rights. The mechanism for designating administrators and the detailed administration interface remain unspecified.

Next question: should application access require Jaco or a designated administrator to approve each person’s specific Google work account, rather than automatically admitting everyone from an allowed work domain? Account eligibility and the admission mechanism remain undecided. Implementation remains pending Jaco’s explicit approval.

### 14 October 2026 — Individual account approval and approved domains

Jaco requires approval of each person’s Google work account by himself or a designated administrator, taking into account approved work email domains configured by the administrator. Admission requires both an approved work email domain and individual account approval; domain membership alone does not admit a person. Department membership and career-lead permissions remain explicitly assigned by Jaco or a designated administrator. No domain list, invitation/request workflow or automatic role assignment is established by this decision.

Next question: should initial setup designate Jaco’s specific Google work account as the first administrator, who can then designate additional administrators? This bootstrap approach is proposed, not agreed; no account address is recorded or configuration changed. Implementation remains pending Jaco’s explicit approval.

### 14 October 2026 — Initial administrator confirmed

Jaco confirmed that initial setup should designate his Google work account as the first administrator and allow him to appoint additional administrators. This is an agreed setup requirement, not a completed account configuration. His specific account address and initial approved work domains have not yet been supplied. Do not infer that the first person to sign in becomes administrator, or that all subsequently designated administrators may appoint other administrators; the latter authority has not been settled. Existing individual account approval and approved-domain requirements remain in force.

Next question: should a person signing in with an eligible work account be able to request access for administrator approval, or must an administrator approve their specific account before their first sign-in? The admission workflow remains undecided. Implementation remains pending Jaco’s explicit approval.

### 14 October 2026 — Access requests and department assignment responsibilities

Jaco agreed the following admission flow and responsibilities:

- People from administrator-approved work email domains can sign in with Google and request access. Administrator approval is required before application use.
- The request identifies whether the person is seeking access as a career lead or as a user; the administrator can see that requested role. A requested role is not a granted permission.
- Administrators create departments and assign career leads to departments.
- A user cannot access application functionality until a career lead assigns them to that career lead’s own department. Administrator approval alone is insufficient for user access; both approval and department assignment are required.
- This refines the earlier general agreement that Jaco or an administrator assigns departments and permissions: administrators own department setup and career-lead assignment; career leads own user assignment into their own department. No cross-department assignment authority is implied for a career lead.
- Initial administrator setup, Jaco’s authority to appoint additional administrators, individual account approval and approved-domain requirements remain agreed. This flow does not authorize implementation.

Still unresolved: how an approved user reaches the appropriate career lead for assignment. Next question: should the administrator route the approved user to a career lead, who then assigns the user to their own department? This routing approach is a proposal, not an agreement. Department visibility and assignment authority must not be inferred from the requested role or email domain.

Implementation remains pending Jaco’s explicit approval. No access requests, accounts, departments or permissions have been created or changed.

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
