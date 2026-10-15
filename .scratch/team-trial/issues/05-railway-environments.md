Kind: ticket
ID: team-trial/05
Title: Configure Railway environments, Google access and live release gates
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 01, 04
Implementation: Public repository and initial GitHub protections configured; live setup awaits operator inputs, spending ceiling and production reviewer
Slice: Hosted team trial

---
## Outcome

Stage is available for authenticated QA, and production is separately configured for later promotion. Agent preparation is possible; real account/credential choices and provider setup require the operator.

## Inputs before execution

Railway project access and an environment-scoped deployment token for the intended project (the CLI upload workflow does not require a Railway GitHub repository connection); intended plan/budget; stage/prod domains; separate local/stage/production Google OAuth clients and exact callbacks; approved work domains and real lead/QA identities, including Jaco's personal Google member account for stage; repository-rule and deployment integration access. Obtain/store these privately. This planning task does not authorize provisioning charges or invent credentials.

## Acceptance

- [ ] Stage/prod application and PostgreSQL resources are prepared with separate databases, credentials, OAuth callbacks and exact-email approval stores; only stage is activated for QA in this ticket. Test that stage cannot read/write production records. Use synthetic stage content.
- [ ] Both apps use normal authentication, NODE_ENV=production and no local bypass. Set Railway port/interface, HTTPS APP_ORIGIN, healthcheck and migration entrypoint; secrets remain outside Git/client bundles.
- [ ] Prepare real Google clients and exact callbacks for local development, stage and production. Verify local real-Google login with the walkthrough bypass disabled, using approved work and personal QA identities and isolated local test data. Preserve existing walkthrough data/services. In stage, approve Jaco's lead and personal member emails directly in its database, bootstrap lead membership, and add the personal account as an ordinary member. Repeat with QA participants and provide at least two member accounts for full isolation checks. Prepare production resources and private configuration only; do not activate an incomplete production app or enroll trial participants before 07.
- [ ] Stage URL is accessible to approved work/personal QA users; unapproved same-domain and personal/external accounts are refused. Verify stage uses its explicit server-side admission policy and production configuration retains mandatory work-domain restrictions. Verify cookies, cancellation/retry and sign-out with the real provider.
- [ ] Re-enable automatic stage delivery after setup: it is intentionally disabled by default in `.github/workflows/ci.yml`. Leave the **repository-level** Actions variable `STAGE_DELIVERY_ENABLED` unset or `false` until the stage app/database, target-specific `RAILWAY_TOKEN`, `RAILWAY_SERVICE` and `RAILWAY_ENVIRONMENT`, `APP_ORIGIN`, Google configuration, two approved QA member session secrets, migration/readiness settings and required CI gates are ready. Then set the repository variable to the exact string `true`; an environment-level variable cannot enable this job. Re-run a successful main push workflow for the intended SHA (or use the next reviewed main merge) and record its deployment/readiness/smoke evidence. Verify unset/false skips stage while all three CI checks still run; enabled delivery must still reject failed checks. If setup verification fails, set the switch back to `false` until corrected. Production remains manual and is not enabled by this switch.
- [ ] Activate required PR checks/repository rules and main-revision CI. Verify a failed required check prevents merge, and a failed main check prevents stage deployment. Successful main CI automatically deploys that same SHA to stage, waits for migration/readiness and runs stage smoke/E2E checks. Remove or disable any direct merge deployment path that bypasses these checks. Record sanitized evidence of the gates.
- [ ] Disable production autodeploy and verify a main merge/stage deployment cannot deploy production. Verify an explicit manual promotion path selects the exact stage-tested SHA and rejects missing/failed evidence. Record environment/service identifiers and commands without secrets for production promotion.
- [ ] Configure backup retention and perform a restore into an isolated disposable database; show retained records are readable and record recovery time/result. Never restore over live data for rehearsal.

## Evidence

[Setup inventory and bootstrap preparation](../../../docs/operations/railway-google-setup-evidence.md) records the 15 October 2026 live read-only inspection at merged SHA `92a18ff2de72e9ba95cc6d30d803f859e6aacecf`. Existing Railway environments can be reused; no services are provisioned. Main quality checks passed, stage delivery remains unset/skipped, and repository protection APIs returned a plan-related 403. No live Google, deployment, restore or workflow acceptance is claimed; all acceptance boxes remain open.

Record sanitized configuration checklist, stage URL, deployed SHA and backup/restore result in the release evidence. Actual credentials/emails remain private. Complete only when live setup succeeds; code tests do not substitute. [Research](../../../docs/research/railway-team-trial.md).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
