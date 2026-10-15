Kind: ticket
ID: team-trial/01
Title: Restrict Google access to database-approved emails
Milestone: M06
Type: task
Status: ready-for-agent
Blocked by: None
Implementation: Not started
Slice: Hosted team trial

---
## Outcome

Only people whose exact Google email is pre-approved directly in the environment database can sign in. Local development and stage admit approved personal Google accounts; production additionally requires an approved work hosted domain. This strengthens the existing domain-plus-membership path without building administration screens.

## Acceptance

- [ ] Persist normalized unique approved emails; ship a migration and parameterized operator add/remove/list procedure. No real approvals or credentials in Git.
- [ ] Check verified Google identity and exact email approval before account/session creation. Production requires an approved hosted domain and denies personal accounts even when email-approved. Local development/stage permit explicitly approved personal accounts without a hosted-domain claim; work accounts retain domain checks. Unapproved users are refused everywhere with safe feedback.
- [ ] Resolve environment policy only from explicit server configuration, separately from NODE_ENV; stage and production both run NODE_ENV=production. Missing/invalid configuration must not enable the personal-account exception. No request field can choose the environment or admission policy.
- [ ] Apply environment admission policy consistently in Google verification, account storage, member assignment and existing-session checks; remove any unconditional hosted-domain assumption that would break approved personal QA accounts. Recheck approval for existing sessions; revoked approval denies subsequent requests. Domain and membership revocation keep their existing protections. Preserve accounts/documents and do not auto-restore former memberships.
- [ ] Document/bootstrap the single lead and approved member assignment without a circular dependency or client role input. Empty hosted allowlist fails closed; local walkthrough remains explicitly opt-in and non-production.
- [ ] Browser/HTTP real-PostgreSQL TDD covers approved/unapproved work and personal login across local/stage/production, missing hosted-domain claims, production rejection of an approved personal account, invalid environment configuration, case normalization, fake role/owner/environment fields, revocation with an active session, sign-out/expiry, persistence and database/provider failure. Preserve existing Google verification and registration regressions, updating only policy-changed expectations.

## Boundaries and seams

Extend server identity/membership storage and the existing external provider contract. No Railway credentials required to implement; use synthetic identities. Live setup belongs to 05/06. Production work-domain eligibility is necessary but no longer sufficient for registration; local/stage personal-account approval is an explicitly scoped exception. [Specification](../spec.md#identity-and-approved-participants).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
