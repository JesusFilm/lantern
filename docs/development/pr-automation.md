# Automated PR handoff

Eligible routine pull requests enter LanternBot handling automatically, including drafts. The host waits for known active implementation jobs on the PR before adding the `lanternbot-fix` label and marking the draft ready for review. Sensitive changes, forks and opted-out PRs retain their existing exclusions.

Promotion requests a fresh independent review even when the same commit was reviewed while it was a draft. The reviewer publishes only while the PR is ready for review. Fixes continue through the existing isolated implementation, verification and review cycle.

A PR is ready to merge only when the current commit has an All clear review and every required GitHub check is successful. This does not grant automatic merge or release permission.

`fix #N` is an optional override; routine enrollment does not require it. `unfix #N` persists an opt-out. Returning an automatically promoted PR to draft pauses automation until explicitly re-enabled.

The workflow can wait for implementation jobs registered with Ops. It cannot detect unregistered work on an author's computer. New work still follows the configured weekday handling hours and existing fix budgets.
