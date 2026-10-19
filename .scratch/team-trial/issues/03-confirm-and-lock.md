Kind: ticket
ID: team-trial/03
Title: Confirm and lock an agreed initial position focus
Milestone: M06
Type: task
Status: ready-for-agent
Blocked by: 02
Implementation: Implemented locally with migration 4; 117 tests passed; review pending; no hosted deployment
Slice: Hosted team trial

---
## Outcome

After discussion, the career lead confirms a focus and both people can revisit the immutable agreed baseline.

## Acceptance

- [ ] Existing/new records default to draft. Partial drafts remain saveable. Confirmation requires a normal objective with at least one goal and valid existing structure/title/dates; do not assess SMART prose quality.
- [ ] Lead-only explicit Confirm and lock action identifies target person/document and asks confirmation. Members cannot invoke it; lead cannot use it for another team or removed member.
- [ ] Atomic expected-version transition stores confirmed status, actor and time. Confirmation duplicates preserve the first metadata. Stale confirm fails; racing edit vs confirm cannot mutate the confirmed baseline.
- [ ] Every content/metadata update is denied after confirmation for all actors, including requests from stale dialogs. Preserve rejected dialog input and display actionable status; title/date/goal/objective content survives reopen/restart unchanged.
- [ ] Browser and HTTP TDD on real PostgreSQL covers draft persistence, invalid/empty confirmation, role/ownership attacks, successful lock, concurrent save/confirm, duplicate confirmation, database failure and all locked mutation paths.
- [ ] Migrate existing focuses without loss and document the persisted lifecycle separately from optimistic-save versioning.

## Boundaries

No submit/request queue, unlock, copying, history browser, notification or scheduling. Later review/versioning is M04. Confirmation is agreement, not goal achievement. The lead's own focus follows the same role rules; no second approver. [Lifecycle](../spec.md#initial-draft--confirmed-lifecycle).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.

## Implementation — 19 October 2026

The local implementation adds the explicit confirmation dialog, server-authorized
versioned confirmation, immutable owner/lead reads and schema-4 migration. See
[lifecycle and rollout limits](../../../docs/system/focus-confirmation.md).
Local typecheck/build and all 117 tests passed. Review is pending; live staging/production acceptance remains
separate. The parked two-member case is not resumed by local synthetic tests.
