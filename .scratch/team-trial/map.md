# Hosted team trial

Labels: wayfinder:map

## Destination

A usable initial draft/confirm cycle for invited members and their career lead, verified in stage and promoted to production.

## Decisions so far

- One Engineering team and one career lead; reuse existing ownership/department boundaries without expanding department management.
- Career lead reads current members' focuses, including drafts, and confirms after discussion; members alone author their drafts.
- Jaco confirmed exact Google emails are pre-approved directly in the production database. QA approvals live separately in stage. No email lists in source control, role selectors, invitations or approval UI.
- Jaco confirmed the career lead performs confirmation/locking. No member-submission state or unlock in this milestone.
- Use confirmed focuses as immutable baselines. Later phase copies/versioning belong to M04.
- Railway stage/prod are independent runtime/data environments. Promote the exact tested revision, with production autodeploy disabled.
- Hosted runtime and approved-access implementation can proceed independently. Operator credentials are needed only for setup and live checks.

## Implementation choices

The spec fixes conservative defaults so tickets are buildable: current active member roster only; no historical-member browsing UI; one normal objective with at least one goal required for confirmation; no automatic judgement of SMART quality. Optional objectives remain optional. These choices can be revised before implementation if trial feedback warrants it.

## Inputs for setup, not product ambiguities

Railway project/service access and GitHub App repository access; stage/prod domains and Google Web OAuth clients; actual lead/member/QA accounts; privately managed approved emails and work domains. Ticket 05 records them outside Git before provisioning. [Research](../../docs/research/railway-team-trial.md).
