Kind: ticket
ID: team-trial/12
Title: Agree production database and operator access policy
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: None
Implementation: Policy decisions agreed; access inventory and verification outstanding; planning only
Slice: Hosted team trial

---
## Outcome

Define who may change production data, through which controlled mechanism, and what approval and evidence are required before granting production operational access. Documented commands alone are not access control.

## Context

The staging bootstrap used versioned schema migrations, compiled domain/email/lead operations over Railway SSH, and member assignment through the application. Additional SQL was read-only verification. The existing operator CLI consumes the application DATABASE_URL and does not record an authenticated operator audit trail. Actual provider grants must be inventoried; do not assume a particular database role is a superuser. Prior tickets permit direct database approvals without specifying a production governance boundary.

## Agreed decisions — 2026-10-16

The authoritative agent directive is the repository-root `AGENTS.md`, section "Production access and change records". These decisions describe required behavior, not implemented controls.

- Jaco is the initial access owner and sole approver/executor of production releases, migrations and administrative changes. No second approver is required. Backup owner remains an open question; other career leads require a future explicit decision.
- Agents have no production access, production credentials or real conversation data. Authorized local/staging work uses synthetic data and credentials unable to reach production or retrieve its secrets.
- Separate runtime, migration and administrative privileges. Jaco initiates versioned schema migrations through the migration runner and manually executes controlled administrative scripts for data changes.
- Conversation visibility is limited to each member and Jaco as their designated lead. During dogfooding, Jaco may manually enroll members and assign himself as career lead while administration functionality is absent. These are routine operations, not emergencies; no new admin UI is required.
- Prepare scripts with target checks, expected affected-row counts, abort conditions, transactions where supported, verification and recovery instructions. Agents test only with synthetic data; Jaco supplies sensitive production values privately.
- Use `docs/operations/production-changes.md` for sanitized operational records, even without a PR. Prepare a planned entry before routine execution; record applied/failed outcomes, execution date, script version/digest, sanitized reason/effect, executor, verification and cleanup afterward based explicitly on Jaco's report. Never infer execution from preparation. No organizational Changelog submission is required.
- Keep this sanitized changelog for the repository's lifetime, including archival. Exclude affected people's identities, person-linked identifiers, conversation text, credentials and sensitive SQL values. Private supplementary records are needed only when necessary sensitive details warrant retention. Repository history is traceability, not tamper-proof auditing.
- If an entry cannot be prepared, routine operations wait. Jaco may defer recording only to stop active private-data exposure, prevent imminent data loss, or restore an outage that cannot reasonably wait. Keep a minimal secure note and complete the sanitized record, outcome review and cleanup once stable. Agent production access remains prohibited.
- Console use is task-specific; close sessions and remove temporary credentials/grants afterward. Jaco's normal owner account may remain. Review access before activation and on joining, leaving or responsibility changes; remove inappropriate access promptly and rotate/revoke potentially exposed credentials. No recurring review schedule or fixed access-duration target is required for this trial.
- Any member may request data removal at any time. Jaco performs controlled removal, verifies it and records a sanitized outcome. Account for backups and restoration so deleted records do not inadvertently return; do not promise immediate erasure from every copy. No additional retention-policy exercise is required by this decision.
- Before activation, verify agent/production separation, database privilege separation and member isolation. Jaco performs production-side inspection and supplies sanitized findings. Unverified or unenforceable boundaries keep production inactive pending an explicit decision on the limitation and alternative. Document residual provider-owner powers honestly.

## Acceptance and remaining work

- [x] Agree accountable owner, human approval model, access paths, routine dogfooding operations and emergency criteria.
- [x] Agree sanitized change-record process, retention, recording-failure behavior and sensitive-data exclusions.
- [x] Agree task-specific access cleanup, event-based review/revocation and member-requested removal.
- [x] Record the decisions in local repository AGENTS.md and map enforcement checks to ticket 13. Publication/merge has not occurred in this planning chat.
- [ ] Inventory effective Railway workspace/project roles, SSH/console access, secret visibility, database grants/network entry points and deployment-token scope under separately authorized work. Production inspection is human-only; agents receive sanitized findings.
- [ ] Record the resulting access/threat model, actual provider limitations and any explicitly accepted residual risks. Do not assume superuser grants or that documented intent is enforced.
- [ ] Reconcile the verified inventory with ticket 13 and publish the reviewed planning changes. No enforcement is marked complete by this discussion.

## Boundary

Planning only. Keep production inactive and automatic staging delivery disabled. No permissions, credentials, infrastructure, databases, application code or delivery switches change under this ticket update; no deployment workflows run. Do not install production credentials to discover whether controls work. Backup ownership and additional career leads remain named open questions. Separate release, recovery and acceptance prerequisites remain outstanding.

## Trial simplification — 19 October 2026

Jaco adopted manual trial releases and deferred IaC/release automation. Existing
access, operational record and human-only production policies remain in force.
Ticket 13 retains concrete access verification and usable operations; a general
administrative framework and separate emergency-policy ceremony rehearsal are not
trial requirements. See the [current breakdown](../breakdown.md).
