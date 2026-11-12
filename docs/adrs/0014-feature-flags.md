# Feature flags for hidden releases

Date: 2026-11-11

Status: Accepted by Jaco.

Partially superseded: 2026-11-13 — the owner-only feature flag reporting page is governed by [ADR 0017](0017-owner-flag-reporting.md).

## Decision

New user-visible behavior can merge and deploy while hidden. Each such feature has a name registered in [shared/features.ts](../../shared/features.ts). The server guards the feature's routes, and the client shows its entry points only when the server-resolved session lists the name. [server/features.ts](../../server/features.ts) owns the rules.

Two webapp variables set the state per environment:

- `LANTERN_FEATURES`: comma-separated `name=off`, `name=preview` or `name=on`.
- `LANTERN_PREVIEW_EMAILS`: comma-separated exact email addresses.

`off` hides the feature from everyone. `preview` shows it only to signed-in accounts whose server-resolved email is listed. `on` shows it to everyone. A registered feature with no setting is off in production and on in stage and local environments.

The application checks both variables at startup and refuses to start on an invalid entry, or on a preview with no listed accounts. A setting for a name this release does not have is ignored and logged, so a leftover setting cannot break the release that removes a flag.

The owner changes production variables; agents have no production access. Once a feature is on for everyone, a follow-up change removes its name and guards. Use the [feature flags guide](../development/feature-flags.md) for the working procedure.

The goal coach is the first registered feature, `coach`, and replaces the separate `COACH_ENABLED` variable. It is a standing switch that is never removed, because it gates paid external model calls. While `COACH_ENABLED` is still set, the release configuration check requires an explicit `coach` setting, so the change of mechanism cannot silently change who is offered coaching.

## Rationale and alternatives

Main is promoted to production automatically ([ADR 0008](0008-staging-gate-and-production-smoke.md)). Without a way to hide it, new behavior reaches members before the owner has tried it in production. The alternatives were:

- **On and off only, checked on staging.** Staging has synthetic data and its own configuration, so it cannot show how a feature behaves for real accounts.
- **Hold the merge until the owner has checked.** This keeps branches open for days and brings back the merge conflicts and stale reviews that automatic delivery removes.
- **Flags stored in the database with an administration screen.** This needs a schema, access rules and interface for a switch one person operates.
- **A hosted flag service.** This adds a dependency, a credential and a network call to every session.

Environment variables fit how the webapp is already configured, need no schema, and change through a deployment that the existing health check guards.

## Consequences

- Changing a feature's state means changing a Railway variable, which redeploys the webapp. Sessions are stored in the database and survive it.
- An invalid setting fails the new deployment at startup. With the configured health check, the previous deployment keeps serving.
- A flag hides routes and entry points. It does not hide migrations, dependency updates or changes to existing behavior; schema changes still follow [ADR 0001](0001-release-migrations.md) and the [release procedure](../operations/releasing.md).
- Every flagged feature needs tests for both states. Applications built without feature settings, which includes the existing test suites, hide every registered feature, so those suites check the state production starts in.
- Staging shows registered features by default. A broken hidden feature can therefore fail staging acceptance and hold back promotion until it is fixed. Setting it to `off` on stage redeploys staging, so it releases no hold: the failed acceptance stays failed, and promotion resumes only after the current-main CI push run is rerun for fresh evidence.
- Changing a stage feature variable redeploys staging with a new deployment ID, replacing the deployment a passing acceptance recorded. An automatic promotion waiting on that deployment then fails its stage-deployment check. Make stage feature changes when no promotion is pending, and rerun the current-main CI push run afterwards for fresh acceptance evidence ([releasing](../operations/releasing.md)).
- The release configuration check validates feature-setting syntax, rejects a repeated feature and a malformed preview account, requires preview accounts while any entry is in preview, and checks the coach's providers and the retired `COACH_ENABLED`. Readiness smoke does not inspect feature settings.
- Flags left in place after release add dead branches. Removing them is part of finishing the feature.
