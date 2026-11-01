# Independent review gate

Every pull request into `main` gets an automated review published as the required check **Independent review**. The check is not a formal pull request approval and does not replace a human code owner for protected paths.

## How it works

[independent-review.yml](../../.github/workflows/independent-review.yml) runs on `pull_request_target`, so it executes the workflow and harness from `main`, never code from the pull request. It never checks out or runs pull request code. [tools/review](../../tools/review) mints a short-lived installation token for the **Lantern Independent Review** GitHub App (Checks write, Pull requests read, Contents read, this repository only), reads the diff through the API, asks the AI gateway for a strict JSON verdict, and publishes the check on the exact head SHA.

- The check opens `in_progress`, then completes as `success` or `failure`. Neutral, skipped and cancelled are never produced, because GitHub treats some of them as passing.
- Fail closed: a missing, empty or oversized diff, a gateway error or truncation, a malformed verdict, or a verdict with any blocker or major finding completes the check as `failure`. If the check cannot be opened or completed, the job fails and the required check stays unsatisfied.
- A new push gets a fresh review. A verdict is posted only if the PR is open and its head still equals the SHA that triggered the run.
- Pull request title, description and diff are treated as untrusted in the prompt. This reduces, but does not remove, prompt-injection risk; the verdict is advisory evidence plus a gate, not a proof of correctness.

## Names

| Kind | Name | Where |
| --- | --- | --- |
| Environment | `ai-review` (deployment branch `main` only, no reviewers) | repository settings |
| Secret | `AI_REVIEW_APP_PRIVATE_KEY` | `ai-review` only, never repository-level |
| Secret | `AI_REVIEW_GATEWAY_API_KEY` | `ai-review` only |
| Variable | `AI_REVIEW_APP_ID` (`5571876`) | `ai-review` |
| Variable | `AI_REVIEW_GATEWAY_BASE_URL` (https, reachable from GitHub-hosted runners) | `ai-review` |
| Variable | `AI_REVIEW_MODEL` | `ai-review` |

## Protected paths and human review

`.github/**`, `tools/review/**`, `tools/release/**`, `CODEOWNERS` and this guide control the gate and releases. The AI check is not sufficient for them: a human code owner other than the pull request author must approve. [review.mjs](../../tools/review/review.mjs) lists these paths in the check summary.

## Enabling the gate (one time, in order)

1. Require one approval, dismiss stale approvals and require approval of the most recent push on `main`.
2. Merge a pull request that adds only `CODEOWNERS` (owners are a named human decision), approved by a code owner.
3. Require Code Owner review.
4. Merge the gate pull request (workflow, harness, tests, this guide) with the same approval. Do not require the check yet.
5. Enter the environment secrets and variables above.
6. Run the forgery test below on disposable branches, then a real pull request into `main`.
7. Add **Independent review** as a required check whose source is the GitHub App, not "any source".

## Forgery test (before step 7)

Any workflow on any branch with `checks: write` can post a passing check under the GitHub Actions identity onto any commit, so a requirement pinned to GitHub Actions can be forged. A requirement pinned to the App cannot be satisfied by that identity. Prove it on disposable base branches, with administrators included in the rules:

1. Base branch A requires a context pinned to GitHub Actions. From another branch, post a same-name success check with the workflow token onto a PR head. Expected: the PR becomes mergeable (baseline: the exposure is real).
2. Base branch B requires the same context pinned to the App. Repeat. Expected: the PR stays blocked and a merge attempt is refused.
3. On `main`, confirm the App's own check passes on a real PR head SHA and reports the App id and slug.
4. Confirm a branch workflow that requests `environment: ai-review` is denied, and that a new commit invalidates the earlier verdict.

Delete the disposable branches and rules afterwards.

## Limits

- The existing CI checks are pinned to the GitHub Actions identity and are, by the same mechanism, forgeable by anyone who can push a workflow. They are not protected by this gate.
- Unit tests use a fake gateway: they prove harness logic, not model quality or gateway reachability.
- Rotate the App key and gateway key about yearly, or immediately after suspected exposure.
