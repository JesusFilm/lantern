# Google authentication setup from the Mac

Observed 16 October 2026, Pacific/Auckland. Source: fetched `origin/main` at `8e4cd805e9e5c88dea534823859191627ee8402c` (PR #6 merged). Dedicated Mac worktree `projects/work/lantern-google-setup`, branch `codex/mac-google-setup`; the older primary checkout, its configuration and existing data were preserved. This record supersedes the earlier pause on direct Google setup. Application code is unchanged.

## Google access and configuration

The signed-in work account could inspect and successfully create OAuth clients in `jesus-film-development-bedd3`, under `cru.org`. Successful creation establishes usable client-creation permission; the complete IAM role set and project-creation permission were not audited. The organization picker listed three accessible projects: jesus-film-development, Gemini API and WTR Personas. No resource named Jesusflow appeared in that inventory; its identity/ownership remains unestablished.

The existing project's audience is **External**, publishing status **In production**. Existing clients were Forge and a Google-service-created Web client; neither was edited. Shared consent branding is the generic `project-1203272253`, with branding verification incomplete. The basic identity consent screen actually used that generic name. This project is not a dedicated Lantern-branded consent application. No audience, publishing-status, branding, support contact, scope or existing client callback was changed manually. Owner-level approval for independently branded production consent remains a future decision, not a completed verification.

The operator approved dedicated clients in this project and subsequently explicitly approved production credential creation. Google's creation form warned that callback domains would be added to shared authorized domains. Read-back of Branding after all three creations still displayed only the pre-existing Firebase authorized-domain entry; no Railway domain was displayed. Exact registered callbacks below were nevertheless accepted and verified in downloaded client configuration. Do not infer verified domain ownership from successful client creation.

| Dedicated Web client | Only authorized redirect URI | Outcome |
| --- | --- | --- |
| Lantern local | `http://127.0.0.1:4491/auth/google/callback` | Created; configured on isolated Mac app |
| Lantern stage | `https://lantern-staging.up.railway.app/auth/google/callback` | Created; private configuration bundle prepared |
| Lantern production | `https://lantern-production-0bd8.up.railway.app/auth/google/callback` | Created; private configuration bundle prepared; no activation |

All three IDs and secrets were privately verified distinct. No JavaScript origins were added. Local/stage share the project and consent configuration while retaining separate credentials/callbacks. Production also shares that consent configuration; Lantern's production hosted-domain and exact-email admission policy is unchanged. No broad Google APIs or scopes were requested: the existing adapter requests only `openid email profile`, with authorization code and S256 PKCE.

Credentials were downloaded through Google Console, moved out of Downloads, and stored mode 0600 under the operator's mode-0700 private configuration directory outside Git. Local runtime configuration and stage/production Google configuration bundles are private. No secrets or participant identities are included in this evidence. During this local proof, Railway variables were not changed and no deployment was performed. The separately authorized staging activation is recorded in [staging evidence](staging-activation-evidence.md); automatic delivery remains disabled.

## Local proof and boundaries

Port 4491 was checked free on the Mac and then bound by the current-main app at 127.0.0.1. This is a direct Mac process, not a VM tunnel or an assumed VM port. A fresh random PostgreSQL schema isolates the proof from the existing local application schema. Both migrations are applied. `LANTERN_ENV=local`, `LOCAL_ACCESS=0`, hosting-only off; the built application serves its normal compiled frontend and real Google adapter.

- `npm ci` and `npm run build` succeeded. The application homepage returned HTTP 200; an anonymous department request returned 401.
- `/auth/google` returned a real Google authorization redirect with the exact Mac callback, basic identity scopes and S256 PKCE. OAuth state, code, tokens and cookies were not logged.
- A real work account reached Google's chooser and consent screen; Google requested only name/profile picture and email, using the existing generic project branding. The browser returned to Lantern. With no local approvals, Lantern displayed its generic sign-in failure and created no user or session. That first generic response alone did not establish the failure's cause.
- With the operator's explicit local-only enrollment authorization, a private observation wrapper delegated unchanged to the real Google adapter and retained only the verified email/hosted-domain pair outside Git. It did not bypass token validation, alter admission, mint sessions or retain tokens. The actual validated hosted-domain claim, not an email suffix, was passed to the supported `domains` operator; the exact verified email was passed to `approve-email`, only in the isolated schema.
- Retrying on the unmodified compiled application entrypoint succeeded. The browser displayed **Your account is ready** with the instruction to contact a career lead; database counts were one user, one session and zero memberships. Real Google work authentication is verified locally. No department or lead authority was assigned.
- The operator completed personal Google sign-in privately in a normal personal Chrome profile. The same real adapter validated this identity with no hosted-domain claim. After explicit local-only approval using `approve-email`, a retry on the unmodified compiled entrypoint succeeded and displayed **Your account is ready**. The database confirmed one work user, one personal user, sessions for both distinct users, zero memberships and zero departments. Reloading the separate work-profile tab after process restarts preserved its signed-in waiting state. No hosted enrollment is authorized by these local exceptions.
- The private observation wrapper was stopped after claim inspection. The running proof uses the normal compiled entrypoint and real Google adapter. Live cancellation, sign-out, expiry and revocation checks were not performed in this bounded proof; staging must still record its own acceptance.

At the end of the local-only proof, no hosted real login was verified and both reserved hosted roots returned HTTP 404. The later [staging activation](staging-activation-evidence.md) supersedes this staging status. Live read-only Railway overview inspection also showed Postgres Online and the lantern service offline in both staging and production, with their distinct recorded volumes. Deployment history and variable values were not re-audited; other resource configuration remains the prior provisioning evidence. No production authentication request or activation was attempted.

## Original staging handoff (subsequently authorized)

1. Apply the private **stage** Google credentials to the existing staging app, preserving its environment-local database and exact APP_ORIGIN. Change `LANTERN_HOSTING_ONLY` to `0` atomically with adding both credentials: hosting-only mode rejects configured Google credentials. Keep `LANTERN_ENV=stage`, `NODE_ENV=production` and `LOCAL_ACCESS=0`.
2. Separately authorize and deploy a reviewed merged SHA with successful same-SHA main CI using the documented bootstrap path. Verify migrations, readiness and revision. Keep `STAGE_DELIVERY_ENABLED` unset/false throughout this task; the local proof is not release evidence.
3. Privately confirm the real work hosted-domain allowlist and exact lead/member emails. Approve the lead, have them sign in, then bootstrap the registered lead/department with the supported operator. Approve the member, have them sign in, and have the lead add that registered account through Department users. Approval alone grants no role or department access.
4. Record both real staging outcomes and required denial/cancellation/sign-out checks. A second ordinary member and authenticated smoke are still required for subsequent isolation/release acceptance.

The production bundle is prepared only. Keep production inactive and its participant store untouched; use its separate client when later production activation is authorized. Revisit consent branding with the project owner before presenting it as independently branded Lantern production consent.

## Provider decision

Google setup is not blocked: existing-project access and dedicated client creation succeeded, and real work-account login succeeded locally. Jesus Film One fallback inspection was therefore not invoked. Retained Forge source research remains fallback context only; no provider replacement, identity migration, fabricated hosted-domain claim or relaxation of production policy is authorized.
