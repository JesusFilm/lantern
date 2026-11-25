# Prioritizing work

The Priority field on the [Lantern project](https://github.com/orgs/JesusFilm/projects/17) orders open issues for engineering work and QA retests. Priority follows user impact; the triage goal decides what rises within it.

## Priority levels

Judge each issue by its worst effect on a user and by who meets it now.

| Priority | Use when |
| --- | --- |
| Urgent | Production users are losing data, seeing data they should not, or cannot sign in or save, with no workaround. Fix it the day it is found, ahead of triage. |
| High | A released feature loses data or saves, shows or locks it wrongly, even with a workaround; or someone gets stuck on the triage goal's path. |
| Medium | Released behavior is confusing or wrong but has a workaround, or the change clearly helps the triage goal. |
| Low | Polish, layout, wording, consistency and nice-to-have features. |

Then adjust by one level:

- **Up** when the problem lets incorrect content be confirmed, until confirmed focuses can be corrected. Confirmation currently locks a focus with no unlock or recovery ([RC-08](../rules/review-and-confirmation.md#rc-08-confirmation-locks-the-agreement-and-discussion)).
- **Down** when the behavior is reachable only behind a flag that is `off` or `preview` in production, until the owner plans its release. The owner's [flag page](feature-flags.md#inspect-the-current-state) shows the production state, and `flag: released` on an issue for that flag shows it is on. Ask the owner when the state is unknown.

Split a bundled issue when one item outranks the rest; until it is split, it takes the priority of its most severe item.

## Unranked issues

Leave Priority empty for:

- issues waiting on an owner or product decision, including deferred decisions. Add the `question` label, and set a priority once the decision is made.
- the Renovate Dependency Dashboard. Dependency updates follow their own review.

An empty Priority without `question` means the issue still needs triage.

## Issues with QA

Issues with a `qa:` label keep their priority, which sets QA's [retest order](qa-issue-workflow.md#hand-over-for-testing). A failed retest returns to engineering at the same priority. The project's **QA** tab lists these issues with their priority, and the **Backlog** tab groups the remaining open issues by priority. QA may suggest a priority in an issue description; the project field is authoritative.

## Triage goal

The triage goal is one sentence: what must be true by the next triage, for example "members can write, send and get their first focus confirmed without getting stuck." The owner records it in the Lantern project's README; read it with `gh project view 17 --owner JesusFilm --format json --jq .readme`. The High and Medium criteria that mention the triage goal depend on it, so ask the owner when none is recorded.

## Capacity

Keep High to about five issues, and High and Medium together close to the number of issues closed since the previous triage.

## Triage routine

The owner triages periodically, as the backlog grows. At each triage:

1. Run [engineering closure](qa-issue-workflow.md#engineering-closure) for issues at `qa: passed`.
2. The owner sets the triage goal and decides what share of the work until the next triage goes to roadmap work that is not tracked as issues.
3. Triage every open issue that has neither a Priority nor the `question` label. Clear the Priority and add `question` on any issue now waiting on a decision.
4. Ask why each open High issue is still open, and decide whether it stays High. Close or merge Low issues without a `qa:` label that have stayed Low through three triages.
5. Check the capacity limits, and raise any level over its limit with the owner.

Between triages, whoever triages a new issue, including an agent, sets its Priority with this guide and states the reason in their report. The owner reviews these calls at the next triage.

## Choosing the next issue

When the owner has not named the next task, work Urgent, then High, Medium and Low, skipping issues waiting on QA or a decision. Within a level, prefer issues on the triage goal's path. While working on an issue, also take cheap fixes on the same screen; the `area:` labels group issues by screen and feature.

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
