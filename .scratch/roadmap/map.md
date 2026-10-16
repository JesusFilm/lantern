# Lantern delivery roadmap

Labels: wayfinder:map

## Destination

Run a small, secure hosted trial with members and the career lead; learn from real use before expanding the product.

## Notes

- [Current PRD](../../docs/PRD.md), [roadmap](../../docs/ROADMAP.md), [M06 specification](../team-trial/spec.md), [implementation queue](../team-trial/breakdown.md).
- [Tracker conventions](../../docs/agents/issue-tracker.md); live board reads these Markdown records without regeneration.

## Decisions so far

- 15 October 2026: accepted Refine 4 authoring and concise guides form the delivered baseline. Preserve the prototype journey separately.
- One team, one career lead, member-owned drafts and private focuses; lead can inspect member focuses and confirm after discussion.
- Jaco chose career-lead confirmation and exact Google email preapproval; production data changes must now follow the governance decision and enforcement tickets 12/13. Stage has its own QA allowlist. No admin UI.
- M06 is next: access, lead reads, initial lock, Railway stage/prod, QA and controlled promotion. It carries all remaining relevant Google/newcomer verification from M01.
- [Agree hosted-trial priority, admission policy and release gates](../team-trial/issues/08-agree-delivery-priority.md) — prioritise runtime/CI, permit approved personal QA accounts locally/in stage, and gate automatic stage delivery before manual production promotion.
- Later reviews, catch-up records and administration are deferred candidates. Original January date and five-milestone ordering no longer drive implementation.
- This task reconciles plans and merges reviewed existing work; it does not build M06.

## Outstanding inputs

Railway account/project and repository access, environment domains, Google OAuth setup, real lead/member/QA accounts and private approvals are required for the operator setup ticket, not for the first implementation tickets. Keep all secrets/personnel data outside Git. Later review mechanics need a separate decision.

## Production-readiness reconciliation — 16 October 2026

Authenticated stage member-save and lead-read proof exists; full acceptance does not. [Current dependency queue](../team-trial/breakdown.md) adds access policy/enforcement, reproducible deployment configuration, automated release-gate proof and backup/recovery readiness before stage acceptance and production promotion. The existing promotion workflow is merged; simplification is optional. This update is planning only, with production inactive and automatic stage delivery disabled.
