# Review feedback lifecycle

Besides the check, the harness leaves comments so the result is visible on the pull request. They never gate anything; the check does.

- **One summary comment per review run**, found by hidden markers for the head SHA and the check run id, and authored by the App. It states the short head SHA, verdict, findings and a link to the check. A run only ever writes the comment bound to its own SHA and run id and never edits another run's or commit's comment, so no delayed, cancelled, restored or rerun review can overwrite a newer verdict. A cancelled run leaves no comment.
- The check completes before verdict comments are published. Transport ambiguity and completion recovery are described in [completion details](#completion-details).

- **Each surface says what it omits.** The comment lists at most 30 findings fitting about 30,000 characters; the check text fits whole findings within 60,000 characters. Both report omissions and whether additional findings fit in the check. Findings may also appear in inline comments (at most 10) or annotations (at most 50); neither surface is a full listing. The check reports annotation overflow.

- **At most 10 inline comments** in one review, only for blocker or major findings whose line is in the diff. Minor findings, findings with no location and findings outside the diff appear in the summary and the check only. A repeated run on the same commit does not repeat a comment; concurrent runs are handled as described in the [gate limits](review-gate.md#limits).
- **Review event is always `COMMENT`.** The harness never sends APPROVE or REQUEST_CHANGES, never merges, and has no Contents write. A test enforces the endpoint allowlist.
- Model and pull request text is escaped and length-capped before publication. Cuts state the number of omitted characters. Finding messages retain up to 8,000 characters, annotations 1,000. If GitHub rejects annotations, the check is completed without them and the check and comment explain the resulting coverage.

- Every comment write first confirms the pull request is open and its head is the run's SHA. A run for a commit that is no longer the head publishes no comments but still completes its own check. Duplicates for the same run are rewritten to match. Comments for other SHAs or by other authors are never read as state or modified.
- If a comment cannot be published, the check still reports the verdict and its summary says "Pull request feedback: could not be published" with the HTTP status; if that note cannot be written either, only the job log says so. A comment failure never changes the verdict.


## Completion details

- **The check is completed before the comment says Passed or Requires changes.** After the review, the harness verifies the head, completes the check, and only after GitHub accepts that publishes the final comment, then appends a note about the comment to the completed check (retried once). If that update still fails, the job succeeds because the verdict is already recorded, and the job log carries a `::warning::` with the note and the status or network error. If the completion fails, the check is read back, but a read-back is only a point-in-time observation: a request that failed with a network error or a 5xx may still arrive and complete the check later. "Not completed, no verdict is recorded" is therefore written only when GitHub definitively refused every attempt (4xx) and the read-back shows the check still open. In any other case, including an open check after a transport failure or an unreadable check, the comment says "Outcome unconfirmed" and that GitHub may or may not record a verdict. Either way the job fails, and a comment never says Passed for a check that did not finish.
