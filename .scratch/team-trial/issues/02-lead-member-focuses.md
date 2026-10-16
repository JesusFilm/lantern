Kind: ticket
ID: team-trial/02
Title: Let the career lead browse members and read their focuses
Milestone: M06
Type: task
Status: resolved
Blocked by: None
Implementation: Merged on main; member save/reload and lead read-only browsing verified manually on staging at 8e4cd80; full acceptance remains 06.
Slice: Hosted team trial

---
## Outcome

The career lead opens a member from the roster, sees that member's focus list, and reads a focus. Members retain only their own focus access and the guides.

## Acceptance

- [x] Lead-only current team member list shows names/emails and leads to selected member's dated focuses, including no-focus and unavailable-member states.
- [x] Detail clearly identifies the member and supports back navigation. Lead reads current records without a lifecycle-state filter; cross-member editing is absent and denied server-side. Confirmed-record verification follows ticket 03 (see below).
- [x] Ordinary members cannot fetch the roster or other members' list/detail routes, even by guessed identifiers. Unassigned/removed/unapproved users and other-team fixtures cannot access the data. Preserve owner routes and history.
- [x] Authorization and department ownership are checked in HTTP/domain storage; no client-controlled role or team grant. Refreshing or switching account/membership clears stale UI content.
- [x] Browser/HTTP TDD with two members, a lead and isolated real PostgreSQL covers empty/nonempty lists, drill-in/back, reload persistence, direct-route attacks, revocation, error/retry and cross-team denial.

## Boundaries and seams

Extend existing Department, focus routes/store and typed contracts; React presents server-authorized results. No admin, historical-member browser, focus editing by lead, dashboards or multi-team controls. [Access matrix](../spec.md#access-matrix).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.

## Implementation and verification

Implemented from fetched `origin/main` at `92a18ff2de72e9ba95cc6d30d803f859e6aacecf`. The lead-only roster opens named, dated member lists and read-only detail with reload/back navigation, unavailable/empty/loading/error/retry states. Server reads require admitted identity, active career-lead membership and a current target in the same department; owner writes remain separate. Refocus, access denial and account changes invalidate private views.

See [verification evidence](../../../docs/system/lead-member-focuses-verification.md). Public browser/HTTP red-green slices use synthetic identities and isolated PostgreSQL schemas. Existing roster assertions changed only for the approved lead-only access rule.

Confirmation/locking remains ticket 03. The reader returns the existing `PositionFocus` contract and does not filter by lifecycle state. No confirmed records, lifecycle fields, migration or confirmation action have been introduced; confirmed-record acceptance must be exercised when 03 adds that state. This ticket's checkboxes describe the completed reading scope, not verification of the future lifecycle.

No push, merge, deployment, live environment changes or enrollment were performed. After integration, tickets 05/06 must test the resulting stage revision again; these local checks do not validate the other session's live setup.
