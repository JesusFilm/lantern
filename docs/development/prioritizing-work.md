# Prioritizing work

The Priority field on the [Lantern project](https://github.com/orgs/JesusFilm/projects/17) orders open issues for engineering work and QA retests. The [roadmap](../ROADMAP.md) sets product direction; this guide orders the issue backlog. The owner can still name the next task directly.

## Priority levels

Judge each issue by its worst effect on a user and by who meets it now.

| Priority | Use when |
| --- | --- |
| Urgent | Production users are losing data, seeing data they should not, or cannot sign in or save, with no workaround. Fix it the day it is found, ahead of triage. |
| High | A released feature loses data or saves, shows or locks it wrongly, even with a workaround; or someone gets stuck on the cycle goal's path. |
| Medium | Released behavior is confusing or wrong but has a workaround, or the change clearly helps the cycle goal. |
| Low | Polish, layout, wording, consistency and nice-to-have features. |

Then adjust by one level:

- **Up** when the problem lets incorrect content be confirmed. Confirmed focuses cannot be edited or unlocked ([RC-08](../rules/review-and-confirmation.md#rc-08-confirmation-locks-the-agreement-and-discussion)); apply this while [RC-D1](../rules/review-and-confirmation.md#rc-d1-changing-a-confirmed-focus-mid-cycle) and [RC-D2](../rules/review-and-confirmation.md#rc-d2-recovering-from-an-accidental-confirmation) remain undecided.
- **Down** when the behavior is reachable only behind a flag that is not released in production. A flag is released when it is `on` for everyone in production ([feature flags](feature-flags.md#release-a-flagged-feature)). Treat it as released when an issue for that flag carries `flag: released` or the owner confirms it.

A bundled issue takes the priority of its most severe item. Split it when the other items deserve a lower priority and are worth tracking separately.

## Unranked issues

Leave Priority empty for:

- issues waiting on an owner or product decision, including deferred decisions. Add the `question` label, and set a priority once the decision is made.
- the Renovate Dependency Dashboard. Dependency updates follow their own review.

An empty Priority without `question` means the issue still needs triage.

Issues with a `qa:` label keep their priority, which sets QA's [retest order](qa-issue-workflow.md#hand-over-for-testing); a failed retest returns to engineering at the same priority. The project's **QA** tab lists these issues with their priority, and the **Backlog** tab groups the remaining open issues by priority.

## Cycle goal

Each two-week cycle has a one-sentence goal: what must be true by the next triage, for example "members can write, send and get their first focus confirmed without getting stuck." The owner records it in the Lantern project's README; read it with `gh project view 17 --owner JesusFilm --format json --jq .readme`. The goal decides the High and Medium criteria above that mention it. Ask the owner when no goal is recorded.

## Capacity

Keep High to about five issues. Keep High and Medium together close to the number of issues closed in the previous two weeks. When a level is full, compare a new issue with those already there and lower the weaker one.

## Triage routine

Every two weeks:

1. Close issues that reached `qa: passed`, following [engineering closure](qa-issue-workflow.md#engineering-closure). Track non-blocking notes in a new issue and triage it.
2. The owner sets the cycle goal and decides how much of the cycle goes to roadmap work that is not tracked as issues.
3. Triage every open issue that has neither a Priority nor the `question` label.
4. Review High issues still open from the last cycle and record why each remains. Close or merge Low issues passed over in three triages.
5. Check the capacity limits.

Between triages, whoever triages a new issue, including an agent, sets its Priority with this guide and states the reason in the issue or their report. The owner reviews these calls at the next triage. QA may suggest a priority in an issue description; the project field is authoritative.

## Choosing the next issue

Work High, then Medium, then Low, skipping issues waiting on QA or a decision. Within a level, prefer issues on the cycle goal's path. While working on an issue, also take cheap fixes on the same screen; the `area:` labels group issues by screen and feature.

## Reading and setting Priority

`gh` needs the `project` scope. The project ID, the Priority field ID and its option IDs come from:

```sh
gh project view 17 --owner JesusFilm --format json --jq .id
gh project field-list 17 --owner JesusFilm --format json
```

Then list items with their priority, add an issue missing from the board, or set a priority:

```sh
gh project item-list 17 --owner JesusFilm --limit 500 --format json
gh project item-add 17 --owner JesusFilm --url ISSUE_URL
gh project item-edit --project-id PROJECT_ID --id ITEM_ID --field-id PRIORITY_FIELD_ID --single-select-option-id OPTION_ID
```
