# Release migrations in GitHub Actions

Date: 2026-10-20
Status: Accepted by the repository owner

The manual-only production trigger is superseded by
[ADR 0006](0006-authenticated-release-acceptance.md). The migration architecture
and credential separation below remain in force.

GitHub Actions applies versioned database migrations before deploying the webapp from the same full main commit SHA. Staging runs automatically after successful main checks; production is manually dispatched. Production receives the schema and application only, with its data kept separate.

Within each environment, the webapp and migration scripts connect to the same PostgreSQL database using different accounts and network routes. The webapp uses Railway’s private network and a restricted runtime account. GitHub Actions runs outside that private network, so migrations use a public PostgreSQL TCP proxy and a schema-changing migration account. Each GitHub environment holds that connection and the public certificate for its database’s private certificate authority (CA), which the runner uses to verify TLS. Owner and administrative credentials remain outside delivery jobs.

The variable names and their storage locations are documented in [Environment variables](../../README.md#environment-variables).

This avoids a separate migration service and keeps schema-changing credentials out of the webapp. It requires public database connectivity, private credential setup and CA updates when the database certificate authority changes. Railway's certificate names do not match its public proxy hostname, so the migration client verifies the pinned private CA rather than the proxy hostname. Failed migrations block deployment; committed schema changes are not automatically rolled back. Migrations must remain compatible with the application still serving during deployment.
