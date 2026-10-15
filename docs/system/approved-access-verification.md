# Approved Google access verification

Implementation branch: `codex/approved-google-access`, based on `origin/main` at `ef74bcbb9172094b694132838bd1ab71dc9129bd`.

## Automated evidence

Verified with Node 24.21.0 and real PostgreSQL in unique, disposable schemas. The primary checkout remained clean and its data/services were preserved. No real Google client, participant approval or deployment was configured.

- Public-behavior red/green slices: approval operations; callback/session approval; environment admission; signed Google claims; member assignment; operator CLI; transactional rollback on failed session persistence; browser denial feedback.
- Full suite: **55 passed**, including Chromium workflows, HTTP access/ownership regressions, Google signature/audience/issuer/expiry/nonce checks, session sign-out/expiry and local walkthrough restart.
- After the final generic sign-in message and migration-retention assertion: **20 targeted authentication/admission tests passed**.
- `npm run typecheck` and `npm run build`: passed after final code changes.
- Compiled smoke check against an isolated schema: compiled operator add/list/remove, repeat migration, stage startup with `NODE_ENV=production`, `/health`, compiled static client, unauthenticated protected-route denial, invalid `LANTERN_ENV` rejection and production `LOCAL_ACCESS` rejection all passed.

Test commands used the primary checkout's existing `.env` only as process configuration, without copying or printing it:

```sh
node --env-file=/home/jacobuntu/Ops/projects/lantern/.env --import tsx --test --test-concurrency=1 server/*.test.ts tools/ticket-board/tickets.test.ts
node --env-file=/home/jacobuntu/Ops/projects/lantern/.env --import tsx --test --test-concurrency=1 server/access.integration.test.ts server/admission.integration.test.ts
npm run typecheck
npm run build
```

The admission tests cover local/stage/production and omitted/invalid configuration, exact normalized approval, unapproved work and personal accounts, missing hosted domains, work-domain revocation, production rechecking stage-issued personal sessions, assignment eligibility, forged authority/environment fields, retained documents/former memberships, provider failure, database read/write failure and atomic failed registration. Browser coverage includes an unapproved personal account, approval, waiting, lead assignment, session persistence, revocation on refocus, reapproval and sign-out.

## Hosted-runtime integration and review

Integrated hosted runtime/CI from `c9db854` (PR #3). Migration 2 is separate from the already deployed version-1 guard and shares the transactional ledger/lock. Readiness and health schema reporting now require version 2. Runtime resolves the shared typed admission policy and injects it into authentication. The smoke fixture explicitly approves synthetic accounts without a bypass.

Post-integration validation:

- Complete PostgreSQL/HTTP/browser/release suite: **65 tests passed**, no failures/skips/cancellations.
- Typecheck and production build passed.
- Compiled production-only package test passed again after adding checks that stage admits an approved personal session, compiled approval removal revokes it, and production rejects that same approved session after restart. The test also exercises compiled add/list/remove operations, repeated migrations, readiness schema header 2, missing-schema failure and static serving without `.env` or development dependencies.
- Upgrade test first failed against migration 1, then passed with migration 2: readiness denies an old schema; concurrent upgrade preserves legacy accounts, creates an empty approval list and supports personal accounts; repeat migration retains records.
- Standards review: one minor outdated work-only glossary definition, fixed. No blocking code findings or actionable smells.
- Spec review: no actionable findings. Real Google configuration and participant setup remain ticket 05.

GitHub PR checks must pass on the final PR revision before merge. These local checks are not evidence of live Google configuration or a deployment.
