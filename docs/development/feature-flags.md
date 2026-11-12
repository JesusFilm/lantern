# Feature flags

Read this before adding behavior that users would notice, and when releasing or removing a flagged feature. [ADR 0014](../adrs/0014-feature-flags.md) records the decision and its tradeoffs.

## When to use a flag

Put new screens, controls and workflows behind a flag, so they can reach production hidden. They can be tested on staging and, using `preview`, by selected accounts in production. QA's issue verification does not gate deployment or production preview. The manual checks required by [Releasing](../operations/releasing.md), including real staging sign-in for auth, OAuth and admission-policy changes, still apply. Jaco decides when to enable a feature for everyone, normally after QA passes; the owner tries the feature in production preview before enabling it for everyone.

The owner-only `/ops/feature-flags` reporting page is an exception: its owner email setting controls access and is disabled when unset; it has no separate flag. See [ADR 0017](../adrs/0017-owner-flag-reporting.md).

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

## Inspect the current state

The environment owner may set `LANTERN_FLAG_OWNER_EMAIL` to one exact approved account email in the webapp's environment. After signing in with that account and an active department membership, open `/ops/feature-flags` on that environment. The page lists registered names and their resolved `off`, `preview` or `on` state. It never lists preview email addresses and does not change settings. A signed-out visitor, another account, or a former member cannot view it. When the variable is unset the page is unavailable to everyone. An invalid value prevents startup. In explicitly enabled loopback-only local access, the synthetic local account has no sign-in or admission check; its email and active membership must still match the owner setting.

The owner sets this variable separately in each environment; changing it redeploys that environment and has the same staging evidence consequences described below. The private LanternBot board may link to the page, but does not fetch production data.

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
