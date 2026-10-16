Kind: ticket
ID: team-trial/13
Title: Enforce and audit production administrative access
Milestone: M06
Type: task
Status: needs-info
Blocked by: 12
Implementation: Not started; planning only
Slice: Hosted team trial

---
## Outcome

Implement and verify the approved policy from 12 before production credentials, enrollment or activation. Policy choices must be resolved before selecting the implementation; this ticket is not yet AFK-ready.

## Acceptance

- [ ] Separate runtime, migration and administrative database privileges/credentials. Normal runtime must not have schema-change or unrestricted administrative grants; migrations and enrollment use separately scoped execution paths. Explicitly assess remaining application-data exposure if a runtime shell is compromised.
- [ ] Restrict production Railway SSH/console, secret retrieval and direct database access according to 12. Verify effective grants and denied paths, not just intended settings. Scope CI credentials to their required environment/actions; do not grant interactive administration as a convenience.
- [ ] Provide repository-owned, parameterized administrative operations with explicit environment/project/database identity checks, reviewed proposed change and the chosen approval mechanism. Authenticate the accountable operator; a free-text actor argument is not proof of identity. Generic DATABASE_URL possession alone must not be the intended administrative authorization model.
- [ ] Implement protected durable audit events for privileged attempts and results according to 12, including actor, reason/request, target and affected identifier, without secrets or personnel content. Test the selected audit-failure behavior and access restrictions on audit records.
- [ ] Test allowed operations and negative cases in isolated PostgreSQL/staging: wrong target, missing/expired privilege, unapproved operation, forbidden DDL/admin action under runtime credentials, revoked access and attempted bypass of the approved path.
- [ ] Rehearse emergency access, expiry/revocation and post-action review. Record residual provider-admin powers honestly; application controls cannot constrain an unrestricted platform/database owner.
- [ ] Update operator/runbook documentation with safe commands, verification and recovery. Keep credentials, actual email lists and detailed sensitive audit records outside Git. Merge reviewed implementation/evidence before marking complete.

## Boundary

A future authorized implementation ticket. No production mutations are authorized by this plan; non-mutating production access inspection and target configuration require explicit execution scope. Preserve existing records and use TDD for application changes.
