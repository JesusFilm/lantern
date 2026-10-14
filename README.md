# Lantern

Lantern helps ministry teams clarify their contribution, grow through coaching, and connect their work to the wider mission. This repository contains its local application foundation and Markdown planning/ticket system. The starting product direction is in [docs/PRD.md](docs/PRD.md). Current implementation is an unstyled React page plus a database-backed health route; product workflows are still being specified.

## Planning

Start at [.scratch/roadmap/map.md](.scratch/roadmap/map.md). Milestones, planning maps, feature specs and individual Markdown tickets live under `.scratch/<feature>/`; [tracker conventions](docs/agents/issue-tracker.md) define the layout. The default triage labels describe readiness for the next decision or action.

## Local ticket board

On Jaco’s Mac, the ticket board starts automatically at login. Bookmark http://127.0.0.1:4393. To install or refresh the login service, run `python3 tools/ticket-board/macos/install.py`. For a manual development session on another machine, run `npm run tickets`. The selected C layout groups tickets by feature and shows rendered Markdown with a separate metadata panel. Search, item-type, readiness-label, and feature filters combine. Milestone cards are explicitly marked; detailed tickets remain separate.

The board reads `.scratch/<feature>/milestone.md` and `.scratch/<feature>/issues/*.md` live: refresh the page after edits or let it update automatically every five seconds. No HTML rebuild is needed. The board runs on TypeScript/Node.js with the same npm dependencies as the main website. The macOS login service keeps the server running and restarts it after an exit. It is available while the Mac is awake and you are logged in. With no tracker records, it shows an empty board. Feature groups are derived only from existing tickets.

The viewer lives in [tools/ticket-board/](tools/ticket-board/README.md). Run `npm run tickets:test` for tracker-format and live-reading checks.

## Run locally

Requires Node.js 22.12+ and Docker with Compose. PostgreSQL retains the existing `career-lead` Compose project and persistent volume to preserve local data through the Lantern rename, bound to loopback port 55439. The app uses loopback port 4391.

```sh
cp .env.example .env
npm ci
npm run dev
```

The development command starts the local PostgreSQL service through its npm predev hook, waits for it to be healthy, then launches the website. The ticket board runs independently and requires no database. Use separate terminals to run both.

The development command uses tsx watch; this avoids a repeated-restart issue observed with Node 24.3 native watch mode and the Vite integration.

Open http://127.0.0.1:4391. The React page calls the same-origin `/health` route. The server runs a fresh PostgreSQL `SELECT 1` for every request, returning HTTP 200 with `{"status":"ok","database":"ok"}` or HTTP 503 with `{"status":"unavailable","database":"unavailable"}`. Health responses disable ETags and use `Cache-Control: no-store`; failure responses do not include connection details. Connection and query waits are bounded.

```sh
curl -i http://127.0.0.1:4391/health
```

The database URL stays server-side. `.env` is ignored; example credentials are for isolated local development only. When changing database credentials after initialization, remember that the existing database volume retains its original credentials.

## Verify

Start PostgreSQL first, then run:

```sh
npm run typecheck
npm test
npm run build
npm start
```

Tests cover the ticket reader and real HTTP requests against PostgreSQL: health-check success and an unavailable database. The production build serves the compiled React page and the same health endpoint from one Node server. Stop the development server before `npm start`, since they use the same port.

To manually prove dependency failure and recovery while the app is running:

```sh
npm run db:stop
curl -i http://127.0.0.1:4391/health
npm run db:start
curl -i http://127.0.0.1:4391/health
```

Expect 503 while PostgreSQL is stopped and 200 once it returns. `npm run db:stop` preserves database data. Stop the web server with Ctrl+C.

## Layout

- `client/`: unstyled React entry point.
- `server/`: Express application, PostgreSQL pool, and server entry point.
- `shared/`: health response contract.
- `docs/PRD.md`: product direction and open decisions.
- `compose.yaml`: local PostgreSQL only.

The private upstream is `JesusFilm/lantern` on GitHub. Product code and local Markdown planning/tickets are versioned here; personnel records and runtime secrets stay outside Git.

Implementation references: [Vite middleware integration](https://vite.dev/guide/ssr#setting-up-the-dev-server), [node-postgres pooling](https://node-postgres.com/apis/pool), and the [official PostgreSQL container](https://hub.docker.com/_/postgres).
