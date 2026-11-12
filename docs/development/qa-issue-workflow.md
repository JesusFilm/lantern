# QA issue workflow

Use this workflow for tracked fixes and features, whether the work is done by a
person, a coding agent or LanternBot. The labels are GitHub issue labels; anyone
with permission to edit an issue can use them. QA records verification on the
issue. A release does not wait for QA's issue verification; the manual checks
required by [Releasing](../operations/releasing.md) still apply, including real
staging sign-in for auth, OAuth and admission-policy changes.

## Link the work

Keep the issue open until QA has verified it. In the PR description, reference
each tracked issue with `Refs #123`, rather than an automatic closing keyword.
Avoid closing keywords in the squash or merge commit message too. Add a
`## QA checks` section to the PR describing observable checks and relevant
feature flag names and settings when known. Do not guess settings or test steps.
For product changes, update the [QA manual](manual.md) as that guide requires.

```markdown
Refs #123

## QA checks
- Describe the steps and expected result for the change.
- Note the feature flag and any access or test data needed, when applicable.
```

## Hand over for testing

After the fix reaches production, confirm that the change is available to the
intended testers in the agreed environment: staging or production. For a flagged
feature that is not yet on, use production preview when testing in production.
Use the release evidence in [Releasing](../operations/releasing.md) to confirm
the fix is live in production and available in the agreed environment; a merge or
a submitted deployment alone does not establish availability. If a deployment
failed or was superseded, or a needed flag or account is unavailable or unknown
in the chosen environment, investigate before marking the issue ready.

When the check can be performed, add `qa: ready` and comment on the issue with
what changed, the PR, the environment, the relevant flag and its verified state
if known, and the checks to perform. Say when the production flag state is
unknown. Contributors can do this manually; LanternBot may perform the handoff
for work it handles, subject to its evidence and safety checks. Its current
automatic handoff checks staging availability; a production handoff
can be made manually after a person verifies access. Do not assume it handles
every PR.

## Record QA's result

Use one `qa:` status at a time; replace the previous status when changing it.
QA controls these statuses and closes the issue after a passing check.

| Label | Meaning |
| --- | --- |
| `qa: ready` | The change is available for the agreed check and QA has been given the environment and context to test it. |
| `qa: in progress` | QA is testing the change. |
| `qa: passed` | QA verified the change; QA can close the issue. |
| `qa: failed` | The check failed. QA comments with the result so a follow-up can be made. |
| `qa: blocked` | QA cannot complete the check. QA comments on the blocker. |

Use `found-by-qa` independently of the status labels for issues discovered by
QA. For a failed check, reference the same issue from the follow-up PR. After
the fix ships and availability in the agreed environment is confirmed, return
the issue to `qa: ready` with updated checks. For a blocker, return it to `qa: ready` once
the blocker is resolved and the check is available. A person may need to make
these transitions; do not assume automation will replace a QA-owned status.

## New features

New user-visible features follow the [feature flag policy](feature-flags.md):
they can ship hidden in production and be tested on staging or by selected
accounts in production preview. The owner tries the feature in production
preview before enabling it for everyone. Jaco normally decides when to enable
it for everyone after QA passes. QA's issue verification does not gate deployment
or production preview; the manual release checks described above still apply.
