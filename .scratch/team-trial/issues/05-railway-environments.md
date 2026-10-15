Kind: ticket
ID: team-trial/05
Title: Configure isolated Railway stage and production access
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 01, 04
Implementation: Not started
Slice: Hosted team trial

---
## Outcome

Stage is available for authenticated QA, and production is separately configured for later promotion. Agent preparation is possible; real account/credential choices and provider setup require the operator.

## Inputs before execution

Railway project access and permission for the GitHub App to read JesusFilm/lantern; intended plan/budget; stage/prod domains; separate Google OAuth projects/clients; approved work domains and real lead/QA identities. Obtain/store these privately. This planning task does not authorize provisioning charges or invent credentials.

## Acceptance

- [ ] Stage/prod application and PostgreSQL resources are prepared with separate databases, credentials, OAuth callbacks and exact-email approval stores; only stage is activated for QA in this ticket. Test that stage cannot read/write production records. Use synthetic stage content.
- [ ] Both apps use normal authentication, NODE_ENV=production and no local bypass. Set Railway port/interface, HTTPS APP_ORIGIN, healthcheck and migration entrypoint; secrets remain outside Git/client bundles.
- [ ] Prepare real Google clients and exact callbacks for each environment. In stage, approve lead/QA emails directly in its database, bootstrap lead membership, and add approved QA members. Prepare production resources and private configuration only; do not activate an incomplete production app or enroll trial participants before 07.
- [ ] Stage URL is accessible to approved QA users; unapproved same-domain and external accounts are refused. Verify cookies, cancellation/retry and sign-out with the real provider.
- [ ] Disable production autodeploy. Record environment/service identifiers and commands without secrets so 07 can promote a specific tested commit.
- [ ] Configure backup retention and perform a restore into an isolated disposable database; show retained records are readable and record recovery time/result. Never restore over live data for rehearsal.

## Evidence

Record sanitized configuration checklist, stage URL, deployed SHA and backup/restore result in the release evidence. Actual credentials/emails remain private. Complete only when live setup succeeds; code tests do not substitute. [Research](../../../docs/research/railway-team-trial.md).

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
