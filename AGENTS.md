# Lantern agent guide

Use TDD for application changes: choose public behavior, write and run a failing test, implement the smallest complete change, then verify it passes before the next slice. Test browser workflows and HTTP interfaces against isolated real PostgreSQL schemas. Cover persistence, validation, access isolation and failure paths. Preserve existing regressions; update assertions only when an approved behavior changes.

Keep responsibilities separate: React presents data and captures intent; HTTP modules resolve identity and validate requests; domain/storage modules enforce ownership and persistence. Use explicit typed contracts, parameterized SQL, dependency injection at external interfaces, and cohesive modules with small public surfaces. Prefer composition and straightforward code over speculative abstractions. Follow SOLID principles where they reduce coupling and clarify ownership.

Server-resolved identity and active department membership are authoritative. Never accept ownership or role grants from client input. Preserve history and department scope when membership ends, except for explicitly requested data removal. Keep local access explicitly configured and unavailable by default; production requires authenticated sessions.

Before posting GitHub issue or PR comments, review the entire comment, including links, logs, screenshots and linked artifacts. Remove secrets, credentials and tokens; private network addresses or hostnames (including Tailscale); and machine-only links such as localhost URLs and local file paths. Share useful verification instead: the checks or journeys run, environment, outcome and limitations, with sanitized output or an accessible GitHub Actions run link where appropriate. Never imply an unrun or failed check passed. If sensitive information was posted, also remove the affected revisions from the comment's GitHub edit history; editing the comment alone leaves them visible.

Link tracked issues in PR descriptions with `Refs #123`, not GitHub's automatic closing keywords. Include a `## QA checks` section with concrete checks and flag names when known. QA owns issue verification; engineers handle closure under the [QA handoff](docs/development/qa-issue-workflow.md#engineering-closure). Release and production promotion do not wait for QA's issue verification. The manual checks required by [Releasing](docs/operations/releasing.md), including real staging sign-in for auth, OAuth and admission-policy changes, still apply.

## Read for the task

Load the relevant guide when its task applies; follow its source links only for implementation details.

| Task | Start here |
| --- | --- |
| Run/write tests, explain coverage, or assess what a green check proves | [Testing](docs/development/testing.md): local commands, staging journeys, production checks and limits |
| Change what the AI coach says or how guided authoring proceeds: prompts, Guide principles, response contract, coach turn, model or flow | [Coach benchmark](docs/development/coach-benchmark.md): add a scenario for reported problems, run before and after, meet the gate, report it and update the baseline |
| Link issues in a PR, hand work to QA, or handle QA results and issue closure | [QA issue workflow](docs/development/qa-issue-workflow.md): labels, release evidence, checks, retesting and engineering closure |
| Triage issues or choose the next issue to work on | [Prioritizing work](docs/development/prioritizing-work.md): priority levels, adjustments, cycle goal and triage routine |
| Merge, release, change schema or delivery switches, or recover a failed release | [Releasing](docs/operations/releasing.md): automatic/manual paths, evidence and recovery |
| Review a change or modify workflows, release tooling or agent instructions | [Change review](docs/operations/review-gate.md): independent inspection, protected changes and owner authority |
| Find, document or change intended product behavior | [Business rules](docs/rules/README.md), [PRD](docs/PRD.md), [domain terms](GLOSSARY.md), [product priorities](docs/ROADMAP.md) |
| Add behavior users would notice, or release or remove a flagged feature | [Feature flags](docs/development/feature-flags.md): when to flag, guarding routes, testing both states, release and removal |
| Change product source or prepare a QA hand-off | [QA manual](docs/development/manual.md): check coverage and wording, update affected slides and screenshots, then regenerate |
| Choose/change an architectural approach or record a decision | [ADR instructions](docs/adrs/AGENTS.md) |

Agents may draft and maintain business rules; only the owner approves their meaning. Record mismatches and unresolved decisions rather than silently choosing.

Keep guides focused on current instructions. Replace obsolete guidance and remove completed plans; keep execution history in PRs/CI evidence and historical decisions in ADRs with links to their replacements.
