Kind: ticket
ID: team-trial/14
Title: Make Railway deployment configuration reproducible
Milestone: M06
Type: task
Status: ready-for-agent
Blocked by: 04
Implementation: Staging transition and pre-deploy hook removal reported complete; bounded preflight in open PR #12; production preparation outstanding
Slice: Hosted team trial

---
## Outcome

Replace the assumption that uploading railway.json configures a new service with a reviewed, reproducible source of deployment settings and drift verification.

## Acceptance

- [ ] Review and merge PR #12's bounded preflight and sanitized setup evidence through normal review; passing CI is recorded, merge is not yet authorized/performed.
- [ ] Keep the effective build/start/health, environment identity, separate migration runner, restricted runtime and disabled source-trigger checks documented and verified on staging.
- [ ] Record the preflight's limits: configuration checks do not establish SQL grants or token isolation. Fix concrete failures without broadening this into a configuration-management project.
- [ ] Hand production-specific settings verification to 17/07 in the single release procedure.

IaC evaluation/import/adoption, automatic drift repair and additional deployment
frameworks are deferred and are not completion criteria for this ticket.

## Local preparation — 19 October 2026

The repository app configuration no longer contains a privileged pre-deploy command.
Migration runs separately via the built command with its own credential; scope and
readiness checks are prepared. Hosted settings may still contain the historical
hook. Removing a checked-in field does not prove a dashboard override is cleared.
Verify the actual runner's access path and effective app configuration during a
separately authorized staging transition before using the production procedure in 17.

## Boundary

Local preparation and tests were authorized on 19 October; hosted configuration, credentials and deployment still require separate authorization. The first staging crash was caused by absent effective migration/health settings; the successful manual recovery does not demonstrate reproducible deployment configuration.

## Hosted staging execution — 19 October 2026

Jaco authorized the staging continuation and delegated the Mac-side execution to
chat 01a1512a-7e60-7483-98e8-b7c719d95485. Revision
`3349636a031d86b90c534e71e4a02d416a8f7df7` passed CI run `39172627684` and was
built on the Mac. The staging app was stopped, three separate stage roles were
created, and the nine existing tables were transferred with unchanged row counts.
An intentionally incorrect inventory was rejected and rollback/source integrity
verified before the successful transfer. The separate migration login applied
version 3; migration, admin and runtime scope verification all passed. Runtime
DDL, ledger updates and approval deletion were denied with PostgreSQL 42501.

The staging-only environment patch removed the hosted pre-deploy migration hook.
The app now has only its runtime database URL, with no bootstrap/migration/admin
URL variables. Manual deployment `fc083756-f5e7-4936-8d1c-29e9bff5641d` succeeded;
public health returned 200 with the exact revision, deployment and schema 3.
Unauthenticated focus access returned 401, Google sign-in redirected to Google,
and the existing authenticated browser session survived reload. No backups were
created, no production execution occurred, and automatic staging delivery remains
disabled (the enabling repository variable is absent).

Evidence: [sanitized execution record](../../../docs/operations/staging-transition-2026-10-19.json).
Full authenticated release acceptance remains open: two ordinary-member Google
sessions, cross-member denial, enrollment, revocation and save/reload checks.
Production setup still requires separate human authorization/execution. These
results do not close the complete provider-isolation or application-launch gate.

## Deployment preflight review — 19 October 2026

[Draft PR #12](https://github.com/JesusFilm/lantern/pull/12) adds a read-only hosted
configuration preflight before upload, CLI-boundary regression tests, and
protected-main promotion checks. Live read-only staging checks passed with the
workflow-pinned CLI. New non-secret stage project/runtime-role variables are set;
automatic delivery remains disabled. Typecheck, build, 10 release tests and 8
ticket tests passed locally. At that checkpoint, merge review, IaC and production preparation were listed as outstanding. The subsequently approved simplification defers IaC and assigns production preparation to 17/07; PR review remains open. No deployment occurred in this slice.

## Adopted simplification — 19 October 2026

Jaco approved the simplification described in the [current breakdown](../breakdown.md). Use the revised acceptance above and the [manual release procedure](../../../docs/operations/hosted-release.md). Historical execution notes remain evidence, not instructions to repeat completed work. Production execution remains separately authorized; two-member acceptance stays parked.
