Kind: ticket
Title: Agree how shared guidance updates reach departments
Milestone: M01
Type: grilling
Labels: wayfinder:grilling
Status: resolved
Blocked by: 03
Slice: Position focus guide
Summary: Decide how shared default guidance is maintained and how later changes affect departmental adaptations.

---
## Current scope — 15 October 2026

This resolved decision is retained as planning history. The [current PRD](../../../docs/PRD.md), [accepted baseline](../spec.md) and [M06 team trial](../../team-trial/spec.md) supersede earlier scope where they differ. The original Answer and discussion below have not been rewritten.

Fixed generic content remains the current delivery. Department customization, multiple departments and cross-department example browsing are parked candidates, not an implementation commitment. No shared-content synchronization/adoption workflow is required.

## Question

Who maintains the shared default walkthrough text, and what should happen when it changes after a department has adapted its wording or examples?

## Context

[Agree the guide’s supporting resources](03-agree-guide-supporting-resources.md#answer) establishes shared starting text, department-specific text editing by career leads, and engineering as the initial use case. It does not settle ongoing synchronization or replacement of departmental adaptations.

Use a concrete case: a department has tailored its SMART example, then the shared explanation is corrected. Decide whether the department keeps an independent copy, receives changes for its career lead to adopt, or follows another agreed approach, and who is responsible for the shared wording. These are options for discussion, not agreed behaviour. Do not assume that updates overwrite department edits or that a sophisticated versioning workflow is needed.

Keep this to initial-delivery content ownership and update behaviour. Technical storage, rich editing, visual customization and implementation tickets are outside this decision.

## Comments

### 14 October 2026 — Created after supporting-resources resolution

Unclaimed and unresolved. This precise question replaces the previously unspecified shared-default update behaviour. It is the next planning action, not permission to implement.

### 14 October 2026 — Planning session claimed

Claimed by chat `01a1378c-3028-70e3-9dda-ed9a426f9b4c` to work with Jaco one question at a time. Parent context: “Agree the guide’s supporting resources”, chat `01a1375c-c735-7a53-b4c5-c7ad2cdd8779`, host `local`.

This session owns only shared-default wording ownership and how changes reach existing and newly starting departments. Recommendations remain proposals until Jaco agrees. Review timing remains a separate open decision; the guide milestone remains `Kind: milestone` and `Status: needs-info`.

Opening recommendation, awaiting Jaco’s answer: preserve an existing department’s adapted text until its career lead deliberately adopts a shared update. Concrete case: a department edits its SMART example, then a shared explanation is corrected. This recommendation does not yet choose what happens to unedited text, how a correction is made available, who maintains the defaults, or how newly starting departments receive them.

Proposed observable success, not yet agreed: trace a shared correction through an existing customized department and a newly starting department, making the responsible person, resulting text and any deliberate adoption action clear without unexplained loss of local edits. No implementation or practical verification has occurred.

### 14 October 2026 — Guidance ownership and example browsing clarified

Jaco clarified that the career lead is responsible for guidance, support and documentation for the people they coach. Career leads may modify only their own department’s support resources. An engineer sees the resources their career lead has set up; browsing departments is not a means of switching the engineer’s guidance.

The department selection box belongs to the position-focus example display. Everyone can browse all departments’ examples as reference material to help understand objectives and SMART goals, including examples from departments whose work they may know better. This narrows the department-selector wording in the earlier supporting-resources decision: it does not select the broader guidance being shown to an engineer.

### 14 October 2026 — Fixed generic template and optional customization agreed

Jaco specified that the generic template cannot be changed. It will be curated before delivery and supplied as hard-coded system data, available by default when the application first runs. Career leads customize their own departmental resources, not that generic source.

A career lead may use the generic guidance unchanged. Departmental customization is optional, and a department may choose to provide only its own position-focus example while retaining the generic support documentation. The example and the guidance are separate customization choices.

This removes the premise of ongoing shared-template editing in the initial delivery. The opening proposal about career leads adopting subsequent shared corrections, and its proposed correction-tracing success scenario, are superseded. No synchronization, update notifications, versioning or adoption workflow is being agreed. Future software-release changes to system defaults are not specified by this decision.

Consolidated understanding awaiting final confirmation: departments start with the fixed generic guidance; career leads may leave it unchanged or customize their own department’s resources; their coached people receive that guidance; departmental position-focus examples can be customized independently and browsed by everyone through the example-only department selector.

Proposed practical check, awaiting confirmation: demonstrate one department using generic guidance with a custom example and another using customized guidance; each person receives their own career lead’s guidance, can browse both examples without switching guidance, and a career lead can edit only their own department’s resources. Verify only once resources and the application exist; no verification has occurred. Review timing remains the next separate planning decision after this decision is confirmed and closed.

## Answer

Resolved with Jaco on 14 October 2026 following his confirmation: “Yes, that captures it. Close this decision, update the map, and identify the next planning action for review timing.” This consolidated answer supersedes earlier proposals in the comments, including the proposed shared-correction adoption workflow.

### Generic guidance and departmental ownership

- The generic guidance template is carefully curated before delivery, fixed and supplied as hard-coded system data available by default when the application first runs. It is not editable shared content maintained by career leads.
- Departments start with that generic guidance. A career lead is responsible for the guidance, support and documentation for the people they coach and can modify only their own department’s resources.
- Customization is optional. A career lead can retain the generic support documentation unchanged, including when supplying a custom departmental position-focus example.
- People opening support resources receive the guidance their career lead has provided for their department. The reader does not switch that guidance by selecting another department.

### Examples and department selection

- Departmental position-focus examples can be customized independently of the guidance.
- Everyone can browse all departments’ examples as reference material to understand objectives and SMART goals.
- The department selector changes only the example being viewed. This clarifies the broader department-selector wording in the supporting-resources decision; it does not select an engineer’s support documentation.

### Shared updates and practical check

- Fixed generic content removes the need for an ongoing shared-template update workflow in the initial delivery. Synchronization, update notifications, versioning and deliberate adoption of shared corrections are not required by this decision. Future software-release changes to system defaults are outside this decision.
- The agreed practical check uses two departments: one retains generic guidance with a custom example, and the other customizes its guidance. People receive their own career lead’s guidance and can browse both examples without switching guidance; career leads can edit only their own department’s resources.
- Perform that check once the resources and application exist. No implementation or practical verification has occurred.

### Remaining planning

The next planning action is [Agree how the guide describes review timing](05-agree-guide-review-timing.md): establish how the first review a month after writing relates to the set annual review, adjustment and retrospective periods, and what the guide says when calendar details are absent. That decision remains unclaimed and unresolved. Do not assume that one review replaces or resets another, invent dates or frequency, or fix the provisional January 2027 deadline.

No additional in-scope fog was identified on closing this decision. Reassess after the review-timing decision. The guide remains `Kind: milestone`, `Status: needs-info`; specification, an approved implementation breakdown, production and verification remain later work.
