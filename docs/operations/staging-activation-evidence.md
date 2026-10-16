# Staging activation evidence

Observed 16 October 2026. The operator authorized installing staging Google credentials, disabling hosting-only mode, deploying a checked revision, and enrolling the previously verified work lead and personal member in **Engineering**. Production activation and automatic staging delivery were explicitly excluded. No application source was changed.

## Revision and deployment

- Clean detached release checkout: `8e4cd805e9e5c88dea534823859191627ee8402c` from `origin/main`.
- [Main CI run 38813688623](https://github.com/JesusFilm/lantern/actions/runs/38813688623): typecheck, PostgreSQL HTTP/browser tests and production build succeeded for this exact revision. Stage delivery/smoke was skipped. Existing release-gate functions verified the run and three checks before upload; the release stamp contains this SHA.
- Existing Railway project `9a445065-bde0-4184-bdb8-4161b033cc8f`, staging environment `8e19675b-08a2-4bfb-9762-fd6d8561fcfd`, application service `0cdc4637-a8e4-4d4f-b860-f2e1578cae53`.
- The private stage client was installed without exposing credentials. Read-back matched the private bundle. Existing database reference and origin were preserved. `LANTERN_ENV=stage`, `NODE_ENV=production`, `LOCAL_ACCESS=0`, `LANTERN_HOSTING_ONLY=0`.
- The release script with pinned Railway CLI 5.68.0 uploaded the checked source, but initial deployment `c4386ca0-3dfa-44bf-8080-f0410d748c05` crashed with missing schema. Its effective pre-deploy command and healthcheck were null. The script failed and produced no successful terminal receipt; this is not recorded as a passing automatic release.
- Railway's live dashboard reported that new services cannot opt into deprecated Config as Code after 28 August 2026. The checked-in `railway.json` did not supply effective deployment settings. The staging-only dashboard changes were reviewed and applied: migrator `node dist/server/migrate.js`, start command `node dist/server/index.js`, `/health`, 120-second health timeout, 3 ON_FAILURE retries. No source integration was connected.
- Applying those settings redeployed the same uploaded revision/image as `b6ee8a32-c220-4589-aa2a-2e5b251bdc61`, with successful status. Image digest remained `sha256:f50fe77087ad4edce3cdd21490404a3e779ca7cfeae19e92af5c97b1dfe08770`. This recovery was a dashboard redeploy, not a successful CLI terminal receipt or automated smoke run.

## Database and public readiness

Deployment logs reported **Migrations complete.** Effective deployment metadata includes the intended migrator and healthcheck. A read-only query through the staging application's Railway SSH connection confirmed two migration ledger rows and initially empty users, departments, memberships, allowed domains and approved emails. No local database or production schema was used for this check.

[Staging health](https://lantern-staging.up.railway.app/health) returned HTTP 200 and `{"status":"ok","database":"ok"}`. Headers identified the exact checked SHA, deployment `b6ee8a32-c220-4589-aa2a-2e5b251bdc61`, and schema version **2**. Root returned 200; anonymous `/api/session` reported null user, sign-in available and local access false. Anonymous `/api/focuses` and `/api/department` returned 401.

## Enrollment

The operator confirmed the same privately verified work/personal identities and department Engineering. Supported compiled operations configured the actual Google-verified work hosted domain and approved both exact emails on staging only. Real Google work login reached the unassigned-account page before the supported `setup` operation granted the registered lead Engineering access. The lead then saw Department users. The operator completed real personal Google login in their own Chrome profile; that registered account was selected through the lead's Department users interface and added as an ordinary member. Read-only database verification confirmed exactly one matching lead and member, their respective career-lead/member roles in Engineering, the expected hosted-domain presence/absence, and a live session for each. The UI reported “User added to the department.” No sessions or identities were fabricated, and no direct membership SQL write was used.

## Boundaries and remaining acceptance

Production variables exactly matched the private baseline and its application deployment list remained empty. Its credentials were not installed and its schema was not migrated. The repository `STAGE_DELIVERY_ENABLED` variable remained unset. No GitHub deployment/session secrets or tokens were created; no unattended delivery was enabled.

This is a manual bootstrap of one lead and one ordinary member. Full automated smoke requires two distinct ordinary members, so it has not run and no passing smoke/promotion artifact is claimed. Cancellation/sign-out/revocation checks, two-member data isolation, live release failure drills, backup/restore rehearsal and production acceptance remain outstanding. The original missing-schema crash verifies startup refusal only; it is not a deliberate pre-deploy rollback drill with a previously healthy release. Review Infrastructure as Code configuration separately before unattended delivery. Credentials, personal identities, cookies and raw logs remain outside this record and Git.

## Member save and career-lead read-through — 16 October 2026

At the operator’s request, tested the deployed application through the existing real Google sessions in separate Chrome profiles. No source, deployment, role or provider configuration changed.

- As the ordinary Engineering member, created **STAGING TEST — Member workflow — 16 Oct 2026**, period 16 October–31 December 2026. The saved focus ID is `e9165fb5-e35e-4902-96a5-84ff37b91fc8`.
- Added and saved one Normal Objective explicitly labeled synthetic staging QA, plus one SMART goal describing save/reload/lead-read verification. Each UI save completed successfully.
- Reloaded the member page: title, dates, objective and SMART goal remained present, with owner editing controls available.
- As career lead, navigated Department users → registered member → position focuses. The list showed the saved title and correct dates. Opening it displayed the same objective and SMART goal, labeled **Read-only member focus**, without edit/add/remove controls. Reloading that lead detail URL preserved the complete read-only view. The lead’s own Position focuses list remained separate.
- Left the clearly labeled synthetic document in staging for operator inspection. No confirmation/review action or mutation as lead was attempted. This is UI read-only verification, not a fresh adversarial HTTP authorization test or two-ordinary-member isolation test.
- Final health remained HTTP 200, schema 2, revision `8e4cd805e9e5c88dea534823859191627ee8402c`, deployment `b6ee8a32-c220-4589-aa2a-2e5b251bdc61`. Production variables matched their original private baseline, production application deployment count remained zero, and `STAGE_DELIVERY_ENABLED` remained unset.

The [lead read-only view](../../captures/staging-lead-readonly-focus.png) captures the saved synthetic content and excludes account identity details.
