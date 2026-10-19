Kind: milestone
ID: M06
Title: Run a secure hosted team trial
Status: Delivery
Slice: Hosted team trial
Sequence: 2
Target: Next; no committed date
Summary: Invited members draft private focuses, the career lead reads and confirms them, and the verified app is promoted from Railway stage to production.

---
## Current decision — 19 October 2026

Jaco approved the [simplified manual trial plan](breakdown.md). Staging schema 3
and role separation are reported complete; PR #12 is open with passing CI.
Production remains inactive, automatic delivery off, and two-member acceptance
parked and unpassed. IaC and release automation are deferred, not launch gates.

## Outcome

A small invited group can use Lantern outside the local walkthrough, with confidence about who can see or change each focus. Learn from the initial draft/confirm cycle before building later review phases.

## Done when

- [ ] Production operator/database access policy is approved and enforced, with scoped privileges, restricted interactive access and protected audit evidence (12/13); effective deployment configuration is reproducible (14).

- [ ] Database-approved Google accounts sign in under environment policy: production requires approved work domains; local development/stage also accept approved personal accounts; unapproved people and removed memberships cannot access protected data.
- [ ] Members manage only their own drafts; the career lead can browse the team and drill into member focuses.
- [ ] Lead confirmation persists an immutable baseline with actor/time and handles stale or concurrent changes safely.
- [ ] Railway stage and production use separate data/secrets and normal authentication; real Google setup is verified locally and in hosted environments. Jaco can use separate lead/personal-member sessions in stage and QA can join.
- [ ] Required PR/main CI passes for the selected revision; manual stage acceptance is recorded for that revision. Production autodeploy is off and release is human-run.
- [ ] Stage practical verification is recorded, including two-member isolation and newcomer use.
- [ ] The verified revision is promoted to production, backed by recovery evidence and a release record.

## Boundaries

Runtime, approved access and lead reading are merged, with bounded authenticated stage proof. Confirmation, governance, automation/recovery verification and production acceptance are incomplete. The current changes are planning only. Backend setup is sufficient. Admin screens, multiple departments, submission queues and subsequent phase revisions are excluded. [Specification](spec.md) · [Breakdown](breakdown.md) · [Planning map](map.md).
