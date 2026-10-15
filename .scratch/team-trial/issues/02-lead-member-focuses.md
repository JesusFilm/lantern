Kind: ticket
ID: team-trial/02
Title: Let the career lead browse members and read their focuses
Milestone: M06
Type: task
Status: ready-for-agent
Blocked by: 01
Implementation: Not started
Slice: Hosted team trial

---
## Outcome

The career lead opens a member from the roster, sees that member's focus list, and reads a focus. Members retain only their own focus access and the guides.

## Acceptance

- [ ] Lead-only current team member list shows names/emails and leads to selected member's dated focuses, including no-focus and unavailable-member states.
- [ ] Detail clearly identifies the member and supports back navigation. Lead reads both draft and confirmed records; cross-member editing is absent and denied server-side.
- [ ] Ordinary members cannot fetch the roster or other members' list/detail routes, even by guessed identifiers. Unassigned/removed/unapproved users and other-team fixtures cannot access the data. Preserve owner routes and history.
- [ ] Authorization and department ownership are checked in HTTP/domain storage; no client-controlled role or team grant. Refreshing or switching account/membership clears stale UI content.
- [ ] Browser/HTTP TDD with two members, a lead and isolated real PostgreSQL covers empty/nonempty lists, drill-in/back, reload persistence, direct-route attacks, revocation, error/retry and cross-team denial.

## Boundaries and seams

Extend existing Department, focus routes/store and typed contracts; React presents server-authorized results. No admin, historical-member browser, focus editing by lead, dashboards or multi-team controls. [Access matrix](../spec.md#access-matrix).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
