Kind: milestone
ID: M06
Title: Run a secure hosted team trial
Status: Delivery
Slice: Hosted team trial
Sequence: 2
Target: Next; no committed date
Summary: Invited members draft private focuses, the career lead reads and confirms them, and the verified app is promoted from Railway stage to production.

---
## Current delivery decision — 16 October 2026

Authenticated staging is live on checked main revision `8e4cd805e9e5c88dea534823859191627ee8402c`, with schema version 2. Real Google work/personal login, member draft save/reload and career-lead read-only access have been observed. [Activation and workflow evidence](../../docs/operations/staging-activation-evidence.md) records this bounded manual proof; it is not full stage acceptance or automated release evidence. Google setup resumed successfully; the earlier hosting-only/provider-pause route is historical.

Production remains inactive and `STAGE_DELIVERY_ENABLED` remains unset/false. This reconciliation authorizes planning only: no code implementation, credentials, permissions, infrastructure, workflow runs or delivery activation. Future execution requires a separate instruction; ticket readiness alone does not grant it.

The existing `ci.yml` stage job and `promote.yml` manual promotion workflow are merged. Stage automation lacks its token and two ordinary-member session secrets; no passing stage artifact exists. Ticket 11 is optional promotion-UI simplification, not a prerequisite for the existing explicit SHA/run workflow. Confirm-and-lock (03), full acceptance, recovery and production access governance remain required. A narrower draft-only production pilot would require an explicit scope change.

Manual release promotion still requires one authorized operator, not a separate reviewer. Production **data-change** approval and emergency-access policy are unresolved in ticket 12; do not infer them from that release-promotion decision.

## Outcome

A small invited group can use Lantern outside the local walkthrough, with confidence about who can see or change each focus. Learn from the initial draft/confirm cycle before building later review phases.

## Done when

- [ ] Production operator/database access policy is approved and enforced, with scoped privileges, restricted interactive access and protected audit evidence (12/13); effective deployment configuration is reproducible (14).

- [ ] Database-approved Google accounts sign in under environment policy: production requires approved work domains; local development/stage also accept approved personal accounts; unapproved people and removed memberships cannot access protected data.
- [ ] Members manage only their own drafts; the career lead can browse the team and drill into member focuses.
- [ ] Lead confirmation persists an immutable baseline with actor/time and handles stale or concurrent changes safely.
- [ ] Railway stage and production use separate data/secrets and normal authentication; real Google setup is verified locally and in hosted environments. Jaco can use separate lead/personal-member sessions in stage and QA can join.
- [ ] Required PR/main CI gates automatic same-revision stage deployment and post-deployment smoke/E2E checks. Production autodeploy is off and promotion is explicitly manual.
- [ ] Stage practical verification is recorded, including two-member isolation and newcomer use.
- [ ] The verified revision is promoted to production, backed by recovery evidence and a release record.

## Boundaries

Runtime, approved access and lead reading are merged, with bounded authenticated stage proof. Confirmation, governance, automation/recovery verification and production acceptance are incomplete. The current changes are planning only. Backend setup is sufficient. Admin screens, multiple departments, submission queues and subsequent phase revisions are excluded. [Specification](spec.md) · [Breakdown](breakdown.md) · [Planning map](map.md).
