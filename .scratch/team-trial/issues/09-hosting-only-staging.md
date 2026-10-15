Kind: ticket
ID: team-trial/09
Title: Deploy locked-down staging and verify hosting without login
Milestone: M06
Type: task
Status: ready-for-agent
Implementation: Authorized 16 October 2026; preparation in progress
Slice: Hosted team trial

---
## Outcome

A reachable Railway staging deployment proves hosting, migrations and database readiness while authentication remains deferred. This is an intermediate hosting milestone, not authenticated application acceptance.

## Scope and acceptance

- [ ] Reuse the existing Railway project/environment named `staging`. Provision a small application and separate PostgreSQL service after inspecting existing resources. Use a Railway-generated domain. Preserve local services/data and prototype hosting; leave production inactive.
- [ ] Add an explicit, fail-closed hosting-only configuration with public-behavior TDD. Use `NODE_ENV=production`, `LANTERN_ENV=stage`, and no `LOCAL_ACCESS`. Login is unavailable; every protected request remains denied, including previously issued sessions. Production cannot select the hosting-only exception. Missing credentials in ordinary authenticated mode still fail configuration validation.
- [ ] Document how to start hosting-only mode and later return to authenticated mode. Keep credentials and participant identities out of source, logs and evidence.
- [ ] Deploy only a reviewed, known merged SHA with successful main CI. Record exact SHA, deployment ID/URL, migration and readiness results. Preparing branch changes is authorized; pushing, merging or production promotion is not authorized by this ticket.
- [ ] Run separate hosting smoke: public application loads, database-backed readiness succeeds, login is unavailable, and protected HTTP data/mutations are denied. Record observed results and failures against the deployed SHA.
- [ ] Keep repository Actions variable `STAGE_DELIVERY_ENABLED` unset/false. Existing authenticated smoke requires real approved sessions and remains pending, not passed or replaced by hosting checks. Do not weaken its assertions or treat intentionally failing authenticated smoke as acceptable delivery evidence.

## Handoff

Resume authenticated bootstrap and unattended delivery only after [10](10-authentication-provider-decision.md) settles identity policy and [05](05-railway-environments.md) verifies real sessions and required gates. Full feature acceptance remains [06](06-stage-verification.md); backups/restore and remaining environment setup remain in 05. A later feature merge requires checks on its own revision. Hosting-only success grants no production promotion eligibility.
