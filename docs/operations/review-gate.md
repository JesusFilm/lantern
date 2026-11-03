# Independent review gate

Every pull request into `main` gets an automated review published as the required check **Independent review**. The check gates merging; it is not formal approval.

## How it works

[independent-review.yml](../../.github/workflows/independent-review.yml) runs on `pull_request_target`, so it executes the workflow and harness from `main`, never code from the pull request. It never checks out or runs pull request code. [tools/review](../../tools/review) mints a short-lived installation token for the **Lantern Independent Review** GitHub App (Checks write, Pull requests write, Contents read, this repository only), reads the change through the API, asks the AI gateway for a strict JSON verdict, and publishes the check on the exact head SHA.

- The check opens `in_progress`, then completes as `success` or `failure`; neutral, skipped and cancelled are never produced.
- Fail closed: a missing, empty or oversized diff (over 2,000,000 bytes), unreviewable content (below), unreadable guidance, a gateway error or truncation, a malformed verdict, or a verdict with any blocker or major finding completes the check as `failure`. If the check cannot be opened or completed, the job fails.
- **Triggers.** A pull request opened, reopened, marked ready for review or retargeted to `main` is reviewed, as is every push. Retargeting emits `pull_request_target` `edited` with `changes.base`, which the workflow subscribes to; an `edited` event without a base change (a title or body edit) starts no review, and its concurrency group is unique to that run so it cannot cancel a review in progress. A pull request retargeted away from `main` is not reviewed. `tools/review/workflow.test.mjs` evaluates the workflow's own expressions for each event.
- A new push gets a fresh review. The review is bound to a fixed range: the diff and file list are fetched from the compare API by the base SHA and head SHA read at the start (`base...head`), never from the moving pull request, so a push during the run cannot change what was reviewed. After the model answers, the harness re-reads the pull request; if the head is no longer the reviewed SHA, the pull request is closed, or the re-read fails, a passing verdict is discarded and the check completes as `failure` ("Head moved or could not be verified").
- **Unreviewable content fails closed before the model is called.** The diff is read as raw bytes and decoded as strict UTF-8; a diff containing NUL bytes or invalid UTF-8 is rejected, because decoding with replacement could turn corrupted content into text the model approves (a genuine U+FFFD character is valid UTF-8 and is accepted). The diff text is cross-checked against GitHub's file list, which is fetched separately. For every file, additions/deletions must match GitHub's separately listed counts. Exact patch text remains the fast path, including invisible characters. When hunk layouts differ, both patches must independently reproduce the complete pinned head from the compare API's immutable merge-base content. The proof checks coordinates, counts, context, edits, unchanged gaps/tail, CRLF and final-newline state; omitted edits or altered text fail. Missing merge-base/source evidence fails closed. Proof reads are limited to 2,000,000 bytes per file and 4,000,000 total. No source is executed; successful layout proofs are disclosed in the check. Except for the generated manual artifacts described below, binary files, files with no patch, any file mode change (including a rename or edit that also changes the mode), files present in only one of the two, and file lists of 100 or more entries (possibly truncated) fail the check, and the summary lists them. Such a change needs the owner's decision outside this gate. The only allowances are a pure rename (no content or mode change) and an empty new or deleted file, both disclosed to the model. A pure rename has no patch, so its full head content is provided like any modified file, with the same size checks and a failure if it is unavailable: a dormant file moved into `.github/workflows/` is reviewed as new content.
- **Generated manual artifacts.** Ordinary binary additions or modifications of `docs/manual/lantern-manual.pdf` and direct `docs/manual/screenshots/*.png` files (names start with an ASCII letter or digit and otherwise use ASCII letters, digits, dots, underscores or hyphens) are excluded from model assessment only when their file signature and SHA-256 match the head revision’s `docs/manual/manifest.json`. The check lists each excluded file and the checks performed. Renames, deletions, mode changes, unsupported paths, missing or mismatched hashes and other binaries fail closed; source, manifest and text changes still receive ordinary review. The manifest is editable, so matching it is consistency evidence, not independent proof of generation or safety. Neither this check nor `manual:check` regenerates or visually reviews the manual; authors and reviewers remain responsible for visual verification.
- **Context sufficiency.** Guidance comes from the base commit: required `AGENTS.md`, optional `CONTEXT.md`, `GLOSSARY.md`, testing and conditional operations/ADR guides. Missing optional files are skipped; other read failures block. Guidance is limited to 30,000 characters per file and 60,000 total. Complete modified head files (including pure renames) are limited to 60,000 characters each. Added files are already complete in the diff; their head content is separately validated without repetition. All reads use strict UTF-8 and reject NUL bytes. Missing, binary, invalid or clipped context fails before inference. Head content remains untrusted. Files are loaded independently, then distributed across packets; the loader retains its 200,000-character default aggregate limit for other callers. Tests preserve per-file headroom and verify that all gate files can be packeted completely.
- **Parallel review.** The trusted harness assigns every assessable diff section and its complete head context to exactly one packet, keeping files whole. Packets reserve space for guidance, PR metadata and framing within a 200,000-byte planning budget. Limits: 20 packets, three concurrent requests, 300,000 bytes per actual prompt and 60 seconds per gateway request. Oversized files or prompts fail incomplete without clipping. The workflow timeout is 30 minutes.
- **Integration and verdict.** Multiple packets require an additional integration review containing raw changed implementation and specification diffs/full head context across packets, the complete changed-text path inventory and untrusted worker verdicts. Tests, fixtures and other prose remain worker-assessed only; unmodified dependencies can be requested. If the integration input cannot fit, the check fails incomplete. Every packet and integration must approve with no major/blocker finding. A rejection without findings still blocks; aggregation and exact duplicate removal cannot clear it. The summary reports text-file coverage, chunk count and integration completion. Existing artifact exclusions remain separately disclosed.

- Pull request title, description, diff and file contents are untrusted in the prompt, each inside a block delimited by a per-request random token that pull request text cannot close. This reduces, but does not remove, prompt-injection risk.


## Context retrieval and reruns

Reviewers may return `{"request_context":["path"]}` instead of a verdict. The harness fetches complete repository files at the pinned head through the API and supplies them as untrusted data. Limits: two rounds per reviewer, eight paths per round, sixteen distinct files and 200,000 retrieved UTF-8 bytes per run, plus existing per-file/prompt limits. Unsafe paths, missing or clipped contents, repeated requests or exhausted limits fail incomplete. No PR code executes. Other unmodified dependencies remain unassessed.

Use Actions → Independent review → Run workflow on `main`, supplying `pr_number`, to review the current head without a new commit. Only open, non-draft PRs targeting `main` are eligible. Manual and automatic runs share PR concurrency; final head verification still applies. Pushes continue to trigger reviews. Replying to or resolving a thread does not trigger review or clear a check. Resolve verified findings after replying with evidence; retain uncertain findings. The CLI exits unsuccessfully after publishing a failed App verdict; the App check remains authoritative.

## Response diagnostics

Actions logs include `[review-response]` records identifying each chunk or integration
review and its one-based retrieval round. Records include the outcome, allowlisted
gateway stop reason, text-block count, output-token count when supplied, response
byte count and a bounded structural sketch after the parser’s supported thinking
blocks and code fences are removed. Words and string values are omitted;
raw responses, prompts and credentials are never logged. An unclosed string or extra
text can therefore be distinguished without publishing model output. These records
are diagnostic evidence only: parsing and approval rules remain unchanged. If a
failure remains ambiguous, do not infer its cause from the sketch.

## Pull request feedback

Each run publishes its own SHA-bound summary after completing its App check, plus bounded inline findings. Comments do not gate merging. See [feedback lifecycle and limits](review-feedback.md) for publication, retry, omission and isolation rules.

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

`.github/**`, `tools/review/**`, `tools/release/**` and this guide control the gate and releases; [review.mjs](../../tools/review/review.mjs) names them in the check summary. With one owner and one authoring identity, control comes from separation of keys and where code runs, not a second reviewer:

- The App signing key and gateway key live only in the `ai-review` environment (deployment branch `main` only). The authoring identity cannot read or set them, and a pull request cannot reach them.
- A pull request is always judged by the harness already on `main`, so a change to the gate cannot alter the review of itself. It takes effect only after merge.
- Before a protected-path change merges: an independent inspection by a separate reviewer (Codex) at the exact head SHA, re-done after any further commit, and the owner's explicit authorization to merge. Record both in the delivery audit.
- Branch protection, administrator enforcement and the required checks are unchanged by this guide.

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
- GitHub has no compare-and-swap for comments, so a run cannot safely edit a comment it did not write: a re-read before the write only narrows the window. The cost is clutter: every push and rerun leaves its own comment, labelled with its SHA and run id; a reader compares the SHA with the head and reads the check status. Concurrent creation of two comments for one run is not prevented; the concurrency group makes it unlikely. The check, not the comment, is the gate.
- If `main` moves during a run, the reviewed diff can differ from the one against the newer base.
- The compare API's truncation behaviour and the equality of the listed patch with the diff hunks are only partly verified: a captured real compare (`tools/review/fixtures`) passes and altered variants fail. A systematic mismatch would fail every PR closed.
- Listings (comments, review comments) are read up to 30 pages of 100, so 3,000 items; a listing that fills all 30 pages is treated as possibly truncated. With more than 3,000 comments the summary comment cannot be located safely, so none is written and the check says so. With more than 3,000 review comments the inline findings are still posted, but duplicates cannot be checked or removed and the check says so. The verdict is never affected.
- Inline findings are de-duplicated per commit, so a new push can repeat an inline comment for the same text. Concurrent runs of one commit can both post the same finding, because listing and posting are not atomic and cancelling a run does not stop a request already sent. Afterwards each run deletes its own copies that are not the oldest. This is best effort, not exactly-once: it relies on GitHub listing consistently, a removed copy leaves its review body behind, and a failed cleanup is reported in the check.
- Only the modified files are provided in full. A model that reviews a change whose safety depends on an unmodified file can still approve; this is disclosed, not enforced.
- Comment behaviour is tested only against a fake GitHub; the first real run confirms rendering and that the author is `lantern-independent-review[bot]`.
- Tests use a fake gateway: they prove harness logic, not model quality.
- Rotate the App key and gateway key about yearly, or at once after suspected exposure.
