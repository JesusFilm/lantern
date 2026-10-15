Kind: milestone
ID: M06
Title: Run a secure hosted team trial
Status: Specification
Slice: Hosted team trial
Sequence: 2
Target: Next; no committed date
Summary: Invited members draft private focuses, the career lead reads and confirms them, and the verified app is promoted from Railway stage to production.

---
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
