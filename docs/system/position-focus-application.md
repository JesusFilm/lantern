# Position-focus application

The application implements the approved Refine 4 layout as React screens backed by Express and PostgreSQL. The prototype journey remains separate. This iteration adds document authoring to the earlier guide beta; it does not introduce joint agreement, review notifications, department customization or approval workflows.

The [current PRD](../PRD.md) records the narrowed team-trial direction. M01 closes the accepted local baseline; Exact-email admission and hosted runtime are merged. Career-lead member browsing and read-only focus access are implemented on `codex/lead-member-focuses`; confirmation locks and live Railway/Google setup remain [M06 work](../../.scratch/team-trial/breakdown.md). [Design decisions and prototype history](product-decisions.md).

## User flows

- Create a dated focus, open it from the list, edit its title/dates, and revisit it after reload.
- Add normal, personal-development or leadership objectives. Every new objective defaults to Normal. Add/edit/remove goals and objectives through focused dialogs; Cancel and Escape discard unsaved input.
- Read the objective and SMART lessons, navigate their steps, and inspect the concise example beside the guide menu.
- Edit the current account’s display name. Saved names survive later sign-in.
- As career lead, open **Department users**, select a current member by name/email, then read a dated focus. Member detail is read-only, identifies the person, and supports reload and back navigation. Ordinary members have no roster navigation or roster API access.

No sample documents, prototype state panels, style selectors or reset controls are included in the application.

## Data and architecture

`shared/focus.ts` defines document contracts. `client/workspace` separates document presentation, lessons, account, department membership and reusable modal behavior. The fetch adapter reports HTTP failures without dropping dialog input. Fixed lesson content is separate from presentation.

`server/access.ts` resolves configured local identity or authenticated sessions and enforces request origin. `server/focus-http.ts` resolves active membership for each request. `server/focus.ts` validates input and stores whole versioned documents atomically, using parameterized SQL. Owner and department IDs come only from the server. The table `position_focuses` links each document to its user and originating department. Owner routes expose only the current user’s documents in their active department; removed memberships and department changes do not delete historical documents or expose them to other members.

`server/member-focuses.ts` provides a separate read-only domain interface. A scoped SQL read checks current lead/target memberships and department alongside document retrieval; guessed or mismatched identifiers receive a generic unavailable response. HTTP resolves admitted identity through the existing session contract. React renders typed member/list/detail results. Refocus revalidates the selected member, and failed session checks or protected-request denial clear private views. See [lead-reading verification](lead-member-focuses-verification.md).

An integer version prevents silent overwrites by stale browser tabs. A conflict keeps the unsaved dialog text and asks the user to close and reopen the document. Reopening fetches the latest server version. Limits: title 200 characters, objective/goal 10,000 characters, 100 objectives and 100 goals per objective, 1 MB request body. Date ranges are validated. Partial drafts may contain no objectives/goals; this is authoring, not a completion/approval gate.

`migrate` adds the document table and index idempotently. No existing accounts, memberships or documents are reset. The local-account setup preserves profile edits and never restores removed memberships.

## Run and walkthrough

Use Node 22.12+ (the VM service uses Node 24.21.0). With `.env` configured, `npm run dev:local` starts PostgreSQL and enables the explicit local-user mode. `npm run dev` retains normal session authentication. `npm run build` creates the server/client build; `npm start` serves it.

The VM’s running walkthrough is `https://jacobuntu.tail5c6dbf.ts.net:8444/` via loopback `127.0.0.1:4391`. The user service `lantern-app.service` uses `tools/local-app/lantern-app.service`, the existing `.env`, and explicit `LOCAL_ACCESS=1`. It serves the compiled application and automatically restarts after failures. Rebuild and run `systemctl --user restart lantern-app.service` after changes. PostgreSQL uses the existing Docker volume.

Local access is disabled by default, requires a loopback bind, and is rejected when `NODE_ENV=production`. Everyone using this local walkthrough URL acts as the same persistent local account in Engineering. This is not a multi-user authentication mechanism. Google configuration remains deferred; normal Google session and membership code and tests are retained. The private viewer registration is `lantern-app`; prototype and ticket-board registrations are unchanged. To retire the walkthrough, unregister `lantern-app` and disable/stop its user service; retain the PostgreSQL volume to retain data.

## Verification

The user approved browser workflows and HTTP interfaces with real PostgreSQL as the TDD test interfaces. Work proceeded in failing-test/implementation slices. Tests create and drop isolated schemas, leaving walkthrough data alone. `npm test` runs files serially because the browser harnesses share Vite’s compilation cache; middleware websocket connections attach to each HTTP test server.

The suite covers account persistence, process restart, document CRUD at the objective/goal level, dates and input limits, malformed requests, owner/department isolation, removal access, stale-write rejection/recovery, browser reload persistence, all objective types/defaults, cancellation, failed-save input retention, guide navigation/example layout, profile editing, and mobile width. Existing Google verification, membership, original guide-preview and roadmap regressions remain covered. Type checks and the production build are separate required checks.

Automated checks do not replace the user’s visual/content walkthrough. Live Google sign-in has not been configured or human-verified.

Earlier implementation verification on 15 October 2026: `npm test` passed all 39 tests with no skipped tests; `npm run typecheck`, `npm run build` and `git diff --check` passed. The rebuilt service is active and its private HTTPS viewer check passes. Production-build desktop guide/example/account and mobile account rendering were inspected; browser interaction checks run against isolated PostgreSQL schemas.

For this reconciliation and pre-merge regression results, see the [review record](review-2026-10-15.md). The local service and its data are not restarted or reconfigured by the planning/merge task.
