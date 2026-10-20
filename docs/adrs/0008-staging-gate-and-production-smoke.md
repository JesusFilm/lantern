# Staging acceptance gate and minimal production verification

Date: 2026-10-21
Status: Accepted for release policy; optional authentication choices remain proposed

## Decision

Run bounded Playwright acceptance after staging deployment and readiness, alongside
existing CI coverage. Successful journeys AND cleanup for the exact deployed SHA,
CI run and attempt are required for automatic production promotion. Keep broad
mutation, failure-path and isolation testing on synthetic staging/local data.
This is functional acceptance, not a load or stress test against shared hosting.

Retain manual GitHub workflow dispatch with an explicit main SHA as an engineer's
intentional override of authenticated acceptance. It must still require successful
build/type/database checks and staging deployment/readiness for that SHA. A failed
Playwright or cleanup step must block automatic promotion without making the
manual override impossible. Manual dispatch must not require disabling acceptance
or rerunning migrations merely to manufacture a successful parent CI run.

Use built-in GitHub Actions notifications and run results. Engineers configure
their own Actions notification preferences and own investigation and recovery.
No Slack/email integration, custom incident system, durable failure latch or
automatic rollback is included. After a production smoke failure, the engineer
must disable automatic promotion and cancel queued runs if further releases
should stop; the current workflow does not impose that persistent stop itself.

Keep production verification to bounded readiness smoke initially: exact release,
deployment/schema, health/database readiness, rendered login screen, JavaScript
errors and anonymous access denial. Do not create synthetic focuses, departments,
initiatives or a production cleanup service. Production remains the team's single
real department. This supersedes the cross-environment workspace proposal in
[ADR 0007](0007-isolated-system-test-accounts.md); no production password login is
approved by this decision.

## Workflow mechanism

The existing `Lantern CI` workflow runs staging acceptance inside its stage job.
The production workflow listens for `workflow_run: completed` on main and admits
only a successful trusted push run with both opt-in switches enabled. Admission
checks exact run/attempt evidence before accessing the production environment;
the production job repeats verification under its concurrency lock and rechecks
freshness before migration. Required production environment reviewers still apply.
The same workflow accepts `workflow_dispatch` for manual SHA promotion.
Schema-changing automatic releases remain excluded under ADR 0006.

## Failure and triage

Staging failures leave production unchanged and provide no automatic acceptance.
Inspect the failed Actions step and safe checkpoint output; distinguish a product
regression, infrastructure failure and cleanup failure. Fix regressions by PR;
rerun infrastructure failures only after investigation. Investigate unexpected
fixture ownership without widening deletion scope. Do not silently retry failed
assertions until green. Built-in notifications depend on each engineer's settings;
no guaranteed paging or acknowledgement is claimed.

A production smoke failure fails the deployment workflow AFTER deployment; it
cannot undo that deployment. The engineer assesses impact, pauses automation if
needed, and decides fix-forward or manual recovery. No automatic rollback,
migration reversal or custom incident acknowledgement workflow is added.

## Open choices and implementation gaps

- Optional authenticated production smoke remains proposed. A synthetic login is
  still an account/session and an authentication surface. An unassigned account
  verifies little beyond session/waiting UI; a member in the real department can
  see real shared direction and has write-capable permissions. Browser tests that
  issue only reads do not make stolen credentials read-only. Do not add an extra
  department, seeded business records or a new permission model without agreement.
  Start with readiness and retain human Google-login acceptance for auth changes.
- Permanent staging password accounts remain an optional convenience for manual
  testing. Existing code uses private temporary sessions; it does not implement
  password login. Choose that convenience separately from the promotion gate.
- Current manual verification searches only successful whole CI runs, and readiness
  upload follows acceptance. This must be reconciled with the approved override:
  independently preserve and verify successful prerequisite/readiness evidence even
  when acceptance fails, without allowing failed builds/deployments to be bypassed.

## Rationale and consequences

The production-isolated workspace proposal adds account types, row security,
control credentials, recovery scheduling and cleanup obligations disproportionate
to the current internal single-team tool. Keeping destructive journeys in staging
avoids those production changes. Readiness cannot prove authenticated rendering,
real Google sign-in or every production data condition; those limits are explicit.
The existing exact-revision and cleanup guarantees remain necessary, not optional.
