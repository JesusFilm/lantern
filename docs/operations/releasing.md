# Releasing Lantern

Read before merging, releasing, changing schema/delivery switches or recovering a release. [Testing](../development/testing.md) explains what the checks do; [release confidence](release-confidence.md) records activation evidence. [README setup](../../README.md#delivery) covers first provisioning and credentials.

## Normal automatic release

```text
PR: typecheck + PostgreSQL/browser tests + production/Docker build
main push: same checks → configuration → migrate → deploy staging → readiness
  → authenticated journeys + cleanup → exact run/attempt evidence
  → automatic admission → production configuration/migrate/deploy → readiness
```

Repository Actions variables `STAGE_DELIVERY_ENABLED`, `STAGE_ACCEPTANCE_ENABLED` and `AUTO_PRODUCTION_ENABLED` control the stages; `STAGE_APP_ORIGIN` identifies the accepted staging target. Read current values when operating; a historical rollout record does not establish today's settings.

Automatic promotion requires a successful trusted main push run and its exact SHA/run/attempt evidence, passing acceptance **and cleanup**, latest-main freshness, the accepted staging deployment still live, and matching advertised staging/production schema versions. Production verifies again under its lock and immediately before migrations. Configured environment reviewers still apply. A newer main revision supersedes a queued automatic candidate.

Implementation: [CI](../../.github/workflows/ci.yml), [production workflow](../../.github/workflows/promote.yml), [verifier](../../tools/release/verify-promotion.mjs). Use these for exact step order and current configuration.

## Manual release and schema changes

1. Review compatibility with the application still serving: migrations run **before** app replacement. Check expected schema settings in both workflows when adding a migration. Destructive changes may need a compatibility release first and a production backup; see the concrete [two-release removal procedure](remove-hosted-domain.md). Staging cannot prove a production backfill is safe.
2. Select the full 40-character main SHA with successful type/test/build checks and staging configuration, migrations, deployment and readiness. Normally require acceptance/cleanup too; manual dispatch permits an intentional override of those two failures only. It also supports historical main SHAs with trusted readiness evidence.
3. With production release authorization, use GitHub **Actions → Deploy production → Run workflow**, branch `main`, and the selected SHA, or:

   ```sh
   gh workflow run promote.yml --repo JesusFilm/lantern --ref main -f sha=<full-main-sha>
   ```

4. Follow the new run through configuration, migrations, deployment and readiness. Wait for its completed success; a submitted deployment is not completion.
5. Download `production-evidence-<sha>` and check `sha`, `readiness: passed`, deployment ID and schema version against live `/health` headers `X-Lantern-Revision`, `X-Lantern-Deployment` and `X-Lantern-Schema`. The workflow controller's head SHA can differ from the selected app SHA. Report the selected SHA and run link.

Automatic admission blocks differing advertised schemas. A successful manual schema release brings production to the new version, allowing subsequent qualifying merges to promote automatically if the switch remains enabled. Health advertises the application's expected schema, not the full migration ledger; a failed manual migration needs operator recovery before automatic delivery resumes.

## Evidence and failure handling

| Where | Evidence to inspect |
| --- | --- |
| Staging readiness | `stage-readiness-<sha>-<run-id>-<attempt>` contains `release-evidence.json`, preserved before acceptance. |
| Staging acceptance | `stage-acceptance-<sha>-<run-id>-<attempt>` contains matching SHA/deployment/schema/run/attempt, ten checkpoint names and `acceptance: passed`, `cleanup: passed`. |
| Failed staging run | Actions summary separates journey checkpoint/outcome and cleanup outcome, including unknown/not reached; no passing artifact is manufactured. |
| Production | `production-evidence-<sha>` binds readiness to the deployment; automatic evidence also records source staging run/attempt and `releaseMode`. |

For staging failure, inspect the failed step and safe checkpoint, distinguish product/infrastructure/cleanup failure, and fix the cause before rerunning. Fixture cleanup must keep its ownership boundary; investigate unexpected relationships through authorized access rather than broadening deletion. No cookies, traces, raw errors or personnel data belong in diagnostics.

A production smoke failure happens **after deployment**; a migration may already have committed. Inspect before retrying, assess the serving app/schema, and choose compatible fix-forward or manual recovery. There is no automatic rollback or persistent failure stop. To stop further releases, set repository `AUTO_PRODUCTION_ENABLED=false` and separately cancel already admitted/queued production runs. Keep staging acceptance enabled for evidence. Engineers own recovery and their built-in GitHub Actions notification preferences.

For auth/OAuth/admission-policy changes, disable automatic promotion before the merge and cancel pending admissions. Complete real Google sign-in on staging before releasing that SHA. Restore automatic promotion with release authorization; rerun the current-main push CI run if a fresh automatic event is needed (CI has no manual-dispatch trigger). First activation or a changed gate needs the [rehearsal procedure](release-confidence.md#activation-rehearsal).
