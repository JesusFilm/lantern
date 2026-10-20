# Authenticated staging acceptance before automatic promotion

Date: 2026-10-21
Status: Accepted by the repository owner

[ADR 0008](0008-staging-gate-and-production-smoke.md) refines the release policy:
GitHub notifications, a usable manual acceptance override, engineer recovery and
minimal production smoke. The broader ADR 0007 proposal is superseded. The private
staging runner remains implemented; permanent password login is not implemented.
Initial hosted activation was subsequently rehearsed and owner-authorized; see the
dated [rollout record](../operations/release-confidence.md). Future activation
still requires rehearsal and owner authorization.

## Decision

Keep the existing PostgreSQL, HTTP, browser, migration and packaging tests.
Add a bounded browser acceptance journey against the actual staging deployment
after readiness. A private runner creates disposable synthetic accounts,
memberships and 15-minute ordinary sessions through the existing protected
staging migration connection. It holds a database lock across fixture recovery,
creation, browser work and cleanup. Product actions cross the normal browser/HTTP
interfaces with the deployed runtime's restricted database privileges.

No runtime authentication route, production secret or application schema change
is added. Raw session tokens remain in runner memory; evidence contains only
release identifiers and fixed check names. Interrupted fixtures are recovered
under the same lock on the next run. Unexpected relationships abort cleanup and
block acceptance instead of deleting unrelated records.

Add separately enabled automatic production promotion after the exact main CI
run and attempt succeeds with matching readiness, authenticated acceptance and
cleanup evidence. Check current main, staging deployment and advertised schema
again under the production lock immediately before migrations. Initially require
production's advertised schema to match staging; keep schema-changing releases
manual. Retain explicit manual promotion of a selected main SHA: preserve readiness
before acceptance and independently verify successful prerequisites and staging
readiness even when the later journey or cleanup fails. Keep both outcomes in a
safe diagnostic summary that never substitutes for passing acceptance evidence.

## Rationale and alternatives

The local suite already covers core workflows and authorization failures; the
missing evidence is the combination of compiled assets, HTTPS sessions, hosted
runtime, database permissions and persistence. Short-lived ordinary sessions
test that combination without exposing an impersonation endpoint.

Automating Google credentials adds a separate external dependency and does not
remove the need for several application roles. A secret-protected public testing
login would add a credential and authentication surface to the webapp. The
existing staging schema owner already has the authority to create fixture data;
using it in the protected runner adds no database grant.

## Consequences

This is post-login acceptance, not proof of a real Google login. Real Google
sign-in remains separate acceptance for initial rollout and authentication or
OAuth-configuration changes. The synthetic lead has normal staging lead
permissions, including the registered-user directory; its token must remain
private even though test documents are synthetic.

Synthetic stage data cannot establish production migration/backfill safety.
The schema guard compares application-advertised versions, not a complete
production database inventory. Failed manual migrations require operator
recovery. This change preserves [ADR 0001's](0001-release-migrations.md)
same-revision migration/deployment and does not implement automatic rollback.

Both acceptance and automatic production switches default unset/off. Design
approval alone does not activate them. Current operator steps are in
[Releasing](../operations/releasing.md), coverage in [Testing](../development/testing.md),
and dated execution evidence in [release confidence](../operations/release-confidence.md).
