# Release migrations in GitHub Actions

Date: 2026-10-20
Status: Accepted by the repository owner

GitHub Actions applies versioned database migrations before deploying the webapp from the same full main commit SHA. Staging runs automatically after successful main checks; production is manually dispatched. Production receives the schema and application only, with its data kept separate.

Each GitHub environment holds its own migration-role connection and database CA certificate. Migrations connect through a public PostgreSQL TCP proxy with TLS and verification against that database's private CA. Runtime retains a separate, restricted connection; owner and administrative credentials remain outside delivery jobs.

This avoids a separate migration service and keeps schema-changing credentials out of the webapp. It requires public database connectivity, private credential setup and CA updates when the database certificate authority changes. Railway's certificate names do not match its public proxy hostname, so the migration client verifies the pinned private CA rather than the proxy hostname. Failed migrations block deployment; committed schema changes are not automatically rolled back. Migrations must remain compatible with the application still serving during deployment.
