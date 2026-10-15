# Accepted minimal position-focus baseline

Milestone: M01
Status: Closed baseline; supersedes the guide-only beta specification
Updated: 15 October 2026

## Purpose

Help members write and revisit position focuses containing objectives and SMART goals, with optional personal-development and leadership objectives. This specification records the accepted local application. It separates delivered behavior from the next [secure hosted team trial](../team-trial/spec.md).

## Accepted experience

- A dated, titled focus is selected from a list and opens in a compact read view.
- Focus metadata, objectives and SMART goals are edited in spacious dialogs. Multi-sentence content wraps comfortably.
- Add Objective visibly offers Normal, Personal Development and Leadership and defaults to Normal on every opening. These use the same objective/goal structure.
- Guidance is separate from authoring. Refine 4 side navigation renders Objectives, SMART goals and Example content to its right.
- The objective guide has three small steps; the SMART guide has five. Weak/strong examples are clearly distinguished and “Why it works” is prominent.
- The example is concise and generic: one objective and two goals. The removed illustrative-target subtitle stays removed.
- Account display-name edits persist. No prototype chooser, reset control, temporary-memory copy or seeded sample drafts appear in the application.

## Delivered persistence and access boundary

PostgreSQL persists focuses scoped to their owner and originating department. Server-resolved identity and active membership govern access. Members can access their own documents; career-lead reading of other members' focuses is **not yet implemented**. Ended memberships preserve data but end access.

Partial drafts may have no objectives or goals. Saves use optimistic versions; stale updates return a conflict and preserve dialog input. This numeric save version prevents overwrites and is not a user-visible cycle-history mechanism.

Google work-account/session and membership code exists with automated coverage. Live credentials and actual Google acceptance remain outstanding. The configured local walkthrough intentionally shares one local account, is disabled by default, requires loopback and is rejected in production mode. It must not be used as the hosted team authentication mechanism.

## Evidence and closure

Jaco accepted the minimal local application. Last reported checks on 15 October 2026: 39 passing tests plus typecheck, build and diff checks, using isolated real PostgreSQL schemas for browser/HTTP coverage. See [application verification](../../docs/system/position-focus-application.md).

M01 closes against this revised baseline. It does not claim successful live Google, newcomer or multi-user practical verification. Old [ticket 09](issues/09-verify-guide-through-practical-use.md) is superseded; relevant checks transfer to [M06 stage verification](../team-trial/issues/06-stage-verification.md).

## Scope changes

The accepted authoring experience expanded beyond the original guide-only beta. It intentionally simplified the previous mission banner, required gap/next-step teaching, review/timing instruction and full engineering example. Those historical requirements are not current UI acceptance criteria and must not be restored merely to satisfy old checked lists.

No request/submission pipeline, notes, review statuses, drafting/discussing/refining stages, automated notifications, schedule or broader administration is implied. Initial confirmation/locking, career-lead visibility, approved hosted access and Railway environments are [M06](../team-trial/milestone.md). Later phase changes belong to [M04](../position-focus-review/milestone.md).

## Traceability

- [Delivered ticket breakdown](breakdown.md)
- [Historical specification and tickets](history/2026-10-15-pre-team-trial/README.md)
- [Deferred candidates](deferred.md)
- [Current PRD](../../docs/PRD.md) and [roadmap](../../docs/ROADMAP.md)
- [Prototype journey](https://jacobuntu.tail5c6dbf.ts.net/lantern-prototypes/); retained worktree `/home/jacobuntu/Ops/worktrees/lantern-ui-prototypes`, branch `codex/lantern-ui-prototypes`

Historical decision answers 01–05 preserve how the plan evolved. This specification and the current PRD/M06 take precedence where later accepted scope differs.
