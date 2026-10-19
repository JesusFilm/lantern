# Lantern roadmap

Reconciled 15 October 2026 around a small hosted team trial. Dates and broader administration from the original January roadmap are historical context, not delivery commitments.

| Priority | Milestone | Current disposition |
| --- | --- | --- |
| Delivered | [M01 — accepted local authoring and guide baseline](../.scratch/position-focus-guide/milestone.md) | Complete against revised scope; live Google/newcomer checks transferred, not passed. |
| Next | [M06 — run a secure hosted team trial](../.scratch/team-trial/milestone.md) | Authenticated staging and lead reading verified in part; confirmation, production access governance, release/recovery evidence and production acceptance remain. |
| Deferred next | [M04 — later review cycles](../.scratch/position-focus-review/milestone.md) | Plan after initial trial: lead-initiated midyear/year-end drafts, preserving confirmed history. |
| Parked | [M02 — engineer context](../.scratch/engineer-context/milestone.md) | Catch-up records await a demonstrated need; member list is included in M06. |
| Superseded | [M03 — original completion workflow](../.scratch/position-focus-submission/milestone.md) | Closed as split: authoring delivered in M01; confirmation and trial in M06; request/submission machinery not approved. |
| Deferred outcome | [M05 — first team cycle](../.scratch/first-team-cycle/milestone.md) | Scope, participants and completion date to revisit after trial; no January commitment. |

## Next implementation order

The runtime, approved Google access and lead-reading foundations are merged. Staging has real member-save/lead-read proof; production is inactive and automatic staging delivery is disabled.

1. Decide [production access policy](../.scratch/team-trial/issues/12-production-access-policy.md), then [enforce privileged access and auditing](../.scratch/team-trial/issues/13-enforce-production-access-governance.md).
2. In parallel where dependencies permit, implement [confirm and lock](../.scratch/team-trial/issues/03-confirm-and-lock.md), complete environment setup (05), and make [Railway configuration reproducible](../.scratch/team-trial/issues/14-reproducible-railway-configuration.md).
3. Complete recorded manual staging acceptance after bounded setup/access/configuration checks. Automated release gates (15), IaC and backups (16) are deferred; use the [human-run release procedure](operations/hosted-release.md).
4. Converge on full final-revision stage acceptance (06), then separately authorized production promotion (07). Use the human-run release procedure; the artifact-gated promotion workflow and its input simplification (11) are deferred.

See the [dependency-ordered queue](../.scratch/team-trial/breakdown.md). Planning only: no ticket status authorizes implementation, credential installation or enabling delivery. Production data-change approval policy is separate from the existing one-operator release-promotion decision. Backend operations still avoid an admin UI, but now require production governance rather than unrestricted database access. Later product milestones remain deferred.

Historical ticket answers and pre-reconciliation records remain available under `.scratch/position-focus-guide/history/`. Current requirements take precedence. [Planning map](../.scratch/roadmap/map.md) · [Tracker conventions](agents/issue-tracker.md).
