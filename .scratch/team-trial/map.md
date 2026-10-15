# Hosted team trial

Labels: wayfinder:map

## Destination

A prioritised, dependency-linked plan for taking the existing application to stage and a limited hosted trial, including Google setup, enforced release checks and manual production promotion. The delivered outcome is a usable initial draft/confirm cycle for invited members and their career lead.

## Notes

- Planning only; implementation and provisioning follow the [implementation queue](breakdown.md). Readiness is not delivery evidence.
- Use wayfinder, grilling and domain-modeling for new decisions. [Tracker conventions](../../docs/agents/issue-tracker.md) define local claims and dependencies.
- The [specification](spec.md) and ticket acceptance translate agreed policy into implementation requirements. Credentials and actual approved email lists remain private.

## Current delivery decision — 16 October 2026

The immediate delivery is [hosting-only staging](issues/09-hosting-only-staging.md). Railway's existing environment is named `staging`; Lantern's application value remains `LANTERN_ENV=stage`. Deploy a known merged revision with login unavailable and protected access denied, verify hosting separately, and leave `STAGE_DELIVERY_ENABLED` unset/false. Hosting evidence does not complete authenticated smoke, ticket 05, or the team trial.

Authentication is deferred to [the bounded provider decision](issues/10-authentication-provider-decision.md). Jesus Film One is a candidate for investigation, not an approved replacement. Direct Google setup is paused and Lantern-owned passwords are not pursued. The Google-specific requirements below describe the existing implementation and original acceptance baseline; any replacement requires a recorded policy decision and revised acceptance before implementation.

Production application activation remains deferred, while independent production app/database resource provisioning is explicitly authorized under [ticket 05](issues/05-railway-environments.md). Manual promotion needs a deliberate authorized operator action, not a second reviewer. [Promotion simplification](issues/11-simplify-manual-promotion.md) records the proposed latest-main selection and exact-revision evidence checks; it is not implemented by this planning update.

## Decisions so far

- One Engineering team and one career lead; reuse existing ownership/department boundaries without expanding department management.
- Career lead reads current members' focuses, including drafts, and confirms after discussion; members alone author their drafts.
- Jaco confirmed exact Google emails are pre-approved directly in the production database. QA approvals live separately in stage. No email lists in source control, role selectors, invitations or approval UI.
- Jaco confirmed the career lead performs confirmation/locking. No member-submission state or unlock in this milestone.
- Use confirmed focuses as immutable baselines. Later phase copies/versioning belong to M04.
- Railway stage/prod are independent runtime/data environments. Promote the exact tested revision, with production autodeploy disabled.
- [Agree hosted-trial priority, admission policy and release gates](issues/08-agree-delivery-priority.md) — runtime/CI first; explicit local/stage personal-account eligibility; checked automatic stage delivery and same-revision manual production promotion.

## Implementation choices

The spec fixes conservative defaults so tickets are buildable: current active member roster only; no historical-member browsing UI; one normal objective with at least one goal required for confirmation; no automatic judgement of SMART quality. Optional objectives remain optional. These choices can be revised before implementation if trial feedback warrants it.

## Not yet specified

The deferred authentication provider and production admission decision blocks authenticated setup and acceptance, but not hosting-only staging. Platform configuration details remain implementation/setup work: validate current provider capabilities and record the concrete commands, required check names, repository rules and revision-bound promotion mechanism in the release runbook. Surface a new decision only if implementation discovers a material trade-off that cannot satisfy the agreed policy.

## Inputs for setup, not product ambiguities

Railway project/service access, repository-rule access and GitHub deployment integration; stage/prod domains and local/stage/prod Google Web OAuth clients; actual lead/member/QA accounts; privately managed approved emails and work domains. [Configure Railway environments, Google access and live release gates](issues/05-railway-environments.md) records them outside Git before provisioning. [Research](../../docs/research/railway-team-trial.md).

## Out of scope

Later review cycles, engineer catch-up context and the first full team-cycle outcome remain deferred until trial feedback. Administration screens, multiple teams and notifications are not part of this delivery plan. Existing walkthrough data/services and prototype hosting are preserved.
