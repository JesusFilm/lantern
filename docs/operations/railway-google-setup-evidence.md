# Railway and Google setup evidence

Inspected 15 October 2026. **Incomplete: provider inputs and resource/live verification remain outstanding.** GitHub visibility/protections were subsequently configured as recorded below. This record does not accept the team workflow or authorize production promotion.

## Revision and preserved resources

- Fetched `origin/main`: `92a18ff2de72e9ba95cc6d30d803f859e6aacecf` (merged approved access and hosted runtime).
- Setup branch: `codex/railway-google-setup`, separate worktree `/home/jacobuntu/Ops/worktrees/lantern-railway-google-setup`.
- Primary checkout remained at `ef74bcbb9172094b694132838bd1ab71dc9129bd`. No local database, running app or prototype hosting was changed. No parallel feature branch was used.
- **Stage revision tested: none.** No stage deployment or live Google login occurred. A later main merge requires new CI, deployment and smoke evidence.

## Live read-only inventory

Railway CLI `@railway/cli@5.68.0` successfully listed projects and inspected the existing Lantern project. Reuse these resources; do not create a second project:

| Resource | Observed value |
| --- | --- |
| Workspace | Jesus Film Project, `6c6be4fe-43f0-4651-b491-16c83fa2afba` |
| Project | `lantern`, `9a445065-bde0-4184-bdb8-4161b033cc8f` |
| Stage environment | Existing name `staging`, ID `8e19675b-08a2-4bfb-9762-fd6d8561fcfd` |
| Production environment | `production`, ID `873bb786-1c7b-407f-91aa-c79d7a5e97f7` |
| Services | Zero; app/PostgreSQL resources, domains, volumes and deployment configuration remain unprovisioned |

The Railway environment name `staging` does **not** change the application contract: its app must set `LANTERN_ENV=stage`. GitHub's environment remains named `stage`, with `RAILWAY_ENVIRONMENT` set to the existing Railway ID.

GitHub API observations for private repository `JesusFilm/lantern`:

- Current credentials have repository admin permission.
- Repository Actions variable list is empty: `STAGE_DELIVERY_ENABLED` remains **unset**, so delivery is disabled.
- Repository secret list, deployment-environment list and repository webhook list are empty. An empty webhook list alone does not prove absence of GitHub App integrations.
- Both rulesets and main branch-protection APIs returned HTTP 403 with the provider's upgrade/public-repository message. Required PR checks cannot currently be configured/verified through these APIs. Repository visibility was not changed.
- [Main CI run 38676966420](https://github.com/JesusFilm/lantern/actions/runs/38676966420) completed successfully on exactly `92a18ff2de72e9ba95cc6d30d803f859e6aacecf`: `typecheck`, `PostgreSQL HTTP and browser tests`, and `production build` passed. `stage delivery and smoke` was skipped. The run has **no artifacts** and is not promotion evidence.
- No live failed-check, migration/readiness-failure, failed-smoke or production-review drill has been performed.

The primary local `.env` was inspected for key names only: database and host/port configuration exists, but no Google client, explicit environment identity or participant inputs. No values were printed or changed. No Google CLI configuration or connected browser surface was available for provider setup. Credentials and real participant identities are not included in this record.

## Operator decisions and private inputs still required

### Authorized follow-up: public repository and initial protections

The operator authorized making the repository public and selected Railway-generated domains. GitHub now reports `visibility=public`, `private=false`. Before that change, Gitleaks 8.24.2 reported zero findings across all local Git refs/history and separately across the six existing Actions runs' retrieved logs and repository issues/comments/reviews. Tracked-file/reference-image inspection found no participant enrollment data. This is a bounded publication check, not a guarantee that automated scanning finds every sensitive value. No repository content/history was rewritten, pushed or merged.

GitHub accepted and read-back verified main branch protection: all three exact required checks are pinned to GitHub Actions app ID 15368; branches must be up to date; one approving PR review is required; stale approvals are dismissed; conversations must resolve; administrators are subject to enforcement; force pushes and branch deletion are disabled.

Created GitHub `stage` and `production` environments, each allowing only branch `main` via a custom branch policy. Production reports `can_admins_bypass=false`. **Production has no required reviewer or token**. The subsequent operator decision below removes the separate reviewer requirement. The stage repository switch remains unset and production environment secrets remain empty. Live failed-check and reviewer-denial drills remain unperformed; API configuration is not equivalent to those drills.

The original plan-related 403 observations above are historical and no longer block public-repository setup. [Google operator instructions](google-operator-setup.md) now describe checking the work account's Cloud project permissions, the External QA audience, separate Web clients and private credential transfer.

Set and read-back verified each GitHub environment's `RAILWAY_ENVIRONMENT` variable to the existing Railway environment ID in the inventory. Service IDs/origins/tokens remain absent pending provisioning; no deployment was triggered.

1. Use the existing Railway project and generated domains with a modest single-replica configuration. The operator explained that the workspace payer reviews project costs and did not request a numeric cap. Do not change workspace-wide spending limits or upgrade the plan. Inspect actual usage after deployment and bring unexpected costs to the operator. No billable resources have yet been provisioned.
2. Keep production manually triggered. The operator explicitly chose no separate approval reviewer: an authorized deployer deliberately starts promotion after inspecting stage evidence. Retain exact-SHA CI/stage checks and main-only dispatch; never substitute an unchecked moving latest commit.
3. Provide the Google Cloud project and separate local/stage/production Web OAuth clients privately. Local/stage must permit the intended personal accounts in the consent audience. Register each exact callback only after the origin is known. Production configuration retains work-domain admission and no trial participant enrollment.
4. Privately supply the approved hosted domain, department name, Jaco's work lead identity, his personal ordinary-member identity and a distinct second ordinary QA identity. Google OAuth testing audience approval and Lantern database approval are separate controls.
5. Record the 19 October backup deferral: no staging backups; production backups reconsidered only after dogfooding and the value decision (ticket 16).

A local, untracked private-input wizard is prepared at `/home/jacobuntu/Ops/private/lantern-railway-setup/collect-inputs.sh`. Run it in a private terminal, not a recorded agent command. Hidden values are written to a mode-0600 file in a mode-0700 directory outside the repository. It only captures inputs; it does not grant access or configure providers. Stop before a hosted client section if its domain is not allocated. Syntax validation passed; shellcheck was unavailable. Do not source the captured file as shell code or copy it into Git/chat/logs. Consume it through a dotenv parser or equivalent data-only reader.

## First stage bootstrap, before enabling unattended delivery

This breaks the dependency between the first running app and the two real-login session secrets without introducing an authentication bypass:

1. Within the modest configuration described above, provision separate app/PostgreSQL services in the existing environments. Inspect each target's variables, volume, credentials and private database reference. Do not clone stage approval data into production. Disable GitHub/image automatic deployment paths on both apps; keep production unactivated.
2. Allocate stage/production domains and configure separate Google callbacks. Set `LANTERN_ENV=stage` or `production`, `NODE_ENV=production`, `LOCAL_ACCESS=0`, `HOST=0.0.0.0`, environment-specific `DATABASE_URL`, `APP_ORIGIN` and Google credentials. Configure and verify a separate migration runner (no privileged app pre-deploy hook) and effective `/health` settings directly on new services; see the updated hosted release runbook. Do not assume `railway.json` is applied. Do not deploy production to obtain its configuration.
3. Verify required PR checks and same-SHA main CI. Keep the repository switch unset/false. Use a clean **detached checkout of the selected merged SHA**, not this setup branch or a moving main checkout. Confirm its CI run has all three passing jobs. Stamp that SHA with `tools/release/stamp.mjs`.
4. Privately inject stage's environment-scoped project token and exact service/environment IDs. With the pinned Railway CLI on PATH, run `tools/release/deploy.mjs` with `RELEASE_SHA` and a private temporary `GITHUB_ENV` output file. This is a one-time operator stage bootstrap using the existing receipt validator, not successful automated stage acceptance. Record the returned deployment ID. Never print raw deployment logs.
5. Wait for `/health` to identify the exact SHA, receipt deployment ID and schema version 2. Check the login shell and anonymous protected-route denial. Keep approval stores empty until the privately confirmed stage identities are ready.
6. Against stage only, run the compiled domain/approval operations with privately supplied inputs and suppressed personnel output. Jaco signs in through real Google; then run compiled `setup` for the registered approved work lead. Each approved ordinary member signs in and the lead assigns membership through the application. Approval alone must not grant membership or lead role.
7. Each of the two ordinary members obtains their own `__Host-lantern-session` cookie through that real login in separate browser profiles. Transfer only the cookie value privately to GitHub **stage environment** secrets `QA_MEMBER_A_SESSION` and `QA_MEMBER_B_SESSION` using stdin/hidden input. Do not use a lead cookie, mint database sessions, add a test-auth endpoint or enable LOCAL_ACCESS. Confirm distinct active member identities through the existing smoke runner without logging session responses.
8. After local/stage Google checks, resource isolation and CI protections pass, set the **repository-level** `STAGE_DELIVERY_ENABLED=true`. Rerun the intended main push workflow and verify that a new deployment of that same SHA passes migration/readiness and stage smoke, producing its named artifact. The manual bootstrap is not a substitute. On activation failure return the switch to false.
9. Record deployment/SHA/run/artifact, session acquisition date/expiry and sanitized gate results. Sessions expire normally; reacquire through Google. No automatic renewal bypass is authorized.

For local Google verification, use a separate disposable database/schema and unused loopback port, `LANTERN_ENV=local`, `LOCAL_ACCESS=0`, and its own OAuth client. If the browser is on the Mac and the app is on the VM, use a dedicated SSH local forward with a matching callback origin. Do not overwrite the primary `.env`, bind over existing services or expose the local bypass through the prototype viewer.

## Backup and restore status

The earlier backup setup/rehearsal requirement is superseded by Jaco's 19 October
decision: no staging backups, and production backups deferred until dogfooding is
complete and the application's value is determined. No snapshot was created during
the transition preflight. Ticket 16 is deferred; it does not block setup or initial
dogfooding. Historical local synthetic restore evidence remains valid but does not
authorize hosted dumps, snapshots or schedules. Follow the current [transition
procedure](database-transition.md) for transaction failure/reversal limits.

## Remaining live gates and acceptance boundary

All platform failure-path drills in the [runbook](hosted-release.md#live-gate-verification-checklist) remain outstanding. Testing a failed required PR check needs a controlled remotely visible PR/check; this task does not authorize pushing this branch or merging main. Coordinate a separately authorized test before claiming that gate is proven. Production promotion remains disabled/unperformed; no production token is installed. Verify absence of automatic production triggers and missing/failed/mismatched evidence rejection before later activation, without promoting participants in this ticket.

Lead browsing, confirmation, newcomer acceptance and final multi-account stage verification remain separate feature/acceptance work. This infrastructure preparation does not close ticket 05 or claim full workflow acceptance.

## Operator clarification: cost and manual promotion

The operator does not require a Railway budget entry or second-person production approval. The workspace payer already reviews per-project spending. Recommended cost posture: one replica per app/database, private database networking, modest resource limits reviewed against startup metrics, small initial volumes and no backup/restore resources during the current deferral. Consider stage app sleeping only after verifying its effect on readiness and smoke. Production remains unactivated in this task.

Railway's documented hard usage limits apply at workspace level and can shut down workloads; do not set one for Lantern in this shared workspace. A suggested Lantern-only review threshold is US$30/month projected incremental usage, not a configured alert, guaranteed estimate or spending cap. Revisit using measured usage. Pricing reference: [Railway cost controls](https://docs.railway.com/pricing/cost-control) and [resource pricing/metrics](https://docs.railway.com/guides/right-size-cpu-memory).

The existing manual GitHub workflow already supplies the deliberate button plus exact tested-SHA enforcement. Keep it as the prepared path without a separate reviewer. Railway's Deploy Latest Commit button follows the connected branch's latest commit and therefore does not alone preserve the tested revision. No production dispatch was performed.

## Hosting-only preparation — 16 October 2026

The operator split immediate hosting verification from deferred authentication. See [ticket 09](../../.scratch/team-trial/issues/09-hosting-only-staging.md), [provider decision ticket 10](../../.scratch/team-trial/issues/10-authentication-provider-decision.md), and [hosting-only runbook](hosting-only-staging.md). Prepared explicit stage-only startup without provider credentials, denying login and existing sessions. Added separate `hosting-evidence.json` smoke output that cannot qualify for production promotion.

TDD red/green observed for configuration and prior-session denial; typecheck/build and all 66 real PostgreSQL/HTTP/browser/release tests pass. Existing local database was used only through isolated temporary test schemas, cleaned afterward. Generated test captures were restored. No runtime service, Railway resource, secret or deployment switch changed in this implementation step. No stage SHA has yet been deployed or tested live. Changes remain unpushed on the setup branch; deployment awaits a reviewed merged revision and its main CI.

## Staging resources provisioned for operator inspection — 16 October 2026

The user subsequently authorized publishing the PR for review and provisioning staging services, while retaining approval before merge/app deployment. [Draft PR #6](https://github.com/JesusFilm/lantern/pull/6) contains the hosting-only changes. Current main `e302f84849624fa808311833c52e45e8b76a9300` (merged lead browsing) was integrated cleanly; typecheck/build and all 84 local tests passed. Independent standards and specification reviews found no actionable issues. CodeRabbit was requested but rate-limited, not completed. GitHub run [38811627017](https://github.com/JesusFilm/lantern/actions/runs/38811627017) passed all three required PR checks on application-code head `910935ccdbfdffec59dead3dabe052b650976ec6`; stage delivery was skipped. Later evidence-only changes require their own PR CI result.

[Provisioning evidence](staging-provisioning-evidence.md) supersedes the original zero-service inventory: staging has an empty app and running PostgreSQL, generated domain and private database reference. No app source/deployment or application migrations occurred. Production remains empty. GitHub stage environment now has APP_ORIGIN and RAILWAY_SERVICE set to these resources, alongside its existing RAILWAY_ENVIRONMENT. STAGE_DELIVERY_ENABLED remains unset; no deployment token was generated. User inspection/approval is next.

## Production resources provisioned — 16 October 2026

The operator explicitly requested equivalent production resource preparation. [Production evidence](production-provisioning-evidence.md) records the separate database/volume/password and empty application instance in the existing production environment. Production database deployment succeeded; no application revision is deployed, no migrations were run and no participant access was enabled. Hosting-only mode is off and production retains its restrictive configuration. Staging was preserved.

GitHub production environment metadata now points at its reserved origin and the app service ID, paired with production's existing environment ID. No deployment token or new activation trigger was added. Ticket 05 now explicitly separates completed resource provisioning from outstanding authentication, application deployment and recovery/live acceptance.

## Google-first Mac setup — 16 October 2026

The operator superseded the Google pause. [Mac Google evidence](google-mac-setup-evidence.md) records successful dedicated local/stage/production OAuth client creation in the existing External project and real local work/personal sessions. Credentials are private on the Mac; no Railway variables, deployments, hosted enrollments or stage-delivery switch were changed in that session. Generic shared consent branding remains; hosted acceptance is still outstanding. This update does not turn the historical provisioning and hosting-only records above into current live deployment evidence.

## Staging activation — 16 October 2026

[Staging activation evidence](staging-activation-evidence.md) supersedes the earlier undeployed-stage status. The checked main revision is live with schema version 2 and Google authentication. Automatic staging delivery remains disabled and production remains inactive. This operator bootstrap is not automated smoke or production promotion evidence.
