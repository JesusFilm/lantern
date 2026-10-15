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

## Required integration gate

Hosted runtime/CI must integrate first. This implementation is independently tested but **not cleared for merge** until those changes are integrated into this branch and migration, compiled startup and authentication checks are rerun. See [the exact integration seams and operator procedure](access-setup.md#integration-with-hosted-runtime-required-before-merge).

The runtime owner must retain the injected `AdmissionPolicy`, validate `LANTERN_ENV` before startup, and carry the empty approval table plus nullable hosted-domain migration into its migration sequence. This change deliberately leaves the existing migration runner and startup lifecycle intact. Real Google and multi-account stage verification remain later setup/QA work.
