# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Milestone classification

This repository adds a milestone convention alongside the Matt Pocock skills. The skills provide planning maps, specifications and tickets; they do not prescribe a milestone record type.

- Create one feature/initiative folder: `.scratch/<milestone-slug>/`.
- Record its high-level outcome in `milestone.md`, with `Kind: milestone` in the metadata header. Both the file location and this explicit declaration are required for a milestone record. The folder groups related work; its name alone does not classify it.
- Use a stable unique ID (M01, M02, …), Title, Status, Slice, Sequence, Target and Summary. For milestones, Status expresses progress using the stages below. Ticket readiness labels remain separate.
- Keep the completion criterion and intended scope in the milestone body. Keep its evolving planning questions and decisions in adjacent `map.md`, labelled `wayfinder:map`.
- After planning, `to-spec` produces adjacent `spec.md`. `to-tickets` publishes the approved breakdown under `issues/NN-slug.md`. Those records default to `Kind: ticket`; add `Milestone: M01` to identify their parent explicitly.
- Individual Wayfinder decision tickets also live under `issues/`. Their existing `Type` and `Status` conventions distinguish planning questions from implementation work; Kind is not a replacement for Type.
- Milestones live outside `issues/` so they are never mistaken for ready-to-execute implementation tickets. Reading a milestone or marking its scope accepted is not permission to implement it.
- The board shows Milestone/Ticket badges and an Item type filter. It reads milestone files and individual tickets; maps and specs are not shown as additional cards.

Minimal milestone header (then `---` and the outcome, completion criterion and planning context):

```text
Kind: milestone
ID: M06
Title: A new roadmap outcome
Status: Planning
Slice: Feature name
Sequence: 6
Target: To be agreed
Summary: The value this outcome will provide.
```

## Milestone progress

Use `Status: Planning`, `Specification`, `Delivery`, `Verify`, `Learn`, or `Complete` on milestone records. The usual order is Planning → Specification → Delivery → Verify → Learn → Complete.

| Stage | Meaning |
| --- | --- |
| Planning | Clarify the outcome, scope and decisions. |
| Specification | Synthesize resolved decisions into a specification and review the delivery breakdown. |
| Delivery | Carry out the agreed work. |
| Verify | Check the delivered result against the agreed outcome. |
| Learn | Record useful lessons and decide follow-through. |
| Complete | Close the effort with its outcome recorded. |

These are descriptive stages, not enforced gates. Verify and Learn are optional; skip them when they add no value, and revisit earlier stages when needed. Verification may succeed or fail. Failure can lead to rollback, Learn and Complete; successful verification can lead directly to Complete. Record rollback, evidence, lessons and the closure outcome in the milestone body as applicable. Complete means the effort is closed, not necessarily that delivery succeeded; explicitly state unmet criteria or withdrawn changes rather than marking them achieved.

Advance a milestone to Specification when its planning decisions are resolved and specification work starts. A stage change alone never authorizes implementation or overrides an agreed verification requirement. Ticket readiness and Wayfinder claim/resolution statuses continue to apply only to tickets. Milestones without a Status default to Planning; migrate legacy milestone readiness labels explicitly rather than inferring delivery progress from them.

## Repository planning

- Roadmap and discovery entry point: `.scratch/roadmap/map.md`.
- Keep candidates, agreed decisions and unresolved questions distinct. Create implementation tickets after the user approves the breakdown.
- `.scratch/` planning files remain eligible for Git tracking. Store product requirements and agreed implementation tickets, with personnel records outside Git.

## Live ticket board

Start `npm run tickets` and open http://127.0.0.1:4393. The feature-group layout reads milestone files and local issue files on every request and refreshes while open. Ticket edits require no HTML regeneration. An empty tracker produces an empty board. Milestones appear only from recorded milestone files; no sample data is generated. The viewer lives under `tools/ticket-board/`, outside the tracker. Metadata headers and the skills’ bold Markdown status/blocking fields are supported.
