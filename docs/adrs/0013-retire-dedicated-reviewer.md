# Retire the dedicated GitHub reviewer

Date: 2026-11-04

Status: Accepted by Jaco; administrative credential and App removal requires separate approval.

## Decision

Remove the dedicated Qwen GitHub review workflow, its harness and tests, and the harness CI job. Use the [change-review policy](../operations/review-gate.md) for current requirements. Preserve independent inspection and explicit owner authorization for protected changes. Delegated merge authority that depended on this reviewer remains on hold until Jaco agrees a replacement verification process.

## Rationale

[Trial PR #72](https://github.com/JesusFilm/lantern/pull/72) records intermittent response-format failures, including a one-line documentation change that produced no valid verdict. A separate valid verdict on [PR #50](https://github.com/JesusFilm/lantern/pull/50/checks?check_run_id=126275707105) missed the local storage compatibility issue associated with its PostgreSQL image upgrade. More parser and harness work would not establish useful review quality. Jaco chose retirement after reviewing this evidence.

## Consequences

The repository no longer maintains or calls this dedicated review service. Git history, trial PRs and existing check/comment records retain the experiment's evidence. Branch protection and normal CI/release checks retain their existing configuration. The owner must separately approve removal of the environment, dedicated keys and App access after other consumers are checked. Lantern's goal coach, LanternBot's contributor identity and shared Qwen/gateway infrastructure remain separate consumers.
