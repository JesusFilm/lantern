# Lantern

Lantern helps members write position focuses containing objectives and SMART goals. The current application provides a persisted, read-first workspace, focused editing dialogs, concise guides and account-name editing. Career leads can browse current members and read their focuses. The hosted team trial still requires confirmation locks and live Railway stage/production verification.

[Current product scope](docs/PRD.md) · [Roadmap](docs/ROADMAP.md) · [Next tickets](.scratch/team-trial/breakdown.md) · [Application details](docs/system/position-focus-application.md)

## Current private walkthrough

The [local walkthrough](https://jacobuntu.tail5c6dbf.ts.net:8444/) runs on the Jacobuntu VM behind Tailscale. Everyone using it shares one persistent local account. It is not the upcoming hosted multi-user trial. Database-approved Google access, sessions and membership are implemented; real Google configuration and acceptance remain outstanding.

The [prototype journey](https://jacobuntu.tail5c6dbf.ts.net/lantern-prototypes/) preserves the original guide, image concepts, layouts and refinements separately. The former standalone guide viewer was consolidated there. `npm run preview:dev` and `npm run preview:build` retain the **historical** guide entrypoint for regression/reference; the current application uses `client/workspace/LearningGuide.tsx`.

## Run locally

Requires Node.js 22.12+, Docker with Compose and Chromium for browser tests. PostgreSQL retains the existing `career-lead` Compose project/volume and loopback port 55439. The app defaults to loopback port 4391. Preserve an existing `.env` rather than replacing it.

```sh
cp .env.example .env
npm ci
npx playwright install chromium
npm run dev:local
```

`dev:local` starts PostgreSQL and explicitly enables the local account. Use `npm run dev` for normal Google/session authentication and follow [access setup](docs/system/access-setup.md). Local access is off by default, requires loopback and is rejected with `NODE_ENV=production`.

```sh
npm run typecheck
npm run build
npm test
```

Tests create isolated real PostgreSQL schemas and preserve walkthrough data. They cover persistence, HTTP/browser authoring, ownership/membership access, Google validation, guides, failures and tracker regressions. To serve the compiled build locally, stop the dev server and run `npm run start:local` (optional `.env`). `npm start` uses injected variables with no dotenv requirement. See the [hosted release runbook](docs/operations/hosted-release.md) for compiled migrations/operators, Railway configuration, CI checks, stage delivery and manual production promotion. Live infrastructure and Google setup remain M06/05 work.

`GET /health` runs a fresh database query and returns 200 or a generic 503 without connection details. `.env`, runtime credentials and personnel records stay outside Git. PostgreSQL data remains in the existing Docker volume; do not reset it to test releases.

## Planning and ticket board

Start with [the roadmap map](.scratch/roadmap/map.md). Local Markdown milestones, specs and tickets live in `.scratch/<feature>/` under [tracker conventions](docs/agents/issue-tracker.md). Ready tickets are separate from delivered behavior. M01 is the accepted baseline; M06 is next. Later phases and administration are [deferred candidates](.scratch/position-focus-guide/deferred.md).

Run `npm run tickets` for the board on http://127.0.0.1:4393. The private VM [roadmap viewer](https://jacobuntu.tail5c6dbf.ts.net:8443/) reads the same files. The TypeScript board refreshes Markdown records without regenerating HTML. [Board tooling](tools/ticket-board/README.md) includes the optional macOS login-service installer; it is separate from application hosting.

## Repository

- `client/workspace/`: focus authoring, current guides, account and membership UI.
- `server/`: HTTP identity/validation, Google sessions, domain/storage, operations and schema.
- `shared/`: typed contracts.
- `docs/system/`: operating notes, verification and review evidence.
- `docs/research/`: supporting research; historical comparisons are not current requirements.
- `.scratch/`: current plans and preserved decision history.

[AGENTS.md](AGENTS.md) requires TDD, server-authoritative identity/ownership and separated responsibilities. Product code and plans are tracked in the private `JesusFilm/lantern` upstream. The prototype worktree remains `/home/jacobuntu/Ops/worktrees/lantern-ui-prototypes` on `codex/lantern-ui-prototypes`; application code must not depend on it.
