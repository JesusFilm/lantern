# Isolated system test accounts in staging and production

Date: 2026-10-21
Status: Proposed; owner decisions remain open

## Proposed decision

Provide three permanent password-authenticated system-test identities per
environment, bound to a dedicated department by an immutable operator-provisioned
registry. Use normal product interfaces and sessions, with additional isolation,
quotas and expiring run leases. Keep test accounts out of real-user directories
and prevent enrollment across the test/real distinction.

For production, restrict synthetic product requests at the database as well as
the application layer. Give a separate private runner an execution-only control
credential for fixed workspace lifecycle operations. Reset disposable focuses,
including confirmed focuses, direction and sessions while retaining the three
identities. Cleanup must refuse foreign relationships and stale run tokens.

This would replace ADR 0006's temporary staging identities, direct session creation
and migration-credential cleanup. Its browser journeys, exact-revision evidence
and staged rollout remain useful. The existing PR does not implement this proposal.

## Rationale and consequences

A password login gives automated and human testers a reliable browser login in
both environments. Existing product rules cannot delete whole focuses or saved
initiatives, so a narrow synthetic reset avoids expanding real-user deletion
powers. A department alone is insufficient: the global account directory,
enrollment of unassigned accounts and global write lock need changes first.

This adds a production authentication method, schema/privilege changes and
credential/recovery operations. Shared hosting still has shared resource costs,
and password acceptance does not test Google login. A fourth synthetic outsider
is optional if live production cross-department proof is required.

The [draft plan](../operations/system-test-team-plan.md) contains the data lifecycle,
security model, implementation sequence, proof obligations and unresolved owner
choices. Keep this record proposed until those choices are agreed; do not treat
it as authorization to provision accounts, change production or activate delivery.
