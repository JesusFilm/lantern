# Engineering principles

Use TDD for application changes: choose public behavior, write and run a failing test, implement the smallest complete change, then verify it passes before the next slice. Test browser workflows and HTTP interfaces against isolated real PostgreSQL schemas. Cover persistence, validation, access isolation and failure paths. Preserve existing regressions; update assertions only when an approved behavior changes.

Keep responsibilities separate: React presents data and captures intent; HTTP modules resolve identity and validate requests; domain/storage modules enforce ownership and persistence. Use explicit typed contracts, parameterized SQL, dependency injection at external interfaces, and cohesive modules with small public surfaces. Prefer composition and straightforward code over speculative abstractions. Follow SOLID principles where they reduce coupling and clarify ownership.

Server-resolved identity and active department membership are authoritative. Never accept ownership or role grants from client input. Preserve history and department scope when membership ends. Keep local access explicitly configured and unavailable by default; production requires authenticated sessions.

For prototype additions or refinements, read `prototype/AGENTS.md` in the retained prototype worktree `/home/jacobuntu/Ops/worktrees/lantern-ui-prototypes`. Application code must not depend on prototype files or expose prototype controls.
