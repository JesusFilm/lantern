Kind: ticket
ID: team-trial/11
Title: Simplify manual promotion while preserving revision-bound evidence
Milestone: M06
Type: task
Status: needs-triage
Implementation: Proposed; not implemented or required for hosting-only staging
Slice: Hosted team trial

---
## Proposal

Replace the current manual commit/CI-run inputs with a deliberate Run workflow action that captures the latest `main` SHA at dispatch, looks up successful matching CI and authenticated stage evidence, and promotes exactly that SHA. Record this proposal for later approval and implementation; the present hosting-only request does not implement it.

## Constraints for implementation

- An authorized deployer deliberately starts promotion. No separate second reviewer is required; production autodeploy stays disabled.
- Resolve and pin one `main` SHA when dispatch begins. Later merges cannot change that run's target. Never silently fall back to an older passing revision.
- Require successful same-revision main CI and authenticated stage deployment/readiness/smoke evidence, plus the release acceptance requirements of [07](07-production-promotion.md). Missing, pending, failed, cancelled or mismatched evidence rejects promotion with an actionable explanation.
- Hosting-only checks from [09](09-hosting-only-staging.md) cannot qualify a revision for production.
- Validate evidence lookup and race/failure paths before granting production credentials. Preparing this workflow is separate from activating production.

## Completion after approval

Reviewed workflow change and documented gate evidence, with no production promotion performed as part of implementation. Until then, the existing explicit revision/run workflow remains the implemented path.
