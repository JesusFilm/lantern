# Independent review gate

Every pull request into `main` gets an automated review published as the required check **Independent review**. The check is the enforcement mechanism; it is not a formal pull request approval, and no formal approval or Code Owner review is required.

## How it works

[independent-review.yml](../../.github/workflows/independent-review.yml) runs on `pull_request_target`, so it executes the workflow and harness from `main`, never code from the pull request. It never checks out or runs pull request code. [tools/review](../../tools/review) mints a short-lived installation token for the **Lantern Independent Review** GitHub App (Checks write, Pull requests write, Contents read, this repository only), reads the change through the API, asks the AI gateway for a strict JSON verdict, and publishes the check on the exact head SHA.

- The check opens `in_progress`, then completes as `success` or `failure`. Neutral, skipped and cancelled are never produced, because GitHub treats some of them as passing.
- Fail closed: a missing, empty or oversized diff, unreviewable content (below), unreadable guidance, a gateway error or truncation, a malformed verdict, or a verdict with any blocker or major finding completes the check as `failure`. If the check cannot be opened or completed, the job fails and the required check stays unsatisfied.
- A new push gets a fresh review. The review is bound to a fixed range: the diff and file list are fetched from the compare API by the base SHA and head SHA read at the start (`base...head`), never from the moving pull request, so a push during the run cannot change what was reviewed. After the model answers, the harness re-reads the pull request; if the head is no longer the reviewed SHA, the pull request is closed, or the re-read fails, a passing verdict is discarded and the check completes as `failure` ("Head moved or could not be verified"). A head that moved and came back is accepted, because the reviewed content is addressed by SHA.
- **Unreviewable content fails closed before the model is called.** The diff text is cross-checked against GitHub's file list, which is fetched separately. For every file the hunks sent to the model must match the patch GitHub lists, and the additions, deletions and total must equal the counts GitHub lists, so a diff cut between complete hunks, or altered, cannot pass. The match is strict on structure (same number of patch lines, same kind of each line, identical hunk headers, identical counts) and compares the text of each line after removing control, format, line-separator, private-use and unassigned characters and U+FFFD, because GitHub's two representations of one patch can render those invisible characters differently (a regular expression containing Unicode control escapes did). Anything visible, any omitted hunk and any count difference still fails, and the failure names the first differing patch line so a real mismatch can be diagnosed. Binary files, files with no patch, any file mode change (including a rename or edit that also changes the mode, such as an executable-bit change), files present in only one of the two, and file lists of 100 or more entries (possibly truncated) fail the check, and the summary lists them. A chmod-only or rename-with-chmod change therefore cannot pass this gate and needs the owner's explicit decision outside it. The explicit allowances are a pure rename with no content change and no mode change, and an empty new or deleted file (all counts zero), which are disclosed to the model. A newly created executable file is reviewed normally.
- **Context, and when it is sufficient.** Trusted guidance is read from the base commit, never the head: `AGENTS.md` (required; a missing or unreadable file fails the check), then `CONTEXT.md`, `GLOSSARY.md` and `docs/development/testing.md` (a 404 is skipped, any other error fails), plus `docs/operations/review-gate.md` for protected paths, `docs/adrs/AGENTS.md` for ADR changes and `docs/operations/releasing.md` for workflow or operations changes. It goes in the system prompt, at most 30,000 characters per file and 60,000 in total. The complete head content of every modified file (at most 60,000 characters per file and 150,000 in total) goes in the untrusted user message. Context is sufficient only when all guidance and the complete head file of every modified file were provided without clipping. If any is omitted or clipped, the check fails as "Insufficient context" before the model is called, lists the files, and approves nothing, whatever a model could say. Files the change depends on but does not modify (callers, authorization helpers elsewhere) are not provided and this is not enforced; the model is told so, and a reviewer should treat cross-file effects as unassessed. In this repository 4 of 225 tracked files exceed 30,000 characters and none exceed 60,000. A test measures the real files the gate is made of (`tools/review`, the workflow and this guide, plus the trusted guidance) with the same loader: each must stay under two thirds of its limit, all gate files together under 90% of the total, so one more edit can never make a file unreviewable. Split a file before it nears the limit; a file that is over it cannot be changed through this gate at all.
- Pull request title, description, diff and file contents are treated as untrusted in the prompt, each inside a block delimited by a per-request random token so pull request text cannot close the block. This reduces, but does not remove, prompt-injection risk; the verdict is advisory evidence plus a gate, not a proof of correctness.

## Pull request feedback

Besides the check, the harness leaves comments so the result is visible on the pull request. They never gate anything; the check does.

- **One summary comment per head SHA**, found by a hidden marker and authored by the App. It states the short head SHA, the verdict, the findings and a link to its own check run. Comments are append-only per SHA: a run only ever writes the comment bound to its own SHA (found by id) and never edits another commit's comment, so no delayed or restored run can overwrite a newer verdict. Each comment says it applies to that commit only and that a new push gets its own comment.
- **The check is completed before the comment says Passed or Requires changes.** After the review, the harness verifies the head, completes the check, and only after GitHub accepts that publishes the final comment, then appends a note about the comment to the completed check on a best-effort basis (a failure of that last update is ignored). Until then the comment says Reviewing. If GitHub rejects the completion, the comment is rewritten to "Not completed, no verdict is recorded", the job fails and the required check stays unsatisfied, so a comment can never say Passed for a check that did not finish. A comment is the only thing that can fail to appear; the check is the verdict.
- **At most 10 inline comments** in one review, only for blocker or major findings whose line is in the diff. Minor findings, findings with no location and findings outside the diff appear in the summary and the check only. A repeated run on the same commit does not repeat a comment.
- **Review event is always `COMMENT`.** The harness never sends APPROVE or REQUEST_CHANGES, never merges, and has no Contents write. A test enforces the endpoint allowlist and the event.
- Text from the model or the pull request is escaped (mentions, HTML, images, links, autolinks, issue references) and length-capped before it is published. This covers comments, the check summary and details, error messages that name pull request paths, and check annotations (messages capped at 1000 characters before escaping, with a title, only on lines in the diff, at most 50). If GitHub rejects the annotations, the check is completed again without them and says so.
- Every comment write first confirms the pull request is open and its head is the run's SHA. A run for a commit that is no longer the head publishes no comments; it still completes its own check on its own SHA. Same-SHA duplicates are rewritten to match. Comments for other SHAs and by other authors are never read as state or modified.
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
- GitHub has no compare-and-swap for comments, so a run cannot safely edit a comment it did not write: a re-read before the write only narrows the window. Therefore an older commit's comment is never collapsed or repaired. The cost is clutter: every push leaves its own comment, and a comment for an older SHA (including a "Reviewing" left by a cancelled run) stays as it was, always labelled with its own SHA and never claiming to describe a newer head. A reader must compare the SHA in the comment with the pull request head. Duplicates created concurrently after a run listed the comments are not handled; the workflow's concurrency group makes this very unlikely. The check, not the comment, is the gate, and it is bound to a SHA.
- The diff is the compare of the base SHA read at the start against the head SHA. If `main` moves during a run, the diff can differ from the one against the newer base.
- The compare API's pagination and truncation behaviour and the equality of GitHub's listed patch with the diff-media-type hunks are only partly verified. A captured real compare (`tools/review/fixtures`) passes and its altered or truncated variants fail, but a mismatch reported by an independent reviewer for the same range could not be reproduced with read-only requests; the comparison therefore ignores invisible characters and the failure names the differing line. Any other difference fails closed, so a systematic mismatch would make every PR fail; the first real run should confirm both.
- Only the modified files are provided in full. A model that reviews a change whose safety depends on an unmodified file can still approve; this is disclosed, not enforced.
- Findings are de-duplicated per commit, so a new push can repeat an inline comment for the same text.
- Comment behaviour is unit-tested against a fake GitHub; the first real run confirms how GitHub renders and attributes the comments (including that the comment author is `lantern-independent-review[bot]`).
- Unit tests use a fake gateway: they prove harness logic, not model quality or gateway reachability.
- Rotate the App key and gateway key about yearly, or immediately after suspected exposure.
