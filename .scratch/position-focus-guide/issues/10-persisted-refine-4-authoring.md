Kind: ticket
Title: Persist the accepted Refine 4 position-focus application
Milestone: M01
Type: task
Status: resolved
Blocked by: None
Implementation: Complete locally; recorded retrospectively on 15 October 2026
Slice: Position focus baseline

---
# 10: Persist the accepted Refine 4 application

## Delivered behavior

This records already-authorized and delivered work that expanded the old guide-only beta. Jaco requested the accepted Refine 4 application with real persistence and tests and subsequently said he was very happy with the minimal initial implementation.

- Dated, titled position-focus list with a compact read-first view.
- Create focuses and edit metadata; add, edit and remove objectives and SMART goals through spacious dialogs.
- Normal, Personal Development and Leadership objective types with Normal selected each time Add Objective opens.
- Concise standalone guides and generic example; persistent account display-name editing.
- PostgreSQL storage scoped to server-resolved owner and active department, input validation, optimistic version conflicts and dialog-input preservation after failed saves.
- Explicit local walkthrough account configuration; unavailable by default, loopback-only and rejected in production mode.

## Verification and limits

Last reported verification on 15 October 2026: 39 tests, typecheck, build and diff checks passed. Browser and HTTP checks used isolated real PostgreSQL schemas; the suite includes earlier regressions as well as the new authoring checks. See the [application record](../../../docs/system/position-focus-application.md).

The accepted local walkthrough shares one account. No live Google, newcomer or multi-user practical acceptance is claimed. Drafts may be incomplete. The integer save version is concurrency protection, not historical cycle versioning. Career-lead reading of others' focuses, confirmation/locking and hosted stage/production remain [M06](../../team-trial/spec.md).

No request/submission workflow, notes, review statuses, notifications, automated scheduling or administration expansion is delivered or implied. The prototype journey is preserved separately at [the prototype viewer](https://jacobuntu.tail5c6dbf.ts.net/lantern-prototypes/).

## Comments

### 15 October 2026 — Recorded during reconciliation

Added a completed delivery record so the roadmap credits persisted authoring rather than continuing to describe it as future M03 work. This is not a new implementation authorization or a claim that team verification occurred.
