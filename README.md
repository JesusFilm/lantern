# Lantern

Lantern helps members write objectives and SMART goals, discuss their position focus with a career lead, and confirm the agreed document. Google sign-in, department membership and server-enforced ownership control access.

[Product scope](docs/PRD.md) · [Roadmap](docs/ROADMAP.md) · [Architecture decisions](docs/adrs/AGENTS.md)

## Development

For test setup, focused/full commands, coverage and limits, read [Testing](docs/development/testing.md). Test fixtures use an isolated local owner connection; application setup below uses restricted runtime/migration/admin connections. Preserve existing private environment files and database volumes.

For a fresh local application database:

1. Create a dedicated database using the local PostgreSQL owner. Set `LANTERN_ENV=local`, `LANTERN_DB_SETUP_MODE=empty`, `LANTERN_DB_EXPECTED_ENDPOINT=127.0.0.1:55439`, `LANTERN_DB_SOURCE_OWNER=career_lead`, `LANTERN_DB_NAME`, `LANTERN_DB_SCHEMA`, and distinct `LANTERN_DB_RUNTIME_ROLE`, `LANTERN_DB_MIGRATION_ROLE`, `LANTERN_DB_ADMIN_ROLE` values.
2. Supply `BOOTSTRAP_DATABASE_URL` privately and run `npm run db:bootstrap`. It creates the schema and three restricted NOLOGIN roles. Privately enable login with separate passwords for those roles.
3. Put the target settings and migration-role `MIGRATION_DATABASE_URL` in `.env.migration`; run `npm run db:migrate:local`.
4. Put the target settings and admin-role `ADMIN_DATABASE_URL` in `.env.admin`; run `npm run access:ops -- local-account` to prepare the synthetic local account.
5. Copy `.env.example` to `.env` only if `.env` does not exist. Replace `DATABASE_URL` with the runtime-role connection. Run `npm run dev:local` for the loopback walkthrough or `npm run dev` for Google authentication.

With `LANTERN_ENV=local` and `LOCAL_ACCESS=1`, startup automatically adds the four current Engineering initiatives to the synthetic local account’s active department. A loopback database is required. Their icons and colours match staging: pink heart, blue lightbulb, green sprout and yellow people. Repeat runs keep existing IDs, archive status, appearances, mission, extra initiatives and documents; only missing initiatives or missing appearances are filled. Removed membership stays removed. Ordinary Google-authenticated startup and hosted environments do not run this seed.

For Google sign-in, configure a Web OAuth client with the callback `APP_ORIGIN/auth/google/callback`, then provide its credentials privately. Local access defaults off and is rejected in production. `server/operations.ts` provides approval and department setup commands; use the admin connection separately from application runtime.

## Delivery

For automatic/manual releases, schema changes, evidence verification and failure recovery, read [Releasing](docs/operations/releasing.md). [ADR 0008](docs/adrs/0008-staging-gate-and-production-smoke.md) records the current release policy.

Main is the staging delivery path; production can lag. Verify the deployed SHA. The following setup reference is for initial provisioning or credential/hosting changes.

Configure the settings listed under [Environment variables](#environment-variables) separately for staging and production.

The workflows use schema `lantern`. Create the database TCP proxy to port 5432. Supply the migration URL without TLS query parameters; the runner adds TLS verification against the supplied private CA and removes its temporary certificate file afterward. Export only the public `/var/lib/postgresql/data/certs/root.crt` through trusted Railway access; never export private keys. Add the two migration secrets privately using the GitHub environment settings or `gh secret set NAME --env ENVIRONMENT` (interactive hidden input). The public proxy hostname does not match Railway's database certificate, so the client verifies the database-specific CA. See [the release decision](docs/adrs/0001-release-migrations.md).

Obtain the migration connection from the database owner's private provisioning configuration for the dedicated migration account. Preserve its username, encoded password and database name, and use the public TCP proxy endpoint shown on that environment's Postgres service. Remove query parameters. The Postgres service's owner connection is not a migration connection. Obtain `MIGRATION_DATABASE_CA` from the **Postgres** service's public root certificate. Production requires its own migration account, endpoint and certificate; never reuse staging credentials.

For first production setup, run [the owner setup helper](tools/release/setup-production.sh) with `bash tools/release/setup-production.sh` from a clean checkout of current main on your own computer. It requires Node 24, Git, GitHub CLI, Railway CLI and PostgreSQL `psql`, with private owner access. The helper checks a staging-verified main SHA, bootstraps a dedicated empty database, guides separate role passwords and OAuth setup, installs production-scoped settings, and dispatches the SHA-pinned workflow. It retains restricted operator settings in a private folder outside the repository; move that folder to secure storage. Do not replay bootstrap after it succeeds or reset an existing database. If configuration fails after stage 5, use `bash tools/release/setup-production.sh --resume-config /absolute/path/to/lantern-production-settings.XXXXXX` with the private folder printed by the helper. This skips database bootstrap and password changes, checks GitHub access, and recollects unsaved runtime/OAuth/token values before retrying configuration. Sign-in requires private exact-email approval through the existing administrative commands; personal and work accounts are both eligible.

The Railway application uses the root Dockerfile, `node dist/server/index.js`, `/health`, a 120-second health timeout, and an on-failure restart policy with three retries. The required application settings are listed below.

`GET /health` checks the database and reports the release revision, deployment and schema in response headers. A failed migration stops application delivery. A failed readiness check requires inspection before retry; do not automatically undo committed migrations or deploy code incompatible with the current schema.

## Environment variables

There is one application database per environment. `DATABASE_URL` and `MIGRATION_DATABASE_URL` connect to that same database with different accounts; “migration” names the purpose of the connection, not a separate database. Railway's webapp uses the private database hostname; GitHub's migration runner uses the public TCP proxy. [ADR 0001](docs/adrs/0001-release-migrations.md) explains this decision.

### GitHub Actions

Store these under repository **Settings → Environments → `stage` or `production` → Environment secrets/variables**. GitHub `stage` maps to Railway `staging`. Use distinct credentials and target IDs for each environment.

| Name | Store as | Purpose |
| --- | --- | --- |
| `RAILWAY_TOKEN` | Secret | Environment-scoped token permitting deployment to the intended Railway environment. |
| `MIGRATION_DATABASE_URL` | Secret | PostgreSQL connection string containing the migration account, password, public host/port and database name. Supply no query parameters; the runner configures TLS. |
| `MIGRATION_DATABASE_CA` | Secret | Public root CA certificate in PEM format used to verify the database's TLS connection. The certificate is not confidential, but is kept with the deployment credentials for integrity and environment-specific configuration. It contains no private key. |
| `RAILWAY_PROJECT` | Variable | Railway project ID. |
| `RAILWAY_ENVIRONMENT` | Variable | Railway environment ID, not its display name. |
| `RAILWAY_SERVICE` | Variable | Webapp service ID, not the database service ID. |
| `APP_ORIGIN` | Variable | Public webapp HTTPS origin, without a trailing slash; used for configuration and readiness checks. Must match Railway's application setting. |
| `LANTERN_DB_EXPECTED_ENDPOINT` | Variable | Expected public database `host:port`; rejects a migration URL pointing elsewhere. |
| `LANTERN_DB_NAME` | Variable | Existing database name; checked before migration. |
| `LANTERN_DB_RUNTIME_ROLE` | Variable | Webapp database account name: `lantern_stage_runtime` or `lantern_production_runtime`. |
| `LANTERN_DB_MIGRATION_ROLE` | Variable | Schema-changing account name: `lantern_stage_migration` or `lantern_production_migration`. |
| `LANTERN_DB_ADMIN_ROLE` | Variable | Administrative account name used when granting permissions: `lantern_stage_admin` or `lantern_production_admin`. This is not its password or connection string. |

`STAGE_DELIVERY_ENABLED` is a **repository Actions variable**, under **Settings → Secrets and variables → Actions → Variables**, rather than an environment variable. Set it to `true` to enable automatic staging delivery after successful main checks.

The same repository-variable location holds `STAGE_ACCEPTANCE_ENABLED` (enable
authenticated staging journeys), `AUTO_PRODUCTION_ENABLED` (enable the gated
production trigger), and `STAGE_APP_ORIGIN` (the staging HTTPS origin used by the
production gate). For a new environment, enable these through the
[activation procedure](docs/operations/activating-delivery.md).
Acceptance reuses the existing **stage** migration secrets and role settings;
it requires no additional secret or production authentication bypass.

The workflows supply `LANTERN_DB_SCHEMA=lantern`, `RELEASE_TARGET`, `RELEASE_SHA`, `RELEASE_SMOKE_MODE` and `EXPECTED_SCHEMA_VERSION`. GitHub supplies the workflow token used as `GH_TOKEN`; release steps generate `STAGE_RUN_ID` and `EXPECTED_DEPLOYMENT_ID`. These are not manually configured settings.

### Railway webapp

Store these in the **webapp service's Variables** for the selected Railway environment. Keep migration, admin and owner connection strings out of this service.

| Name | Purpose / hosted value |
| --- | --- |
| `DATABASE_URL` | Secret runtime-account connection to the same environment's database through Railway's private hostname. Its account cannot change the schema. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client settings; the secret is confidential. The callback is `APP_ORIGIN/auth/google/callback`. |
| `APP_ORIGIN` | Public HTTPS origin without a trailing slash; must match GitHub's value and the Google callback configuration. |
| `LANTERN_ENV` | `stage` or `production`; selects admission rules. |
| `NODE_ENV` | `production` in both hosted environments; selects production execution behavior. |
| `LOCAL_ACCESS` | `0`; disables the local single-account walkthrough. |
| `LANTERN_HOSTING_ONLY` | `0`; enables normal authenticated application operation rather than a hosting-only sign-in-disabled shell. |
| `HOST` | `0.0.0.0`; listens on the container network. |
| `PORT` | Listening port supplied by Railway; local default is `4391`. |

Railway supplies `RAILWAY_DEPLOYMENT_ID` for release identification. PostgreSQL service credentials are managed on the database service; the webapp must receive its restricted runtime URL rather than a provider-owner URL.

### Local development and owner commands

Private local files are ignored by Git. `.env.example` contains only synthetic local defaults.

| Location | Settings and purpose |
| --- | --- |
| `.env` | Local application settings from `.env.example`, with `DATABASE_URL` replaced by the runtime connection. `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and `POSTGRES_PORT` configure the local Compose database; they are not hosted deployment settings. |
| `.env.migration` | Local `MIGRATION_DATABASE_URL` and database target settings for `npm run db:migrate:local`. The GitHub-only CA secret is not required for a loopback local connection. |
| `.env.admin` | `ADMIN_DATABASE_URL`, `LANTERN_ENV` and database target settings for `npm run access:ops`. This account manages application data, not the schema. |
| Owner's private command environment | `BOOTSTRAP_DATABASE_URL` for initial role/schema creation; `LANTERN_DB_SETUP_MODE=empty` and `LANTERN_DB_SOURCE_OWNER` identify the intended setup and existing owner. Keep this credential out of application files and GitHub. |

Database target settings are `LANTERN_DB_NAME`, `LANTERN_DB_SCHEMA`, the three role names above, and `LANTERN_DB_EXPECTED_ENDPOINT` for commands that check the connection endpoint. Locally use `LANTERN_ENV=local` and the loopback endpoint; production owner commands use production-specific targets. Setup commands are described under [Development](#development) and [Delivery](#delivery).

### Optional initiative seed setup

After deploying initiative descriptions with the 500-character limit, run
[`tools/database/seed-initiative-appearance.sql`](tools/database/seed-initiative-appearance.sql)
using the intended environment's operator connection. Replace
`REPLACE_WITH_DEPARTMENT_UUID` with the department ID returned by
`SELECT id, name FROM lantern.departments WHERE deleted_at IS NULL;`, then execute
the entire file in one connection. It is plain SQL, suitable for a SQL editor or
`psql -v ON_ERROR_STOP=1 -f tools/database/seed-initiative-appearance.sql` with your
connection already configured outside the command.

The script adds missing agreed initiatives and assigns their approved descriptions,
bundled SVG icons and colors. Matching initiatives receive those descriptions and
preset appearances too. Existing names are matched ignoring case and surrounding whitespace;
IDs, archive status, mission, unrelated initiatives and focus history are preserved.
It is safe to rerun and only advances the department configuration version when
data changes. Open settings pages must reload after a change. Appearance uses the
existing JSON document fields, so this feature needs no schema migration beyond
schema 7. The data setup is optional and is not run automatically on deployment.

### Update descriptions only (staging or production)

Use [`tools/database/update-initiative-descriptions.sql`](tools/database/update-initiative-descriptions.sql)
when the four initiatives already exist and their icons/colors should stay as configured.
Deploy the description feature with its **500-character limit first**: the approved
Role Clarity and Growth description is 408 characters, exceeding the previous limit.
Both scripts contain the owner's exact descriptions approved on 21 October 2026.

1. Open the intended database with its operator connection. Check
   `SELECT current_database(), current_user;` and find the department with
   `SELECT id, name FROM lantern.departments WHERE deleted_at IS NULL;`.
2. In a copy of the SQL file, replace the single `REPLACE_WITH_DEPARTMENT_UUID`
   placeholder with that department's UUID. Staging and production may have different IDs.
3. Run the entire file in one SQL-editor connection, or use
   `psql -v ON_ERROR_STOP=1 -f /path/to/your-edited-script.sql` with the connection
   configured privately. Repeat separately for the other environment.
4. Reload Mission & initiatives and Guide to verify the descriptions.

The script matches names ignoring case and surrounding whitespace, including
archived initiatives. It requires exactly one match for each name; missing or
ambiguous matches abort the transaction without partial changes. It updates only
descriptions, preserving names, IDs, icons, colors, archive state, ordering,
mission, unrelated initiatives and focus history. The configuration version advances
only if content changes, so an unchanged rerun is a no-op and stale settings saves
are rejected. This script is manual; it is not run on deployment.

## Code

- `client/workspace/`: member and career-lead UI.
- `server/`: HTTP, authentication, persistence, migrations and administrative commands.
- `shared/`: typed contracts.
- `tools/release/`: delivery gates and readiness checks.
- `docs/`: product scope, priorities, domain language and architecture decisions.

[AGENTS.md](AGENTS.md) defines engineering principles. The optional [ticket-board tool](tools/ticket-board/README.md) works with an empty board; it does not define project direction.

### Goal coaching

Configure the Qwen primary and OpenRouter fallback using [coaching operations](docs/operations/coaching.md). `COACH_ENABLED=1` requires both dedicated server-side credentials. With inference disabled, manual editing and review requests remain available.
