# Retained production settings own their package lifecycle

Date: 2026-10-20
Status: Accepted by the repository owner

## Decision

The [release settings module](../../tools/release/settings.mjs) owns creating a new
private production settings package and loading one for configuration resume. Its
interface accepts settings and a public CA for writing, or a package directory for
loading. It hides serialization, private file checks, production target validation,
and credential-safe errors. Loading returns only the migration and target settings;
it does not modify retained files or return administrative credentials. Existing
operator.env/root.crt packages remain readable.

The same module validates genuinely shared hosted migration target facts: target
roles, schema, database, public endpoint, migration URL and valid pinned CA. Caller
policies remain distinct. Owner packages require production, private files owned
by the current user, a password-bearing URL without a fragment, and exclusion of
the known staging endpoint. The CI launcher supports stage and production, rejects
runtime/admin/bootstrap credentials, verifies the selected full checkout SHA, and
owns migration execution and temporary certificate cleanup.

The [wizard](../../tools/release/setup-production.sh) retains owner prompts and
explicit mutation steps. A [command adapter](../../tools/release/settings-command.mjs)
passes private environment input to the module and emits validated data for the
wizard to read without shell evaluation. It uses the controller checkout's module,
including when the wizard changes into the selected application checkout.
[ADR 0001](0001-release-migrations.md) continues to govern delivery: migrations and
application use the same selected revision, separate accounts, the public proxy
and pinned private CA. This introduces no migration deployment or runtime migration.

## Rationale and alternatives

Extracting only the resume parser would leave package writing and validation
knowledge spread across callers. Consolidating release orchestration would couple
owner provisioning to CI and expand the interface beyond this maintenance problem.
A package lifecycle module provides depth: callers get a resumable package or
validated resume settings without learning the file format and checks. Shared
validation improves locality without making either caller adopt the other's policy.
No storage/hosting adapter hierarchy is needed.

## Consequences

Fresh writing validates before creating files, creates a unique 0700 directory with
0600 files, and removes its new incomplete package on a handled write failure. It
has no overwrite operation. Administrative TLS settings reference the retained CA;
runtime and owner credentials are not retained. Resume preserves the old format
and ignores retained administrative values, requiring runtime/OAuth/token capture
again in the wizard. Interrupted processes can still leave an incomplete private
folder; resume rejects it rather than repairing it or replaying bootstrap.

Tests cross the write/load interface and actual command adapters with temporary
packages and synthetic certificates, replacing heredoc source extraction. Existing
migration command tests continue to cover revision selection, credential policy and
certificate cleanup. No remote environment operation is required for these checks.
