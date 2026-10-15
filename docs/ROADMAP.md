# Lantern roadmap

Reconciled 15 October 2026 around a small hosted team trial. Dates and broader administration from the original January roadmap are historical context, not delivery commitments.

| Priority | Milestone | Current disposition |
| --- | --- | --- |
| Delivered | [M01 — accepted local authoring and guide baseline](../.scratch/position-focus-guide/milestone.md) | Complete against revised scope; live Google/newcomer checks transferred, not passed. |
| Next | [M06 — run a secure hosted team trial](../.scratch/team-trial/milestone.md) | Specification complete; implementation tickets prepared. Approved emails, member privacy, lead browsing, confirmation locks, Railway stage/prod, QA and promotion. |
| Deferred next | [M04 — later review cycles](../.scratch/position-focus-review/milestone.md) | Plan after initial trial: lead-initiated midyear/year-end drafts, preserving confirmed history. |
| Parked | [M02 — engineer context](../.scratch/engineer-context/milestone.md) | Catch-up records await a demonstrated need; member list is included in M06. |
| Superseded | [M03 — original completion workflow](../.scratch/position-focus-submission/milestone.md) | Closed as split: authoring delivered in M01; confirmation and trial in M06; request/submission machinery not approved. |
| Deferred outcome | [M05 — first team cycle](../.scratch/first-team-cycle/milestone.md) | Scope, participants and completion date to revisit after trial; no January commitment. |

## Next implementation order

Start with [Hosted runtime, required CI and gated stage delivery](../.scratch/team-trial/issues/04-hosted-runtime.md). [Approved Google access](../.scratch/team-trial/issues/01-approved-access.md) is independently ready, with approved personal accounts allowed locally/in stage and work-domain restrictions retained in production.

After both foundations, prioritise [Railway environments, Google setup and live release gates](../.scratch/team-trial/issues/05-railway-environments.md). [Lead browsing](../.scratch/team-trial/issues/02-lead-member-focuses.md) follows approved access and can proceed alongside setup; [Confirm and lock](../.scratch/team-trial/issues/03-confirm-and-lock.md) follows lead browsing. All converge on [Stage verification](../.scratch/team-trial/issues/06-stage-verification.md), then [Manual production promotion](../.scratch/team-trial/issues/07-production-promotion.md).

Required PR/main checks precede automatic stage deployment; stage smoke/E2E and human acceptance precede manual promotion of the exact verified revision. Main merges never deploy production. See the [prioritised queue](../.scratch/team-trial/breakdown.md) for dependencies and verification. Other milestones have no implementation-ready tickets.

Backend allowlist configuration replaces a need for administrator screens. QA uses real authenticated test accounts and isolated stage data. Review later phases only after people have tried the initial workflow. The [deferred register](../.scratch/position-focus-guide/deferred.md) retains ideas without committing to implement them.

Historical ticket answers and pre-reconciliation records remain available under `.scratch/position-focus-guide/history/`. Current requirements take precedence. [Planning map](../.scratch/roadmap/map.md) · [Tracker conventions](agents/issue-tracker.md).
