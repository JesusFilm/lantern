Kind: ticket
ID: team-trial/05
Title: Configure Railway environments, Google access and live release gates
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 01, 04
Implementation: Stage authenticated on checked main; production resources inactive; setup acceptance incomplete; automation/recovery tracked in 15/16
Slice: Hosted team trial

---
## Outcome

Stage is available for authenticated QA, and production is separately configured for later promotion. Agent preparation is possible; real account/credential choices and provider setup require the operator.

## Current execution boundary — 16 October 2026

Google staging is active with schema version 2, one Engineering lead and one ordinary member. Production resources and a separate OAuth client exist, but production is inactive. [Current evidence](../../../docs/operations/staging-activation-evidence.md) supersedes the earlier hosting-only plan. Complete remaining environment isolation/authentication setup without treating provisioning as production acceptance. Planning only: do not activate delivery or install production credentials in this session.

## Ownership of remaining release work

The automation/backup requirements below are explicitly handed off. Their execution and completion evidence are owned by tickets [15](15-verify-automated-release-gates.md) and [16](16-backup-restore-readiness.md); they are not prerequisites for resolving this environment-setup ticket. Ticket 14 owns reproducible deployment settings, 12/13 production privileged-access policy/enforcement, 17 production database readiness while inactive, and 07 later production activation. Resolve 05 only after remaining environment setup checks have evidence, explicitly linking these open handoffs rather than checking them as passed. No production privileged operation may bypass 13.

Railway-generated domains are approved. Start with small resources and review actual cost; a numeric budget is not an outstanding prerequisite. US$30/month projected usage was suggested as a review threshold, not a cap or price guarantee. Preserve shared workspace spending controls.

## Inputs before execution

Railway project access and an environment-scoped deployment token for the intended project (the CLI upload workflow does not require a Railway GitHub repository connection); stage/prod domains; separate local/stage/production Google OAuth clients and exact callbacks; approved work domains and real lead/QA identities, including Jaco's personal Google member account for stage; repository-rule and deployment integration access. Obtain/store these privately. The operator authorized modest staging and production resource provisioning on 16 October 2026. This does not authorize application deployment, production activation, plan upgrades or inventing identity-provider credentials.

## Resource provisioning checklist — separate from application activation

Production resource preparation is part of this ticket, not the later production-promotion ticket. The operator explicitly requested it alongside staging on 16 October 2026.

- [x] Staging application shell, PostgreSQL instance/volume, generated domain and private database reference provisioned; subsequently activated with real Google authentication; see staging evidence below.
- [x] Production application shell and PostgreSQL instance/volume provisioned with independent credentials/data and a generated domain; no staging data or credentials copied.
- [x] Production configuration uses `NODE_ENV=production`, `LANTERN_ENV=production`, `LOCAL_ACCESS=0`, and hosting-only mode off; app has no automatic deployment source or deployed revision.
- [x] Record both environments' resource identifiers and isolation checks for operator inspection. Local/stage Google clients and stage migrations/readiness have since been verified; production activation, recovery and full release acceptance remain outstanding.

## Acceptance

- [ ] Stage/prod application and PostgreSQL resources are prepared with separate databases, credentials, OAuth callbacks and exact-email approval stores; only stage is activated for QA in this ticket. Test that stage cannot read/write production records. Use synthetic stage content.
- [ ] Verify staging normal authentication, NODE_ENV=production, no local bypass, port/interface and HTTPS origin. Prepare the corresponding production configuration without activation; effective deployment configuration is verified under 14 before release.
- [x] Create separate local/stage/production Google clients with exact callbacks; verify real local and staging work/personal login without the local bypass. Preserve local data/services. Production credentials remain private and uninstalled.
- [x] Approve the intended staging lead/member using compiled operations, bootstrap Engineering and add the ordinary member through the lead interface. Additional QA enrollment and the second member session are owned by 15.
- [ ] Verify stage denial of unapproved same-domain/personal/external accounts, cookies, cancellation/retry and sign-out with the real provider; retain production work-domain policy. Full multi-account/revocation acceptance remains 06.
- [ ] Verify absence of independent production/stage autodeploy sources and record target identifiers/configuration. Production remains inactive; credential installation and privileged enrollment cannot precede governance verification under 13.

## Release requirements handed off (not completed here)

- **14:** reproducible migration/start/health settings and drift detection; reconcile local evidence through review.
- **15:** required-check and failed-check live proof, environment-scoped token, two ordinary-member sessions, separately authorized stage delivery enablement, exact-revision smoke artifact and promotion rejection drills. Keep `STAGE_DELIVERY_ENABLED` unset/false until that separately authorized work passes its prerequisites; return it to false on activation failure.
- **16 (deferred):** reconsider production backups only after dogfooding completes and value is determined. No staging backups; no backup/restore prerequisite for initial setup or dogfooding.
- **17:** human-run production role/schema setup after staging transition proof; no application activation.
- **06/07:** final candidate acceptance and explicit production promotion with controlled enrollment and authenticated smoke.

These are downstream handoffs, not reciprocal blockers on 05. Resolving environment setup must leave their acceptance open and link their evidence when later completed.

## Evidence

[Setup inventory and bootstrap preparation](../../../docs/operations/railway-google-setup-evidence.md) records the 15 October 2026 live read-only inspection at merged SHA `92a18ff2de72e9ba95cc6d30d803f859e6aacecf`. This was an initial inventory, not the current resource state; later provisioning is recorded below and in linked evidence. Main quality checks passed, stage delivery remains unset/skipped, and repository protection APIs initially returned a plan-related 403. Subsequent setup made the repository public and configured initial required checks/protections; consult the evidence document for current verification rather than treating that initial failure as the current state. This historical inventory alone claims no live acceptance. Later evidence proves bounded stage Google login, deployment and save/read behavior; recovery and full release acceptance remain open.

Record sanitized configuration checklist, stage URL, deployed SHA and backup status (deferred by decision) in the release evidence. Actual credentials/emails remain private. Complete only when live setup succeeds; code tests do not substitute. [Research](../../../docs/research/railway-team-trial.md).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.

## Production resource evidence — 16 October 2026

[Production resources](../../../docs/operations/production-provisioning-evidence.md) are now prepared alongside [staging resources](../../../docs/operations/staging-provisioning-evidence.md). The project-wide service definitions are reused, but environment instances, credentials and database volumes are distinct. Production database startup succeeded; the application has no source/deployment and is not activated. Authentication, schema migrations, backup/restore, application readiness and participant acceptance remain pending.

## Staging activation — 16 October 2026

[Manual activation evidence](../../../docs/operations/staging-activation-evidence.md) records checked revision `8e4cd805e9e5c88dea534823859191627ee8402c`, successful schema migrations and live staging authentication. The operator explicitly requires automatic stage delivery to remain disabled and production inactive. Full two-member smoke, failure drills, backup/restore and production acceptance remain outstanding; the broad acceptance boxes above remain open.

## Backup decision — 19 October 2026

The historical backup/restore work listed above is deferred under ticket 16 and
does not block setup or initial dogfooding. No staging backups; production backups
are reconsidered only after dogfooding is complete and application value determined.
