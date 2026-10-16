Kind: ticket
ID: team-trial/15
Title: Configure and prove automated staging and promotion gates
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 05, 13, 14
Implementation: Not started; planning only
Slice: Hosted team trial

---
## Outcome

Produce trustworthy exact-revision staging evidence using the existing workflows, and demonstrate that missing/failed evidence prevents production promotion. Do not create a duplicate promotion workflow.

## Acceptance

- [ ] Inspect merged ci.yml/promote.yml and target variables; provide an environment-scoped stage deployment token only after access/configuration prerequisites pass. Verify branch restrictions, required checks and disabled Railway independent autodeploy paths.
- [ ] Enroll a second distinct ordinary QA member through the approved process. Obtain two real Google member sessions and privately install QA_MEMBER_A_SESSION and QA_MEMBER_B_SESSION. A lead session is not a substitute. Define secure session renewal, expiry handling and synthetic-record retention; never mint sessions or add an auth bypass.
- [ ] Obtain separate authorization before setting repository STAGE_DELIVERY_ENABLED=true or running deployment workflows. Until then leave it unset/false. Run checked main delivery and verify exact-SHA/deployment CLI receipt, migration/readiness, anonymous denial, synthetic draft persistence and other-member denial. Retain the named passing stage artifact.
- [ ] Demonstrate failed/cancelled checks prevent delivery; missing/expired QA sessions and failed smoke produce no passing artifact; a later main commit cannot replace the pinned candidate. Verify a migration/readiness failure blocks release using disposable controlled tests and preserves a previously healthy revision where applicable.
- [ ] Verify the existing explicit SHA/run promotion gate rejects missing, expired, mismatched or failed evidence before any production deployment. Use non-deploying tests/safe targets; no production credentials or activation are required to test rejection. Confirm production cannot deploy from a merge.
- [ ] Document automated smoke coverage limits: it does not perform Google login, confirm/lock or full lead/newcomer acceptance. Its production branch checks public readiness/login/anonymous denial, not authenticated production behavior.
- [ ] Record the acceptance-record trust boundary: workflow currently validates an HTTPS URL, not its contents. Establish a versioned release checklist, accountable operator sign-off and protected evidence location; decide explicitly whether stronger machine enforcement is required before production. Keep sensitive evidence private while retaining sanitized references.
- [ ] Record run, revision, deployment, schema, artifact, negative-gate outcomes and session renewal owner. Reset the switch to false if activation verification fails. Successful automation does not close ticket 06 or authorize promotion.

## Boundary

Ticket 11's latest-main input simplification remains optional. This planning update does not authorize enabling staging delivery, creating secrets, running drills or dispatching production.
