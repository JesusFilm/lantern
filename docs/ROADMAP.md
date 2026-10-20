# Lantern roadmap

The owner sets the next task directly. This roadmap expresses priorities without a ticket or milestone backlog.

1. **Simplify project direction.** Keep the product scope in [PRD.md](PRD.md), concise architectural decisions in [adrs](adrs/AGENTS.md), and implementation details alongside code.
2. **Maintain verified delivery.** Use the [release procedure](../README.md#delivery): automatic staging after main checks, then manual production promotion of a selected SHA.
3. **Finish access follow-up.** Email-only admission is implemented. Remove the legacy domain storage after the compatibility release is deployed; authenticated production acceptance remains owner-run.
4. **Scope weekly reporting.** Agree the reporting behavior and visibility described in the [PRD](PRD.md#proposed-weekly-reporting), then choose a bounded implementation with the owner.

Future review cycles and broader administration remain undecided. Record consequential technical decisions using the ADR process rather than growing an implicit implementation backlog.
