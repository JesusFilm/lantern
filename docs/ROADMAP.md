# Lantern roadmap

The owner sets the next task directly. This roadmap expresses priorities without a ticket or milestone backlog.

1. **Simplify project direction.** Keep the product scope in [PRD.md](PRD.md), concise architectural decisions in [adrs](adrs/AGENTS.md), and implementation details alongside code.
2. **Make staging delivery dependable.** Merge reviewed PRs to main; automatically apply database migrations and deploy the matching webapp revision. Surface failures clearly.
3. **Establish production delivery.** Manually select a full main commit SHA, apply its migrations, deploy that webapp revision, and verify sign-in, persistence, access isolation, and confirmation. Release the current application and schema with production data kept separate.
4. **Use the product and choose the next improvement.** Gather feedback on writing, discussing and confirming focuses. Agree the next bounded change with the owner before expanding scope.

Future review cycles and broader administration remain undecided. Record consequential technical decisions using the ADR process rather than growing an implicit implementation backlog.
