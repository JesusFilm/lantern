Kind: milestone
ID: M06
Title: Run a secure hosted team trial
Status: Specification
Slice: Hosted team trial
Sequence: 2
Target: Next; no committed date
Summary: Invited members draft private focuses, the career lead reads and confirms them, and the verified app is promoted from Railway stage to production.

---
## Current delivery decision — 16 October 2026

The immediate delivery is [hosting-only staging](issues/09-hosting-only-staging.md). Railway's existing environment is named `staging`; Lantern's application value remains `LANTERN_ENV=stage`. Deploy a known merged revision with login unavailable and protected access denied, verify hosting separately, and leave `STAGE_DELIVERY_ENABLED` unset/false. Hosting evidence does not complete authenticated smoke, ticket 05, or the team trial.

Authentication is deferred to [the bounded provider decision](issues/10-authentication-provider-decision.md). Jesus Film One is a candidate for investigation, not an approved replacement. Direct Google setup is paused and Lantern-owned passwords are not pursued. The Google-specific requirements below describe the existing implementation and original acceptance baseline; any replacement requires a recorded policy decision and revised acceptance before implementation.

Production remains inactive. Manual promotion needs a deliberate authorized operator action, not a second reviewer. [Promotion simplification](issues/11-simplify-manual-promotion.md) records the proposed latest-main selection and exact-revision evidence checks; it is not implemented by this planning update.

## Outcome

A small invited group can use Lantern outside the local walkthrough, with confidence about who can see or change each focus. Learn from the initial draft/confirm cycle before building later review phases.

## Done when

- [ ] Database-approved Google accounts sign in under environment policy: production requires approved work domains; local development/stage also accept approved personal accounts; unapproved people and removed memberships cannot access protected data.
- [ ] Members manage only their own drafts; the career lead can browse the team and drill into member focuses.
- [ ] Lead confirmation persists an immutable baseline with actor/time and handles stale or concurrent changes safely.
- [ ] Railway stage and production use separate data/secrets and normal authentication; real Google setup is verified locally and in hosted environments. Jaco can use separate lead/personal-member sessions in stage and QA can join.
- [ ] Required PR/main CI gates automatic same-revision stage deployment and post-deployment smoke/E2E checks. Production autodeploy is off and promotion is explicitly manual.
- [ ] Stage practical verification is recorded, including two-member isolation and newcomer use.
- [ ] The verified revision is promoted to production, backed by recovery evidence and a release record.

## Boundaries

Planning and ticket preparation are complete; none of these new behaviors is claimed delivered. Backend setup is sufficient. Admin screens, multiple departments, submission queues and subsequent phase revisions are excluded. [Specification](spec.md) · [Breakdown](breakdown.md) · [Planning map](map.md).
