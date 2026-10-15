# M06 implementation breakdown

Prepared 15 October 2026 from Jaco's narrowed trial requirements and confirmed choices: lead confirms/locks; exact Google email approvals are managed directly in the database. No new feature is implemented by this planning increment.

| Ticket | Work | Readiness | Depends on |
| --- | --- | --- | --- |
| [01](issues/01-approved-access.md) | Database-approved Google access | ready-for-agent | None |
| [02](issues/02-lead-member-focuses.md) | Lead member list and focus reading | ready-for-agent | 01 |
| [03](issues/03-confirm-and-lock.md) | Initial confirmation and immutable lock | ready-for-agent | 02 |
| [04](issues/04-hosted-runtime.md) | Hosted runtime, migrations and release checks | ready-for-agent | None |
| [05](issues/05-railway-environments.md) | Isolated Railway stage/prod and real Google setup | ready-for-human | 01, 04 |
| [06](issues/06-stage-verification.md) | Real-account stage QA and newcomer trial | ready-for-human | 02, 03, 05 |
| [07](issues/07-production-promotion.md) | Same-revision production promotion and smoke | ready-for-human | 06 |

The first unblocked feature ticket is 01. Ticket 04 can proceed in parallel; no real credentials are needed for either implementation. Ready-for-agent tickets with dependencies remain blocked until those dependencies resolve. Later code/lock migrations must be included in the exact stage revision verified by 06, even if initial environment setup happened earlier.

All application slices follow TDD at public HTTP/browser boundaries with isolated real PostgreSQL. Keep architecture and data scope from AGENTS.md. Operator setup/live acceptance is explicit rather than falsely AFK-ready. Actual environment/account inputs are private and requested only when the relevant setup work starts.

New review phases, unlock/copy/versioning, catch-up notes, administrators, multiple departments and notifications remain outside this breakdown. [Milestone](milestone.md) · [Specification](spec.md) · [Deferred register](../position-focus-guide/deferred.md).
