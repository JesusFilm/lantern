# Lantern roadmap

The owner sets direction and can name the next task directly. This roadmap expresses product priorities; [Prioritizing work](development/prioritizing-work.md) orders the issue backlog.

1. **Simplify project direction.** Keep the product scope in [PRD.md](PRD.md), concise architectural decisions in [adrs](adrs/AGENTS.md), and implementation details alongside code.
2. **Maintain verified delivery.** Use the [release procedure](operations/releasing.md): main checks, staging acceptance, then gated automatic production promotion. Keep schema-changing releases manual.
3. **Move toward API-first access.** Follow the [API and MCP guide](api/README.md). Deliver the [approved owner administration API and MCP plan](plans/owner-administration-api.md) first, including JFP One authorization and verified delivery, then add API and MCP paths from the [operation inventory](api/inventory.md) in priority order.
4. **Weekly goals and daily updates.** Iterate on the member’s weekly planning and the dated My team view described in the [PRD](PRD.md#weekly-goals-and-daily-updates). Both remain flagged prototypes. A read-only bearer API supports the separate TV app; broader sharing remains undecided.

The agreed review cycle and deferred mid-cycle decisions are recorded in the [business rules](rules/review-and-confirmation.md). Administration beyond the agreed owner scope remains undecided. Record consequential technical decisions using the ADR process rather than growing an implicit implementation backlog.
