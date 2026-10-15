# Hosted team trial implementation breakdown

Original breakdown updated 15 October 2026 after Jaco confirmed trial priority, local/stage personal-account admission and checked automatic stage delivery followed by manual production promotion. [Decision record](issues/08-agree-delivery-priority.md). No new feature, CI or environment is implemented by this planning update.

## Current delivery decision — 16 October 2026

The immediate delivery is [hosting-only staging](issues/09-hosting-only-staging.md). Railway's existing environment is named `staging`; Lantern's application value remains `LANTERN_ENV=stage`. Deploy a known merged revision with login unavailable and protected access denied, verify hosting separately, and leave `STAGE_DELIVERY_ENABLED` unset/false. Hosting evidence does not complete authenticated smoke, ticket 05, or the team trial.

Authentication is deferred to [the bounded provider decision](issues/10-authentication-provider-decision.md). Jesus Film One is a candidate for investigation, not an approved replacement. Direct Google setup is paused and Lantern-owned passwords are not pursued. The Google-specific requirements below describe the existing implementation and original acceptance baseline; any replacement requires a recorded policy decision and revised acceptance before implementation.

Production remains inactive. Manual promotion needs a deliberate authorized operator action, not a second reviewer. [Promotion simplification](issues/11-simplify-manual-promotion.md) records the proposed latest-main selection and exact-revision evidence checks; it is not implemented by this planning update.

| Priority | Ticket | Readiness | Depends on |
| --- | --- | --- | --- |
| Now | [Hosting-only staging](issues/09-hosting-only-staging.md) | ready-for-agent | Hosted runtime; reviewed merged deployment revision |
| Deferred investigation | [Authentication provider decision](issues/10-authentication-provider-decision.md) | needs-info | Operator/provider interaction for live proof |
| Deferred improvement | [Simplify manual promotion](issues/11-simplify-manual-promotion.md) | needs-triage | Approved workflow change |
| First | [Hosted runtime, required CI and gated stage delivery](issues/04-hosted-runtime.md) | ready-for-agent; unblocked | None |
| Next; independently buildable | [Database-approved Google access](issues/01-approved-access.md) | ready-for-agent; unblocked | None |
| Then, as soon as foundations pass | [Railway environments, Google access and live release gates](issues/05-railway-environments.md) | ready-for-human; blocked | Approved access + hosted runtime |
| Alongside environment setup | [Lead member list and focus reading](issues/02-lead-member-focuses.md) | ready-for-agent; blocked | Approved access |
| After lead reading | [Initial confirmation and immutable lock](issues/03-confirm-and-lock.md) | ready-for-agent; blocked | Lead member list and focus reading |
| After setup and feature delivery | [Real-account stage QA and newcomer trial](issues/06-stage-verification.md) | ready-for-human; blocked | Lead reading + confirmation + environment setup |
| Last | [Same-revision production promotion and smoke](issues/07-production-promotion.md) | ready-for-human; blocked | Stage verification |

Hosting-only staging now takes priority. The original authenticated delivery sequence below resumes after ticket 10 establishes the provider and admission policy. Hosted runtime and approved-access foundations have merged; table readiness is the original specification state, not current live acceptance. Approved access can proceed independently without credentials; its policy now explicitly supports approved personal Google accounts locally/in stage while keeping production work-domain restrictions. Ready labels describe specification completeness; dependencies still block execution. No later product milestone has ready implementation tickets.

Local Google configuration, Jaco's stage lead/personal-member setup, QA enrollment, repository rules and live deployment gates belong to environment setup. Credentials, domains and emails are obtained privately when setup starts. Initial stage deployment need not wait for lead browsing/locking; full stage acceptance must include those features and their migrations in the verified revision. At least two member accounts are required for isolation evidence.

## Release path and verification

1. PR: required typecheck, browser/HTTP tests against isolated real PostgreSQL, and production build before merge.
2. Merged main revision: rerun checks; automatically deploy that exact SHA to stage only after success. Verify migrations/readiness, then automated stage smoke/E2E checks.
3. Stage acceptance: real Google lead/member sessions, newcomer workflow, privacy, persistence and immutable confirmation; bind automated and human evidence to the candidate SHA.
4. Production: explicit manual promotion of that exact verified revision, with backups/migration compatibility and production smoke evidence. Main merges never deploy production. Changed code returns through stage verification.

All application slices follow public-behavior TDD and preserve current data. Failed or absent checks prevent downstream deployment/promotion. A passing local suite is not proof that live repository/deployment gates or Google configuration work.

New review phases, unlock/copy/versioning, catch-up notes, administrators, multiple departments and notifications remain deferred. [Milestone](milestone.md) · [Specification](spec.md).
