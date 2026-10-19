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

GitHub Actions checks types, runs PostgreSQL/browser tests, and builds the application. [Staging delivery](.github/workflows/ci.yml) runs for successful main commits when repository variable `STAGE_DELIVERY_ENABLED=true`, using the GitHub `stage` environment. It applies migrations directly from the runner, then uploads the matching webapp revision.

[Production deployment](.github/workflows/promote.yml) accepts one full main commit SHA and verifies its successful staging readiness artifact. Run `gh workflow run promote.yml --ref main -f sha=<full-main-sha>` after configuring production. The selected revision must include the GitHub migration runner's TLS-compatible operator validation. Production receives schema changes only; staging records are never copied.

Configure each GitHub environment (`stage` and `production`):

| Setting | Value |
| --- | --- |
| Secrets | `RAILWAY_TOKEN` scoped to that environment; `MIGRATION_DATABASE_URL` using its migration role; `MIGRATION_DATABASE_CA` containing its public root CA PEM |
| Railway variables | `RAILWAY_PROJECT`, `RAILWAY_ENVIRONMENT`, `RAILWAY_SERVICE`, HTTPS `APP_ORIGIN` |
| Database variables | `LANTERN_DB_EXPECTED_ENDPOINT` as public proxy host:port; `LANTERN_DB_NAME`; distinct `LANTERN_DB_RUNTIME_ROLE`, `LANTERN_DB_MIGRATION_ROLE`, `LANTERN_DB_ADMIN_ROLE` |

The workflows use schema `lantern`. Create the database TCP proxy to port 5432. Supply the migration URL without TLS query parameters; the runner adds TLS verification against the supplied private CA and removes its temporary certificate file afterward. Export only the public `/var/lib/postgresql/data/certs/root.crt` through trusted Railway access; never export private keys. Add the two migration secrets privately using the GitHub environment settings or `gh secret set NAME --env ENVIRONMENT` (interactive hidden input). The public proxy hostname does not match Railway's database certificate, so the client verifies the database-specific CA. See [the release decision](docs/adrs/0001-release-migrations.md).

For the staging cutover, configure the migration secrets and variables before merging. Verify the merged-main migration, upload and readiness job succeeds, then delete the old staging migration service and remove GitHub's `RAILWAY_MIGRATION_SERVICE` variable. Do not delete the working service before verification.

For first production setup, the owner uses a dedicated empty database and builds the chosen revision locally. With private owner credentials, run `npm run db:bootstrap` using `LANTERN_ENV=production`, `LANTERN_DB_SETUP_MODE=empty`, the database variables above, `LANTERN_DB_SCHEMA=lantern`, `LANTERN_DB_SOURCE_OWNER` and `BOOTSTRAP_DATABASE_URL`. This creates three NOLOGIN roles and the application schema; it aborts if the database is occupied or the roles/schema exist. In the owner's private PostgreSQL session, use `\password <role>` and `ALTER ROLE <role> LOGIN;` for each role. Configure the runtime URL only on the webapp and the migration URL only in GitHub. Configure Google's production callback and approval/domain settings separately through the existing administrative commands. Keep bootstrap/admin credentials out of GitHub and application settings. After setup, dispatch the production workflow and verify the SHA, schema and readiness result. Stop on target mismatch, bootstrap/migration failure or failed readiness; inspect the failure before retrying. Close owner sessions and remove any temporary credentials/grants after setup.

The Railway application uses the root Dockerfile, `node dist/server/index.js`, `/health`, a 120-second health timeout, and an on-failure restart policy with three retries. Hosted settings include `NODE_ENV=production`, `LOCAL_ACCESS=0`, `LANTERN_HOSTING_ONLY=0`, `HOST=0.0.0.0`, the environment-specific `LANTERN_ENV`, HTTPS `APP_ORIGIN`, Google credentials and the restricted runtime `DATABASE_URL`. Keep credentials outside Git.

`GET /health` checks the database and reports the release revision, deployment and schema in response headers. A failed migration stops application delivery. A failed readiness check requires inspection before retry; do not automatically undo committed migrations or deploy code incompatible with the current schema.

## Code

- `client/workspace/`: member and career-lead UI.
- `server/`: HTTP, authentication, persistence, migrations and administrative commands.
- `shared/`: typed contracts.
- `tools/release/`: delivery gates and readiness checks.
- `docs/`: product scope, priorities, domain language and architecture decisions.

[AGENTS.md](AGENTS.md) defines engineering principles. The optional [ticket-board tool](tools/ticket-board/README.md) works with an empty board; it does not define project direction.
