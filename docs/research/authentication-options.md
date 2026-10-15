# Lantern authentication options

Investigated 2026-10-16. Read-only Forge source review at commit
`d350c1289b44144de17c705624ae43a200988173`. No Auth configuration, registrations,
credentials, deployments, or user records were changed.

## Current decision — 16 October 2026

Authentication is deferred while [hosting-only staging](../../.scratch/team-trial/issues/09-hosting-only-staging.md) proceeds. Jesus Film One is a candidate for the [bounded provider/admission investigation](../../.scratch/team-trial/issues/10-authentication-provider-decision.md), not an approved replacement. The recommendations below are research proposals. Direct Google setup is paused and Lantern-owned passwords are not pursued. Production admission policy has not been replaced, and no shared workforce capability is authorized by this investigation.

## Jesus Film One (Forge)

**Recommended direction, subject to an integration proof:** reuse the existing
Jesus Film identity provider. This avoids a separate Google Cloud setup for
Lantern while retaining Google sign-in through the shared provider, if that
provider's live Google configuration admits the intended participants.

Verified in source:

- The hosted login explicitly calls itself **Jesus Film One**:
  [login UI](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/app/login/login-page-client.tsx#L291).
- It is a standalone Better Auth OAuth/OIDC authority. Its documented origin is
  `https://auth.jesusfilm.org`; source constructs issuer
  `https://auth.jesusfilm.org/api/auth`, discovery, authorization-code, token,
  user-info and JWKS endpoints with PKCE support:
  [discovery implementation](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/auth/openid-configuration.ts#L40).
- Google is an upstream provider when its credentials are configured. Okta is
  also supported, and email/password is enabled. Lantern could redirect to this
  shared login instead of owning those authentication methods:
  [provider configuration](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/auth/config.ts#L137),
  [password configuration](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/auth/config.ts#L456).
- First-party apps have separate environment registrations and exact redirect
  URIs; startup seeding upserts registrations and PKCE-enabled OAuth clients:
  [seeding](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/scripts/seed-first-party-apps.ts#L459).
  No Lantern entry was found in the app/scope catalogues.
- Forge Admin is a useful relying-client example: authorization code with PKCE,
  server-side exchange, issuer/audience signature verification and app scopes:
  [client](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/admin/src/auth/oauth-client.ts#L36).
- The production operator dashboard is intentionally unavailable. Onboarding
  should use the maintained registration/seed route and normal Forge review and
  deployment, or a supported operator workflow agreed with its owner:
  [operator restriction](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/auth/operator.ts#L20).
  Dynamic registration exists for clients such as MCP consumers; its existence
  alone does not provision Lantern's environment approval or authorization.

### Important integration boundary

The public identity claims include `email`, `email_verified`, actor type and
membership status, but **do not include Google's `hd` hosted-domain claim or an
explicit upstream authentication-provider claim**:
[claims mapping](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/auth/config.ts#L212).
A verified email or active global membership is not proof of work-domain Google
membership. Do not fabricate `hd` from an email suffix or silently weaken
Lantern's production policy. The integration needs either an authoritative
organization claim/app grant with agreed semantics or an explicitly approved
replacement access policy. Lantern must retain local department membership and
career-lead authorization, with issuer/subject identity mapping rather than
assuming a Google subject equals a Jesus Film One subject.

### What remains unverified

Read-only requests to live discovery from this environment returned HTTP 403;
web retrieval was also unavailable. This does not establish a provider outage.
The live deployed revision, discovery metadata, Google consent audience,
participant eligibility and successful real login were not verified. Source
support for Google does not prove its present production configuration.

### Smallest next step

Have the Auth owner confirm Lantern onboarding and the authoritative work-account
signal. Register separate local/stage/production clients with exact callbacks,
then prove one local authorization-code flow using a real approved work account
and approved personal QA account. Confirm verified identity claims and isolation
before replacing Lantern's Google adapter. Provision credentials privately; keep
production participant access disabled. No new Google project should be needed
for Lantern itself if this route is approved and the shared upstream already
supports the required accounts.

## Reusing an existing Google Cloud project

**Still viable; inability to create projects does not establish inability to configure OAuth.** Google defines a separate OAuth Config Editor role (`roles/oauthconfig.editor`) with client creation/update and consent configuration permissions. Viewing a project alone is not sufficient. Ask the existing project owner for appropriate OAuth configuration access, or have them create Lantern's clients. Source: [Google IAM OAuthConfig roles](https://docs.cloud.google.com/iam/docs/roles-permissions/oauthconfig).

Select the existing project in Cloud Console, then inspect Google Auth platform → Clients and Audience. Add separate Lantern local/stage/production Web clients without reusing another app's secret or editing its callback list. Reuse requires the owner's agreement and compatible project-wide branding/audience. Local/stage personal QA requires External audience; do not change an existing Internal project just to make that work. A separate QA project provisioned by an administrator may be necessary. Project creation permission and Workspace membership alone do not settle these questions. Sources: [Google consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent), [Web client setup](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred).

The reported “Jesusflow” item has not been inspected. Its resource type, ownership, consent configuration and the operator's actual permissions remain unknown. Do not conclude that it is abandoned or safe to repurpose from its appearance.

## Lantern-owned passwords

Technically possible, but the least attractive option while a shared provider exists. Database persistence is a small part of the work: use a maintained authentication implementation for salted adaptive password hashing, verified email enrollment, expiring single-use recovery tokens, email delivery, anti-enumeration behavior, login/reset throttling and session revocation. Internal use does not remove these responsibilities. Sources: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Jesus Film One already has password authentication in its source, so it may also satisfy an email/password fallback without Lantern operating another credential store. Live availability and recovery behavior still need verification.

## Recommendation and change boundary

1. First choice: prove Jesus Film One onboarding and the required identity/eligibility claims. Keep its login methods centralized and Lantern's exact-email approvals, active department membership and career-lead permissions local.
2. Lowest code-change fallback: use dedicated clients within an approved existing Google project, provided its owner grants access and the audience supports QA.
3. Last choice: Lantern-owned credentials through a maintained auth library, with explicit recovery/email operations scope.

This is research, not authorization to replace authentication. Lantern's current adapter boundary is useful, but Google-specific callback paths, runtime credentials, `google_sub` identity storage and work-domain admission must be deliberately migrated and tested. An OIDC issuer/subject pair must identify the account; do not silently link accounts only because emails match. The original production work-domain requirement cannot be met merely by renaming a claim. Agree on the authoritative shared-provider eligibility rule before implementation.

The practical next checkpoint is one registered local Lantern client and real sign-in through Jesus Film One, verifying work and personal-QA outcomes and the issued claims without logging tokens. No production enrollment or deployment is needed for this proof. Google setup can remain on hold while that is resolved.

## Follow-up decision: shared identity, Lantern-owned permissions

The operator selected Jesus Film One for further investigation and ruled out direct Google setup and Lantern-owned passwords. They have Forge repository and Railway administration access. This enables a reviewed onboarding/configuration change; it does not require a broad change to all consumers of the shared identity provider.

Forge contains authorization mechanisms beyond login: known scopes such as `admin:access` and `manager:access`, application/environment approval states, user membership states, approved grants and revocation checks. Sources: [scope catalogue](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/domain/scopes.ts), [OAuth policy](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/services/oauth-policy.service.ts), [Changelog user grants](https://github.com/JesusFilm/forge/blob/d350c1289b44144de17c705624ae43a200988173/apps/auth/src/services/changelog-oauth-grant.service.ts). Some enforcement is application-specific, so a new scope name alone does not guarantee that an equivalent Lantern policy is wired into every token lifecycle.

Recommended division: Jesus Film One validates identity and optionally a coarse per-environment Lantern access grant; Lantern remains authoritative for approved participants, department membership, career-lead role, ownership and permitted document actions. These application permissions should be resolved from Lantern's database on protected requests rather than trusted from browser input or frozen indefinitely in identity-token claims.

Google login and employee status are distinct facts. If production admission is based on an operator-maintained approved-employee list in Lantern, Jesus Film One need not supply Google's hosted-domain claim; that is an explicit replacement of the previous Google-domain admission policy. If reusable employee status is desired across apps, add a centrally managed workforce affiliation/entitlement backed by an authoritative directory, trusted workforce SSO or controlled administrator enrollment, with an offboarding/revocation lifecycle. Do not label every active Jesus Film One user as an employee or infer employment from a Google login/email suffix.

The next bounded investigation should inspect existing live registration and workforce identity configuration using read-only admin access, then propose the smallest Lantern registration and policy change. Preserve external-user access for existing apps. Verify whether a Lantern client can require Google/workforce sign-in if that is a firm requirement; standard identity claims reviewed here do not prove which upstream method was used. No provider/configuration change is performed by this research update.
