Kind: ticket
ID: team-trial/10
Title: Complete Google setup and verify real-account access
Milestone: M06
Type: research
Status: needs-info
Implementation: Dedicated local/stage/production Google clients created; local and staging work/personal real login verified; production login deferred to 07
Slice: Hosted team trial

---
## Question

Can the existing Google implementation authenticate the intended work and personal QA accounts using dedicated environment clients, while preserving exact-email approval, hosted-domain policy and department authorization?

## Agreed boundary — 16 October 2026

The operator explicitly superseded the earlier Google pause: attempt existing Google authentication first; investigate Jesus Film One only if a concrete Google blocker remains. Lantern-owned passwords remain excluded. Production client preparation was subsequently requested, but production activation and participant enrollment remain outside scope. Unattended staging delivery stays disabled.

On the Mac, current origin/main was fetched at `8e4cd805e9e5c88dea534823859191627ee8402c`. Browser inspection and successful client creation establish usable Google configuration access. The shared project already has an External audience. Existing client callbacks, consent branding and audience must be preserved; any further shared change needs its concrete impact reviewed.

See [Mac Google setup evidence](../../../docs/operations/google-mac-setup-evidence.md). The source research below remains fallback context, not authorization for provider replacement.

## Google-first acceptance

- [x] Inspect actual work-account project access, audience, branding and existing clients.
- [x] Create dedicated local and staging Web clients and retain credentials privately outside Git.
- [x] Verify Mac loopback callback against a running isolated current-main app with LOCAL_ACCESS=0.
- [x] Observe the real work-account Google chooser, basic-identity consent and return to the callback.
- [x] Complete the separately requested production client preparation; credentials saved privately, no production activation.
- [x] Verify a successful approved work-account Lantern session locally, with zero memberships/roles, after explicit local-only enrollment authorization.
- [x] Verify the selected personal-account flow on the normal runtime after explicit local-only approval; separate work/personal sessions, zero departments and memberships.
- [ ] Complete environment-specific Railway credential handoff and separately authorized staging deployment/enrollment. Do not enable STAGE_DELIVERY_ENABLED in this setup task.

## Fallback investigation only if Google is blocked

- [ ] Confirm live issuer/discovery, supported client onboarding, exact callbacks, environment separation and available login methods. Source capability alone is insufficient; explain prior discovery 403 rather than assuming an outage.
- [ ] Prepare one local client proof with authorization code/PKCE, server-side validation and a real work account plus personal QA account. Obtain identities and secrets privately. If registration or operator interaction is needed, identify the narrow change and obtain the necessary input before proceeding.
- [ ] Verify issuer/subject identity, verified-email semantics, account eligibility, revocation behavior and any authoritative workforce/app-access claims. Google login or an email suffix alone does not establish employment. Do not fabricate Google's hosted-domain claim.
- [ ] Decide explicitly whether production admission retains an authoritative workforce signal or adopts an operator-maintained approved-employee policy. Lantern remains authoritative for approval, active department membership, career-lead permissions and document ownership on every protected request. Neither a shared login nor an approval grants a lead role.
- [ ] Record recommendation, evidence limitations, shared-service changes/risks and operator decision. If accepted, create a separately scoped implementation ticket addressing issuer/subject storage, deliberate identity migration, configuration and callback changes, revocation and environment-policy tests; revise 05/06/07 and spec consistently before implementation.

## Completion

A recorded provider/admission decision and implementation scope, or a documented blocker and next decision. This ticket does not replace Lantern authentication, enable unattended delivery, provision production participants or complete the team trial.

## Sources

[Source investigation and unresolved live checks](../../../docs/research/authentication-options.md) · [Current spec](../spec.md) · [Environment setup](05-railway-environments.md)

## Production-readiness reconciliation — 16 October 2026

Google is the working selected provider. Staging login and enrollment are recorded in [activation evidence](../../../docs/operations/staging-activation-evidence.md). Remaining setup and production verification are owned by 05/07; this record is not an independent blocker requiring provider replacement. No production activation is authorized.
