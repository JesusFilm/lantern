# Lantern

Lantern helps members write objectives and SMART goals, discuss their position focus with a career lead, and confirm the agreed document. Google sign-in, department membership and server-enforced ownership control access.

[Product scope](docs/PRD.md) · [Roadmap](docs/ROADMAP.md) · [Architecture decisions](docs/adrs/AGENTS.md)

## Development

Requires Node.js 22.12+, Docker Compose and Chromium for browser tests. Preserve existing private environment files and database volumes.

```sh
npm ci
npx playwright install chromium
npm run db:start
npm run build
npm run typecheck
npm run test:local
```

Tests use the synthetic loopback PostgreSQL fixture in `.env.example`, with isolated schemas and disposable databases/roles. The example database URL is an owner connection for tests; application startup requires a restricted runtime connection.

For a fresh local application database:

1. Create a dedicated database using the local PostgreSQL owner. Set `LANTERN_ENV=local`, `LANTERN_DB_SETUP_MODE=empty`, `LANTERN_DB_EXPECTED_ENDPOINT=127.0.0.1:55439`, `LANTERN_DB_SOURCE_OWNER=career_lead`, `LANTERN_DB_NAME`, `LANTERN_DB_SCHEMA`, and distinct `LANTERN_DB_RUNTIME_ROLE`, `LANTERN_DB_MIGRATION_ROLE`, `LANTERN_DB_ADMIN_ROLE` values.
2. Supply `BOOTSTRAP_DATABASE_URL` privately and run `npm run db:bootstrap`. It creates the schema and three restricted NOLOGIN roles. Privately enable login with separate passwords for those roles.
3. Put the target settings and migration-role `MIGRATION_DATABASE_URL` in `.env.migration`; run `npm run db:migrate:local`.
4. Put the target settings and admin-role `ADMIN_DATABASE_URL` in `.env.admin`; run `npm run access:ops -- local-account` to prepare the synthetic local account.
5. Copy `.env.example` to `.env` only if `.env` does not exist. Replace `DATABASE_URL` with the runtime-role connection. Run `npm run dev:local` for the loopback walkthrough or `npm run dev` for Google authentication.

For Google sign-in, configure a Web OAuth client with the callback `APP_ORIGIN/auth/google/callback`, then provide its credentials privately. Local access defaults off and is rejected in production. `server/operations.ts` provides approval and department setup commands; use the admin connection separately from application runtime.

## Delivery

GitHub Actions checks types, runs PostgreSQL/browser tests, and builds the application. [Staging delivery](.github/workflows/ci.yml) runs for successful main commits when repository variable `STAGE_DELIVERY_ENABLED=true`, using the GitHub `stage` environment. It currently migrates through the private Railway migration service before uploading the webapp.

[Production deployment](.github/workflows/promote.yml) accepts one full main commit SHA and verifies its successful staging readiness artifact. Once production configuration and schema migration are ready, invoke it with `gh workflow run promote.yml --ref main -f sha=<full-main-sha>`. The GitHub `production` environment requires `RAILWAY_TOKEN` as a secret and `RAILWAY_PROJECT`, `RAILWAY_ENVIRONMENT`, `RAILWAY_SERVICE`, `LANTERN_DB_RUNTIME_ROLE`, and `APP_ORIGIN` variables.

Production is not ready for execution: its migration path and credentials still require configuration. Replacing the staging migration service also requires selecting and configuring its replacement before deletion. Database migrations and webapp source must use the same revision; deployment does not copy staging records.

The Railway application uses the root Dockerfile, `node dist/server/index.js`, `/health`, a 120-second health timeout, and an on-failure restart policy with three retries. Hosted settings include `NODE_ENV=production`, `LOCAL_ACCESS=0`, `LANTERN_HOSTING_ONLY=0`, `HOST=0.0.0.0`, the environment-specific `LANTERN_ENV`, HTTPS `APP_ORIGIN`, Google credentials and the restricted runtime `DATABASE_URL`. Keep credentials outside Git.

`GET /health` checks the database and reports the release revision, deployment and schema in response headers. A failed migration stops application delivery. A failed readiness check requires inspection before retry; do not automatically undo committed migrations or deploy code incompatible with the current schema.

## Code

- `client/workspace/`: member and career-lead UI.
- `server/`: HTTP, authentication, persistence, migrations and administrative commands.
- `shared/`: typed contracts.
- `tools/release/`: delivery gates and readiness checks.
- `docs/`: product scope, priorities, domain language and architecture decisions.

[AGENTS.md](AGENTS.md) defines engineering principles. The optional [ticket-board tool](tools/ticket-board/README.md) works with an empty board; it does not define project direction.
