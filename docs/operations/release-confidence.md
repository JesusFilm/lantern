# Release confidence

Use this record for completed rollout evidence and activation rehearsal. For the checks themselves, read [Testing](../development/testing.md); for ongoing automatic/manual releases and incident handling, read [Releasing](releasing.md). Policy and rationale live in [ADR 0008](../adrs/0008-staging-gate-and-production-smoke.md) and [ADR 0006](../adrs/0006-authenticated-release-acceptance.md).

## Verified rollout — 21 October 2026 (Pacific/Auckland)

[PR #31](https://github.com/JesusFilm/lantern/pull/31) implemented authenticated staging acceptance, exact-evidence automatic promotion, preserved manual override and independent journey/cleanup diagnostics. [PR #32](https://github.com/JesusFilm/lantern/pull/32) fixed a hosted timing failure by waiting for initiative choices before saving an edited objective. Both were merged.

| Rehearsal | Observed result |
| --- | --- |
| [First hosted run](https://github.com/JesusFilm/lantern/actions/runs/39502027711) | Acceptance failed at focus authoring; readiness survived, cleanup passed, no passing acceptance evidence. Read-only verifier evaluation allowed manual admission and denied automatic admission. |
| Delayed-response regression | A real PostgreSQL/browser test reproduced the initiative-loading failure and passed after the #32 correction; deliberate save/image failures remain covered. |
| [Main attempt 1](https://github.com/JesusFilm/lantern/actions/runs/39503701366/attempts/1) | Recovered four users/two departments left by an intentionally terminated private staging fixture runner, then passed acceptance and cleanup. |
| [Main attempt 2](https://github.com/JesusFilm/lantern/actions/runs/39503701366/attempts/2) | Repeated success on a new deployment. Read-only gate evaluation rejected the old attempt/deployment and an older successful main revision. |
| [Full main attempt 3](https://github.com/JesusFilm/lantern/actions/runs/39503701366/attempts/3) | After explicit owner approval, all CI, staging readiness, acceptance and cleanup passed. Staging deployment: `0082e724-154d-4283-99d3-37d2bbd67200`. |
| [Automatic production release](https://github.com/JesusFilm/lantern/actions/runs/39508385327) | Admission, configuration, freshness checks, migrations, deployment and readiness passed. Artifact links staging run `39503701366`, attempt `3`, mode `automatic`. |

At completion, live production and its artifact agreed on SHA `d8384ccb970ce66c7efe3153329b30896fb13871`, deployment `1d8690e1-a58c-4c18-a813-35e3a2d8b509`, schema `8`. Staging had zero synthetic users/departments and unchanged other user/department identity sets. Real Google sign-in on staging passed using the owner's existing browser session. Combined journey/cleanup failures were exercised in isolated local PostgreSQL, not by corrupting hosted production.

Repository staging delivery, acceptance and automatic production switches were all `true` at completion. Production was restricted to main with no required reviewer. Independent Railway source-deploy triggers were absent; existing failed-workflow GitHub/email notifications were verified. These are **dated observations**, not assertions about current configuration. Read live variables, environment protections, workflows and health before operating.

## Activation rehearsal

For a new environment or changed gate, keep production manual while establishing evidence. This is not a checklist to repeat for every normal merge.

1. Inspect Railway/GitHub targets and independent deployment paths. Use existing protected staging migration credentials, CA and role settings. No extra runtime privilege, Google account or production synthetic data is needed. Set repository `STAGE_ACCEPTANCE_ENABLED=true`, `AUTO_PRODUCTION_ENABLED=false`, and exact HTTPS `STAGE_APP_ORIGIN`; verify staging delivery is enabled, environment variables do not shadow controls, and queued production runs are handled.
2. Merge reviewed changes with passing CI and follow the main push run. Verify its exact SHA/deployment/schema/run/attempt, all ten checkpoints, acceptance and cleanup in the [artifacts](releasing.md#evidence-and-failure-handling). Complete a real Google sign-in separately.
3. Rehearse failure blocking, cleanup/retry and interrupted-fixture recovery with synthetic isolated data. A staging interruption requires controlled private fixtures and recovery verification; do not widen cleanup scope or disturb human records. Keep combined failure and destructive injection in isolated local PostgreSQL. Assess manual override and stale revision/attempt/deployment rejection through read-only verifier evaluation, without dispatching production as a test.
4. Repeat a successful current-main push CI run and verify its new attempt/deployment evidence. Review production environment approval rules and built-in failure notifications. A summary alone cannot qualify a release.
5. With owner authorization, enable `AUTO_PRODUCTION_ENABLED=true`. Rerun current-main push CI if needed for a fresh completion event, then observe automatic production through completed success. Match the production artifact to source staging evidence and live health; record the SHA, deployment/schema, run links and cleanup outcome.

The [fixture helper](../../tools/release/acceptance-fixture.mjs) serializes fixture work with a database lock. A crash releases the lock; the next run recovers only exactly marked abandoned graphs. Sessions expire after 15 minutes, with sign-out and cleanup normally revoking them earlier. Keep session tokens in memory and private: the synthetic lead has ordinary staging lead authority, including access to the registered-user directory.

## Maintenance

Update the testing guide with changed checks/limits and the release guide with changed operator steps. Keep dated execution evidence here or in linked PR/run artifacts; do not rewrite a past success as evidence for a newer revision. Historical proposals such as [system-test-team-plan](system-test-team-plan.md) are not operating instructions. No permanent password login, production test workspace, custom alert service or automatic rollback was added by this rollout.
