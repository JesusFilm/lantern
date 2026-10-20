# Lantern agent guide

Use TDD for application changes: choose public behavior, write and run a failing test, implement the smallest complete change, then verify it passes before the next slice. Test browser workflows and HTTP interfaces against isolated real PostgreSQL schemas. Cover persistence, validation, access isolation and failure paths. Preserve existing regressions; update assertions only when an approved behavior changes.

Keep responsibilities separate: React presents data and captures intent; HTTP modules resolve identity and validate requests; domain/storage modules enforce ownership and persistence. Use explicit typed contracts, parameterized SQL, dependency injection at external interfaces, and cohesive modules with small public surfaces. Prefer composition and straightforward code over speculative abstractions. Follow SOLID principles where they reduce coupling and clarify ownership.

Server-resolved identity and active department membership are authoritative. Never accept ownership or role grants from client input. Preserve history and department scope when membership ends, except for explicitly requested data removal. Keep local access explicitly configured and unavailable by default; production requires authenticated sessions.

## Read for the task

Load the relevant guide when its task applies; follow its source links only for implementation details.

| Task | Start here |
| --- | --- |
| Run/write tests, explain coverage, or assess what a green check proves | [Testing](docs/development/testing.md): local commands, staging journeys, production checks and limits |
| Merge, release, change schema or delivery switches, or recover a failed release | [Releasing](docs/operations/releasing.md): automatic/manual paths, evidence and recovery |
| Change product or data-model behavior | [PRD](docs/PRD.md), [domain terms](GLOSSARY.md), [priorities](docs/ROADMAP.md) |
| Choose/change an architectural approach or record a decision | [ADR instructions](docs/adrs/AGENTS.md) |

Keep guides focused on current instructions. Replace obsolete guidance and remove completed plans; keep execution history in PRs/CI evidence and historical decisions in ADRs with links to their replacements.
