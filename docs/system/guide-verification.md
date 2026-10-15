# Current application and team-trial verification

Updated 15 October 2026. The old guide-only protocol is [preserved in history](../../.scratch/position-focus-guide/history/2026-10-15-pre-team-trial/guide-verification.md). It is superseded, not passed. M01 closes against the accepted local application; live Google, newcomer and multi-user checks transfer to [M06/06](../../.scratch/team-trial/issues/06-stage-verification.md).

## Evidence already available

The user accepted the minimal Refine 4 application. Automated browser/HTTP tests use isolated real PostgreSQL schemas and synthetic identities at the external provider boundary. The historical guide preview retains regression tests, but those checks do not describe the current guide content. Current guides are three objective steps, five SMART steps and a generic one-objective/two-goal example alongside the side menu.

See [application verification](position-focus-application.md) and the [review record](review-2026-10-15.md) for exact final commands/results. No newcomer session, real Google login, hosted stage acceptance or production release is claimed by automated checks.

## Local baseline walkthrough

Use the [private local application](https://jacobuntu.tail5c6dbf.ts.net:8444/), remembering every visitor shares its account.

- Create and reopen a dated focus; edit title/dates, long objectives and goals through dialogs; cancel without saving and reload to confirm persistence.
- Add Normal, Personal Development and Leadership objectives; every Add Objective opening defaults to Normal. Remove objectives/goals and confirm persistence. Partial drafts remain allowed.
- Navigate the separate objective/SMART guides and concise example; inspect weak/strong examples and why they work. Do not require removed mission banners or full-example content.
- Edit/cancel account display name. Test desktop/mobile reading, keyboard dialogs, error/retry and stale-save input retention.

## Stage acceptance — pending M06 implementation/setup

Record the exact deployed Git SHA and stage URL; use approved real Google accounts, separate lead/member browser sessions and disposable synthetic content. The local walkthrough cannot establish these checks.

1. Sign in as the lead and two members; reject a same-domain unapproved account and an external account. Check cancellation/retry, sign-out/session expiry and revocation of a disposable participant without deleting records.
2. Let a newcomer use the current guides to create and reopen an objective with SMART goals. Observe without steering each click; capture confusing steps and assistance needed.
3. As lead, open the member list, chosen member and chosen focus. Confirm that member A cannot fetch member B's data, roster or lead-only routes, including direct HTTP requests.
4. After discussion, lead confirms/locks the intended focus. Reopen under both accounts; status and content agree. Try editing from an already-open dialog and direct request; reject writes while retaining unsaved input. Check competing edit/confirmation behavior through automated evidence.
5. Switch accounts in another tab, then return to the original; no previous-account data remains displayed under the new identity. Remove access while signed in and verify protected requests fail.
6. Check mobile/desktop reading, database-failure feedback and persistence after restart. Confirm stage is separate from production, has no local-user bypass, and backup/restore evidence exists.
7. Log each failure, fix it with regression coverage, and rerun affected checks on the revised candidate. Promotion uses only the verified revision and [M06/07](../../.scratch/team-trial/issues/07-production-promotion.md).

## Observation record

No real stage participant observations yet. For each session, record date, anonymous participant label, build/deployment, attempted behavior, observed outcome, assistance/failure, follow-up ticket and rerun result. Use passed/failed/not-run explicitly. Do not store real emails or personnel focus content in Git. No fixed participant-comprehension score or invented success claim is required.

Removed full-engineering-example, mission/gap/timing instruction, multi-department customization and guide-editor scenarios are outside current acceptance. Later phase reviews have their own future specification.
