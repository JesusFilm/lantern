# Feature flags

Read this before adding behavior that users would notice, and when releasing or removing a flagged feature. [ADR 0014](../adrs/0014-feature-flags.md) records the decision and its tradeoffs.

## When to use a flag

Put new screens, controls and workflows behind a flag, so they can reach production hidden and be checked there before members see them.

A flag cannot hide these, so do not add one for them:

- fixes and wording changes to behavior that already exists
- refactors and dependency updates
- database migrations, which follow the [release procedure](../operations/releasing.md)

A flagged feature that needs a schema change must keep the migration compatible with the application that is still serving, with the feature hidden.

## Add a flagged feature

1. Register a lowercase, hyphenated name in [shared/features.ts](../../shared/features.ts).
2. On the server, call `requireFeature(features, name, user.email)` in every route of the feature, after resolving the signed-in user. A hidden feature then answers 404, like a route that does not exist. Pass only the server-resolved email; never accept a feature list or a preview claim from the client.
3. In the client, show the feature's entry points only when `session.features` includes the name.
4. Test both states through the public interfaces. With the feature shown, it works. With it hidden, its routes answer 404, its entry points are absent and existing behavior is unchanged. Build the setting for a test with `resolveFeatureConfig` and pass it to `createApp` as `features`. An application created without `features` hides every registered feature.
5. Add the feature's slides to the [QA manual](manual.md) in this same change, as [manual.md](manual.md) requires for every user-visible change. The feature shows on stage by default, so testers will see it there while production still hides it; each slide must state the flag name and that the feature is hidden in production until it is released. The flag-removal change then drops that note, keeping the slide itself.

## States and settings

| State | Who sees the feature |
| --- | --- |
| `off` | Nobody |
| `preview` | Signed-in accounts whose email is in `LANTERN_PREVIEW_EMAILS` |
| `on` | Everyone |

Set states in the webapp's `LANTERN_FEATURES` variable, for example `focus-notes=preview,team-calendar=on`. A registered feature with no setting is off in production and on in stage and local environments. To hide a feature on stage or locally, set it to `off` there.

The application refuses to start when either variable is malformed, names a state other than these three, repeats a feature, or puts a feature in preview with no preview accounts. It logs and ignores a setting for a name the release does not have.

## Change a feature's state

Changing a stage or production variable redeploys the webapp with a new deployment ID. In stage, that replaces the deployment a passing acceptance recorded, so any automatic promotion waiting on that deployment fails its "stage still serves the accepted deployment" check, and a failed acceptance stays failed until the current-main CI push run is rerun. Make stage feature changes when no promotion is pending; afterwards, rerun the current-main CI push run for fresh acceptance evidence (see [releasing](../operations/releasing.md)).

## Release a flagged feature

The repository owner does this in Railway. Each variable change redeploys the webapp.

1. Confirm the release containing the feature is live in production, with the feature unset or `off`.
2. Set the feature to `preview` and list the checking accounts in `LANTERN_PREVIEW_EMAILS`. Try the feature in production with one of those accounts.
3. Set the feature to `on`.
4. If a problem appears, set it back to `off`. Data the feature already saved stays in the database.

## Remove the flag

Once the feature is on in production and has settled, remove its name from the registry together with every guard and client check, and delete the tests for the hidden state. The leftover entry in `LANTERN_FEATURES` is harmless; remove it when convenient.

## Standing switches

`coach` stays registered. It controls the goal coach, which calls paid external models, so the owner keeps the ability to turn it off or limit it to a preview. It differs from a release flag in three ways:

- It is never removed.
- Its model endpoint answers 503 with "Coaching is unavailable" when the coach is not offered to the caller, because the client already treats that as "continue manually". Review, notes and manual editing do not depend on it.
- It also needs its providers. The session's `coachAvailable` is true only when the flag shows the coach to that account and both providers are configured. Setting `coach` to `preview` or `on` without them stops startup and the release configuration check. See [coaching operations](../operations/coaching.md).
