Kind: ticket
ID: team-trial/12
Title: Agree production database and operator access policy
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: None
Implementation: Not started; planning only
Slice: Hosted team trial

---
## Outcome

Define who may change production data, through which controlled mechanism, and what approval and evidence are required before granting production operational access. Documented commands alone are not access control.

## Context

The staging bootstrap used versioned schema migrations, compiled domain/email/lead operations over Railway SSH, and member assignment through the application. Additional SQL was read-only verification. The existing operator CLI consumes the application DATABASE_URL and does not record an authenticated operator audit trail. Actual provider grants must be inventoried; do not assume a particular database role is a superuser. Prior tickets permit direct database approvals without specifying a production governance boundary.

## Acceptance

- [ ] Inventory Railway workspace/project roles, SSH/console access, secret visibility, database grants/network entry points and deployment-token scope. Record sanitized effective access and who can bypass application authorization, including agents using a human's credentials.
- [ ] Decide named accountable owners and approved access paths for routine runtime, migrations, enrollment/bootstrap, support repair and emergency access. Decide whether staging uses different controls; no automatic extension of staging permission to production.
- [ ] Decide the production data-change approval policy, including whether independent approval is required and for which operations. Preserve the separate existing one-operator release-promotion decision unless explicitly changed.
- [ ] Choose short-lived/just-in-time access where supported, maximum access duration, review/revocation cadence, credential rotation and emergency-access activation/review. Record provider limitations and explicitly accepted residual risks; do not promise controls the platform cannot enforce.
- [ ] Specify protected audit storage, accountable actor identity, request/reason reference, target, operation, timestamp, affected identifiers and outcome; decide retention, access and audit-failure behavior. Avoid copying personnel document contents, secrets or session tokens into logs or Git.
- [ ] Agree the safe enrollment/change process: target verification, proposed-change preview, authorization, execution, validation and recovery. Identify which changes are versioned migrations versus controlled administrative operations; routine direct SQL must not be the default workflow.
- [ ] Publish the approved policy and threat/access model in the repository, with sensitive identity/grant inventory in protected storage. Link decisions to ticket 13 acceptance. No permissions are changed by completing the policy discussion itself.

## Boundary

Planning/decision work only until separately requested. No new administration UI is required. Do not install production credentials to discover whether the controls work.
