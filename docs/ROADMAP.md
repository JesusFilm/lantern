# Lantern roadmap

The owner sets the next task directly. This roadmap expresses priorities without a ticket or milestone backlog.

1. **Simplify project direction.** Keep the product scope in [PRD.md](PRD.md), concise architectural decisions in [adrs](adrs/AGENTS.md), and implementation details alongside code.
2. **Maintain verified delivery.** Use the [release procedure](operations/releasing.md): main checks, staging acceptance, then gated automatic production promotion. Keep schema-changing releases manual.
3. **Add owner administration.** Deliver the [approved administration API and MCP plan](plans/owner-administration-api.md) in phases, including JFP One authorization and verified delivery.
4. **Scope weekly reporting.** Agree the reporting behavior and visibility described in the [PRD](PRD.md#proposed-weekly-reporting), then choose a bounded implementation with the owner.

Future review cycles and administration beyond the agreed owner scope remain undecided. Record consequential technical decisions using the ADR process rather than growing an implicit implementation backlog.
