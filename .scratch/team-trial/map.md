# Hosted team trial

Labels: wayfinder:map

## Destination

A prioritised, dependency-linked plan for taking the existing application to stage and a limited hosted trial, including Google setup, enforced release checks and manual production promotion. The delivered outcome is a usable initial draft/confirm cycle for invited members and their career lead.

## Notes

- Planning only; implementation and provisioning follow the [implementation queue](breakdown.md). Readiness is not delivery evidence.
- Use wayfinder, grilling and domain-modeling for new decisions. [Tracker conventions](../../docs/agents/issue-tracker.md) define local claims and dependencies.
- The [specification](spec.md) and ticket acceptance translate agreed policy into implementation requirements. Credentials and actual approved email lists remain private.

## Current delivery decision — 19 October 2026

Jaco approved [the simplified delivery plan](breakdown.md): manual trial releases,
with CI and revision-bound practical acceptance; IaC and automated release gates
are deferred. Staging role separation is complete. Production is inactive and
two-member acceptance parked. Follow that plan rather than older handoff steps.

## Decisions so far

- One Engineering team and one career lead; reuse existing ownership/department boundaries without expanding department management.
- Career lead reads current members' focuses, including drafts, and confirms after discussion; members alone author their drafts.
- Exact Google emails require environment-local approval; production execution now requires the policy and controls in 12/13. QA approvals live separately in stage. No email lists in source control, role selectors, invitations or approval UI.
- Jaco confirmed the career lead performs confirmation/locking. No member-submission state or unlock in this milestone.
- Use confirmed focuses as immutable baselines. Later phase copies/versioning belong to M04.
- Railway stage/prod are independent runtime/data environments. Promote the exact tested revision, with production autodeploy disabled.
- [Agree hosted-trial priority, admission policy and release gates](issues/08-agree-delivery-priority.md) — runtime/CI first; explicit local/stage personal-account eligibility; original automated delivery decision, superseded for this trial by the 19 October manual release decision.

## Implementation choices

The spec fixes conservative defaults so tickets are buildable: current active member roster only; no historical-member browsing UI; one normal objective with at least one goal required for confirmation; no automatic judgement of SMART quality. Optional objectives remain optional. These choices can be revised before implementation if trial feedback warrants it.

## Not yet specified

Google authentication works on stage. Production data-change approval, privileged access ownership, audit retention and emergency-access policy are agreed under 12; remaining enforcement belongs to 13. Platform configuration details remain implementation/setup work: validate current provider capabilities and record the concrete commands, required check names, repository rules and revision-bound promotion mechanism in the release runbook. Surface a new decision only if implementation discovers a material trade-off that cannot satisfy the agreed policy.

## Inputs for setup, not product ambiguities

Railway project/service access, repository-rule access and GitHub deployment integration; stage/prod domains and local/stage/prod Google Web OAuth clients; actual lead/member/QA accounts; privately managed approved emails and work domains. [Configure Railway environments, Google access and live release gates](issues/05-railway-environments.md) records them outside Git before provisioning. [Research](../../docs/research/railway-team-trial.md).

## Out of scope

Later review cycles, engineer catch-up context and the first full team-cycle outcome remain deferred until trial feedback. Administration screens, multiple teams and notifications are not part of this delivery plan. Existing walkthrough data/services and prototype hosting are preserved.

## Production prerequisites — 19 October 2026

Follow the [current queue](breakdown.md): bounded configuration and access checks,
confirmation/locking, manual practical acceptance, and one human-run release with
a database checkpoint. Tickets 11, 15 and 16 are deferred. Current policy in 12
and AGENTS.md remains binding; no production execution is authorized here.
