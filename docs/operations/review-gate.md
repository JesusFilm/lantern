# Independent review gate

Every pull request into `main` gets an automated review published as the required check **Independent review**. The check is the enforcement mechanism; it is not a formal pull request approval, and no formal approval or Code Owner review is required.

## How it works

[independent-review.yml](../../.github/workflows/independent-review.yml) runs on `pull_request_target`, so it executes the workflow and harness from `main`, never code from the pull request. It never checks out or runs pull request code. [tools/review](../../tools/review) mints a short-lived installation token for the **Lantern Independent Review** GitHub App (Checks write, Pull requests write, Contents read, this repository only), reads the change through the API, asks the AI gateway for a strict JSON verdict, and publishes the check on the exact head SHA.

- The check opens `in_progress`, then completes as `success` or `failure`. Neutral, skipped and cancelled are never produced, because GitHub treats some of them as passing.
- Fail closed: a missing, empty or oversized diff, unreviewable content (below), unreadable guidance, a gateway error or truncation, a malformed verdict, or a verdict with any blocker or major finding completes the check as `failure`. If the check cannot be opened or completed, the job fails and the required check stays unsatisfied.
- A new push gets a fresh review. The review is bound to a fixed range: the diff and file list are fetched from the compare API by the base SHA and head SHA read at the start (`base...head`), never from the moving pull request, so a push during the run cannot change what was reviewed. After the model answers, the harness re-reads the pull request; if the head is no longer the reviewed SHA, the pull request is closed, or the re-read fails, a passing verdict is discarded and the check completes as `failure` ("Head moved or could not be verified"). A head that moved and came back is accepted, because the reviewed content is addressed by SHA.
- **Unreviewable content fails closed before the model is called.** The diff text is cross-checked against GitHub's file list. Binary files, files with no patch, mode-only changes, files present in only one of the two, and file lists of 100 or more entries (possibly truncated) fail the check, and the summary lists them. The one explicit allowance is a pure rename with no content change (and an empty new or deleted file), which is disclosed to the model.
- **Context.** Trusted guidance is read from the base commit, never the head: `AGENTS.md` (required; a missing or unreadable file fails the check), then `CONTEXT.md`, `GLOSSARY.md` and `docs/development/testing.md` (a 404 is skipped, any other error fails), plus `docs/operations/review-gate.md` for protected paths, `docs/adrs/AGENTS.md` for ADR changes and `docs/operations/releasing.md` for workflow or operations changes. It goes in the system prompt, capped at about 30 KB per file and 60 KB in total. The full head content of each modified file (about 30 KB per file, 100 KB in total) goes in the untrusted user message; files left out are disclosed to the model and listed in the check. The prompt tells the model to report a major finding when the change cannot be judged from what it was given.
- Pull request title, description, diff and file contents are treated as untrusted in the prompt, each inside a block delimited by a per-request random token so pull request text cannot close the block. This reduces, but does not remove, prompt-injection risk; the verdict is advisory evidence plus a gate, not a proof of correctness.

## Pull request feedback

Besides the check, the harness leaves comments so the result is visible on the pull request. They never gate anything; the check does.

- **One summary comment**, found by a hidden marker and authored by the App, is edited in place on every run. It states the short head SHA, the verdict, the findings and a link to the check. When a new commit starts a run, the comment is first rewritten as "Reviewing `new`; the earlier verdict for `old` is superseded", then replaced with the new verdict.
- **At most 10 inline comments** in one review, only for blocker or major findings whose line is in the diff. Minor findings, findings with no location and findings outside the diff appear in the summary and the check only. A repeated run on the same commit does not repeat a comment.
- **Review event is always `COMMENT`.** The harness never sends APPROVE or REQUEST_CHANGES, never merges, and has no Contents write. A test enforces the endpoint allowlist and the event.
- Text from the model or the pull request is escaped (mentions, HTML, images, links, autolinks, issue references) and length-capped before it is published. This covers comments, the check summary and details, error messages that name pull request paths, and check annotations (messages capped at 1000 characters before escaping, with a title, only on lines in the diff, at most 50). If GitHub rejects the annotations, the check is completed again without them and says so.
- Every comment write first confirms the pull request is open and its head is the run's SHA. After the write the head is read again; if it moved and the comment still carries this run's SHA, it is rewritten as a neutral "Superseded: the head is now `new`; see the checks" notice. A comment already rebound to a different SHA is left alone. A run for a commit that is no longer the head publishes no comments. It still completes its own check on its own SHA.
- If a comment cannot be published, the check still reports the verdict and its summary says "Pull request feedback: could not be published" with the HTTP status. A comment failure never changes the verdict.

## Names

| Kind | Name | Where |
| --- | --- | --- |
| Environment | `ai-review` (deployment branch `main` only, no reviewers) | repository settings |
| Secret | `AI_REVIEW_APP_PRIVATE_KEY` | `ai-review` only, never repository-level |
| Secret | `AI_REVIEW_GATEWAY_API_KEY` | `ai-review` only |
| Variable | `AI_REVIEW_APP_ID` (`5571876`) | `ai-review` |
| Variable | `AI_REVIEW_GATEWAY_BASE_URL` (https, reachable from GitHub-hosted runners) | `ai-review` |
| Variable | `AI_REVIEW_MODEL` | `ai-review` |

## Changing the review mechanism

`.github/**`, `tools/review/**`, `tools/release/**` and this guide control the gate and releases; [review.mjs](../../tools/review/review.mjs) names them in the check summary. The repository has one owner and one authoring identity, so control comes from separation of keys and from where code runs, not from a second reviewer:

- The App signing key and gateway key live only in the `ai-review` environment (deployment branch `main` only). The authoring identity cannot read or set them, and a pull request cannot reach them.
- A pull request is always judged by the harness already on `main`, so a change to the gate cannot alter the review of itself. It takes effect only after merge.
- Before a protected-path change merges: an independent inspection by a separate reviewer (Codex) at the exact head SHA, re-done after any further commit, and the owner's explicit authorization to merge. Record both in the delivery audit.
- Existing branch protection, administrator enforcement and the required checks are unchanged by this guide.

## Enabling the gate (one time, in order)

1. Independent inspection of the gate pull request at its final head SHA; the owner authorizes the merge.
2. Merge the gate pull request (workflow, harness, tests, this guide). Do not require the check yet.
3. Owner enters the `ai-review` secrets and variables above.
4. Run the forgery test below on disposable branches, then a real pull request into `main`.
5. Add **Independent review** as a required check whose source is the GitHub App, not "any source".

## Forgery test (before step 5)

Any workflow on any branch with `checks: write` can post a passing check under the GitHub Actions identity onto any commit, so a requirement pinned to GitHub Actions can be forged. A requirement pinned to the App cannot be satisfied by that identity. Prove it on disposable base branches, with administrators included in the rules:

1. Base branch A requires a context pinned to GitHub Actions. From another branch, post a same-name success check with the workflow token onto a PR head. Expected: the PR becomes mergeable (baseline: the exposure is real).
2. Base branch B requires the same context pinned to the App. Repeat. Expected: the PR stays blocked and a merge attempt is refused.
3. On `main`, confirm the App's own check passes on a real PR head SHA and reports the App id and slug.
4. Confirm a branch workflow that requests `environment: ai-review` is denied, and that a new commit invalidates the earlier verdict.

Delete the disposable branches and rules afterwards.

## Limits

- The existing CI checks are pinned to the GitHub Actions identity and are, by the same mechanism, forgeable by anyone who can push a workflow. They are not protected by this gate.
- GitHub has no compare-and-swap for comments, so a short window remains between the head check and the write. The workflow's concurrency group, the pre-write check and the post-write repair narrow it; they do not close it. The check, not the comment, is the gate, and it is bound to a SHA.
- The diff is the compare of the base SHA read at the start against the head SHA. If `main` moves during a run, the diff can differ from the one against the newer base.
- The compare API's pagination and truncation behaviour is only partly verified; the harness fails closed at 100 files and on any mismatch between the diff text and the file list, and the first real run should confirm this.
- A model that is told its context was cut short may still approve; omitted context is disclosed, not enforced.
- Findings are de-duplicated per commit, so a new push can repeat an inline comment for the same text.
- Comment behaviour is unit-tested against a fake GitHub; the first real run confirms how GitHub renders and attributes the comments (including that the comment author is `lantern-independent-review[bot]`).
- Unit tests use a fake gateway: they prove harness logic, not model quality or gateway reachability.
- Rotate the App key and gateway key about yearly, or immediately after suspected exposure.
