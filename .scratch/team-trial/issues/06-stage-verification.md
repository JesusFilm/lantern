Kind: ticket
ID: team-trial/06
Title: Verify the initial workflow with real stage participants
Milestone: M06
Type: task
Status: ready-for-human
Blocked by: 02, 03, 05, 13, 14
Implementation: Partial manual staging save/read proof; full candidate acceptance outstanding
Slice: Hosted team trial

---
## Current execution boundary — 16 October 2026

Real Google staging and bounded member-save/lead-read proof are recorded in [activation evidence](../../../docs/operations/staging-activation-evidence.md). Full acceptance is incomplete. Production remains inactive and automatic stage delivery remains disabled. This planning update does not authorize either activation. The dependency-ordered production prerequisites are in the [breakdown](../breakdown.md).

## Outcome

There is practical evidence that the staged revision supports a member's initial focus and the career lead's review/confirmation without exposing other members' data.

## Acceptance

- [ ] Verify reviewed access-governance controls (13), bounded configuration checks (14), and transactional failure/schema-compatible rollback checks for the applicable final candidate/configuration. Backup ticket 16 is deferred until after dogfooding/value assessment. Revalidate changed code/schema; manual staging evidence is valid for the trial, with its actual coverage recorded.

- [ ] Record exact Git SHA/deployment and passing PR/main CI plus recorded manual stage checks. Automated stage artifacts are not required. Verify the release evidence refers to the same candidate revision; record human acceptance separately. Reconcile any change after these checks before sign-off.
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

## Backup decision — 19 October 2026

No staging backups; production backups deferred until dogfooding is complete and
Jaco has determined application value. [Ticket 16](16-backup-restore-readiness.md)
is deferred and does not block this ticket. Transaction checks and data-preserving
failure handling remain required; no reset or deletion is authorized by this decision.

## Acceptance continuation — 19 October 2026

On revision `3349636a031d86b90c534e71e4a02d416a8f7df7`, the existing ordinary
member created a clearly synthetic focus, Normal objective and SMART goal; all
values persisted after browser reload. Temporarily revoking that member's email
approval denied a direct document request from the existing session. Approval was
restored, the same session regained access, and document counts were unchanged.
The career lead's department route displayed the same content as read-only with
no editing controls. Anonymous list/detail/roster checks returned 401.

Jaco nominated a second Google account, now approved on staging only. Its real
Google sign-in and subsequent lead enrollment are pending. No identities or
sessions were fabricated; full two-member isolation/smoke is not yet passed.
The existing memberships remain intact and the synthetic document is retained.
See [sanitized partial evidence](../../../docs/operations/member-acceptance-2026-10-19.json).

### Two-member case deferred — 19 October 2026

Jaco explicitly parked this case. A second distinct Google member session is not
available. Preserve completed single-member, revocation/restoration and lead
read-only results; do not mark two-member isolation or full release acceptance
as passed. Unused nominee email approvals were removed; existing lead/member
accounts and retained synthetic test documents are unchanged. Resume when Jaco
requests it and a second distinct Google account is available.

## Adopted simplification — 19 October 2026

Jaco approved the simplification described in the [current breakdown](../breakdown.md). Use the revised acceptance above and the [manual release procedure](../../../docs/operations/hosted-release.md). Historical execution notes remain evidence, not instructions to repeat completed work. Production execution remains separately authorized; two-member acceptance stays parked.
