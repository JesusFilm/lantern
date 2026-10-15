Kind: ticket
ID: team-trial/10
Title: Prove shared login feasibility and decide Lantern admission policy
Milestone: M06
Type: research
Status: needs-info
Implementation: Deferred; source research exists, live integration unverified
Slice: Hosted team trial

---
## Question

Can Jesus Film One authenticate Lantern's intended work and personal QA accounts with a trustworthy stable identity, while Lantern owns its participant approvals and department/document permissions?

## Agreed boundary — 16 October 2026

Jesus Film One is the preferred investigation candidate, not an accepted implementation decision. The user wants to reassess before implementation. Direct Google Cloud setup is paused; self-managed Lantern passwords are not pursued. Hosting-only staging in [09](09-hosting-only-staging.md) proceeds independently.

The operator has Forge repository and Railway administration access. Begin with read-only inspection of live configuration and registration procedure. Propose any shared-service mutation with its concrete impact before making it; preserve existing external-user consumers. Creating a broad employee directory or shared workforce entitlement service is outside this ticket.

## Bounded evidence and decision

- [ ] Confirm live issuer/discovery, supported client onboarding, exact callbacks, environment separation and available login methods. Source capability alone is insufficient; explain prior discovery 403 rather than assuming an outage.
- [ ] Prepare one local client proof with authorization code/PKCE, server-side validation and a real work account plus personal QA account. Obtain identities and secrets privately. If registration or operator interaction is needed, identify the narrow change and obtain the necessary input before proceeding.
- [ ] Verify issuer/subject identity, verified-email semantics, account eligibility, revocation behavior and any authoritative workforce/app-access claims. Google login or an email suffix alone does not establish employment. Do not fabricate Google's hosted-domain claim.
- [ ] Decide explicitly whether production admission retains an authoritative workforce signal or adopts an operator-maintained approved-employee policy. Lantern remains authoritative for approval, active department membership, career-lead permissions and document ownership on every protected request. Neither a shared login nor an approval grants a lead role.
- [ ] Record recommendation, evidence limitations, shared-service changes/risks and operator decision. If accepted, create a separately scoped implementation ticket addressing issuer/subject storage, deliberate identity migration, configuration and callback changes, revocation and environment-policy tests; revise 05/06/07 and spec consistently before implementation.

## Completion

A recorded provider/admission decision and implementation scope, or a documented blocker and next decision. This ticket does not replace Lantern authentication, enable unattended delivery, provision production participants or complete the team trial.

## Sources

[Source investigation and unresolved live checks](../../../docs/research/authentication-options.md) · [Current spec](../spec.md) · [Environment setup](05-railway-environments.md)
