# Lead member-focus reading verification

Verified 15 October 2026 on `codex/lead-member-focuses`, based on fetched `origin/main` at `92a18ff2de72e9ba95cc6d30d803f859e6aacecf`. Worktree: `/home/jacobuntu/Ops/worktrees/lantern-lead-member-focuses`.

## Delivered behavior

The active career lead opens **Department users**, sees current members' names/emails, opens a dated focus list and reads a selected document. Member/list/detail URLs survive reload and browser back/forward. Empty lists, blank documents, unavailable members, loading, safe errors and retry are handled. The member and document are identified explicitly. Cross-member views contain no editing controls. The lead retains ordinary owner editing through **Position focuses**.

Ordinary members cannot see team navigation or fetch the roster/member-read endpoints. Admitted identity still comes from the merged session/admission contract. A separate read-only domain module checks live lead membership, target membership and department/document scope. Invalid, nonexistent, mismatched and other-team targets return the same generic 404. Owner mutation routes and payload validation are unchanged; there is no new cross-member write endpoint.

Refocusing revalidates the selected member as well as the session. Account/role/department changes remount private views. Failed session checks clear private content; 401/403 protected responses trigger access refresh. Late responses from an old member view cannot restore private data after an account switch.

## Public-behavior TDD evidence

Tests use real PostgreSQL in unique disposable schemas, with synthetic approved accounts and opaque sessions. Existing Google/provider admission tests remain part of the full suite. No personnel data or real approvals are fixtures.

Observed red → green slices:

- Lead member-list HTTP route returned 404 before implementation; named member, dated list, empty list and persisted detail then passed.
- Ordinary member roster request returned 200 before the lead-only rule; it now returns 403. Existing assertions changed only for this approved access change.
- Browser could not select a roster member before navigation/read presentation existed; drill-in, reload, back/forward and empty state then passed.
- Refocusing after target removal retained the old document before member-view revalidation; it now clears and reports unavailable.
- Revoked lead approval on a subsequent protected request left the old account chrome visible before denied-request refresh; it now clears the whole private view.
- Clicking the main Department users navigation from a member route retained the selection before route synchronization; it now returns to the roster.

Additional coverage includes two ordinary members and leads in two departments, guessed/direct-route attacks, forged role/owner/department fields, rejected cross-member writes, retained documents after membership removal, lead and member owner editing, approval revocation, lead role/removal, cross-team document scope, database failure/recovery, roster/list/detail retry, session failure/retry, and delayed read completion after account switching. Desktop and 390px mobile focus screenshots were inspected; the mobile viewport has no horizontal overflow.

## Final checks

Node 24.21.0. The primary checkout's existing `.env` was read only as process configuration, without copying or printing credentials. No local service was restarted.

```sh
npm run typecheck
npm run build
node --env-file=/home/jacobuntu/Ops/projects/lantern/.env --import tsx --test --test-concurrency=1 server/*.test.ts tools/ticket-board/tickets.test.ts tools/release/*.test.mjs
git diff --check
```

- Full required regression suite: **79 passed**, zero failures, skips or cancellations.
- Typecheck: passed.
- Production build: passed.
- Diff whitespace check: passed.
- Existing access, authoring/persistence, guide, Google/admission, account-switching, runtime/migration, production-only package and release-gate checks all passed.

## Integration considerations

There is no schema migration; schema readiness remains version 2. No Railway resources, CI settings, Google credentials, enrollment or live services were changed. Nothing was pushed, merged or deployed. Primary checkout and existing database/service data were preserved; tests dropped only their generated schemas.

Ticket 03 owns confirmation state, locking, lifecycle fields and actions. This read interface returns the existing `PositionFocus` contract without a draft-state filter. There are currently no confirmed records to verify. When 03 adds lifecycle metadata, extend the owner and member read projections/contracts together and test confirmed-document reads; this work does not claim that future acceptance evidence.

After integration, environment setup and stage verification must rerun checks against the resulting stage revision, including real approved Google accounts and at least two members. Local test results do not validate live Google/Railway configuration and do not authorize promotion. Changed revisions require new stage evidence.

## PR review and user acceptance — 16 October 2026

Jaco tried the separate private walkthrough and accepted member/lead focus reading. Its account chooser, fixture seed, service and verification script remain ignored under `output/local-walkthrough/`; none is included in PR #5. Authentication-provider selection, login entry and role-default home screens remain separate work.

Standards review found no blocking violations. A nonblocking duplication observation in owner/member document rendering is deferred until lifecycle work warrants sharing the presentation. Spec review found browser Back from Department users lost Guide/Account destinations. A new public browser test reproduced the failure, then passed after consistent page URL encoding/decoding was introduced. Follow-up review found no actionable issue.

PR: https://github.com/JesusFilm/lantern/pull/5. The prior no-push statement describes initial implementation delivery; publication and merge were subsequently authorized. Integration still requires the repository's checks and review gate, and the merged stage revision requires new verification.

After the review fix: **80 tests passed** (zero failures/skips/cancellations), typecheck and production build passed. The retained HTTPS walkthrough also passed its account-switching/read/edit/persistence smoke check against the updated client. Required GitHub checks must pass on the final PR head before merge.

CodeRabbit subsequently identified two enrollment UI regressions: whole-Department remounts discarded Add user state on refocus, and a forbidden candidate assignment discarded the rejection message. Both were reproduced with failing browser tests. Revalidation now refreshes the roster and remounts only member reads; the form remains intact. A 403 triggers authoritative session revalidation without assuming the actor has been signed out, preserving the existing admission HTTP contract. Real role/account changes and session failures still clear private data. A further browser check covers role removal followed by a forbidden member read. Follow-up standards review found no blocker.

Final post-CodeRabbit verification: **83 full-suite tests passed**, typecheck and production build passed; all 12 lead-browser tests passed again after strengthening the refresh synchronization assertions. The private HTTPS walkthrough smoke also passed. No local entry/seed mechanism is tracked.
