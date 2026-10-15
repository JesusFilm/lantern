Kind: ticket
ID: team-trial/06
Title: Verify the initial workflow with real stage participants
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 02, 03, 05
Implementation: Not started
Slice: Hosted team trial

---
## Outcome

There is practical evidence that the staged revision supports a member's initial focus and the career lead's review/confirmation without exposing other members' data.

## Acceptance

- [ ] Record exact Git SHA/deployment and passing PR/main CI plus post-deployment stage smoke/E2E checks. Verify the release evidence refers to the same candidate revision; record human acceptance separately. Reconcile any change after these checks before sign-off.
- [ ] With the real Google provider, separate lead and at least two member sessions, verify approved work and personal-member login (including Jaco's separate lead/member sessions), unapproved same-domain/personal/outsider denial, expired/signed-out/revoked access and absence of a local bypass.
- [ ] A newcomer uses the current guides to draft and reopen a titled/dated focus with objectives/goals; optional types and normal default work. Record confusing steps or failures, not invented successful observations.
- [ ] Lead browses members, drills into the intended focus, discusses and confirms it. Member/lead reads show the same immutable baseline after reload; stale edit fails without losing typed input.
- [ ] Each member cannot list/read/change the other's records via UI or direct requests. Ordinary members cannot fetch roster/lead endpoints. Confirm removal revokes a disposable QA member while retaining their data.
- [ ] Verify error/retry, persistence across restart, mobile readable layout and account switching. Use the [current verification checklist](../../../docs/system/guide-verification.md).
- [ ] Record anonymized observed outcomes and defects. Fix blocking failures using TDD, rerun affected checks, and verify the new revision before promotion. No test emails/personnel content in Git.

## Superseded work

Carries remaining relevant practical/live checks from guide tickets 06 and 09. Removed full-example, mission-banner, department-editor and multiple-department demonstrations are not acceptance requirements. No calendar deadline or universal objective-quality score.

## Sources and verification

Follow [current specification](../spec.md), [breakdown](../breakdown.md) and [AGENTS.md](../../../AGENTS.md). Application changes use failing public-behavior tests before implementation and isolated real PostgreSQL. Ticket readiness is not a claim of completed implementation or authorization to deploy.
