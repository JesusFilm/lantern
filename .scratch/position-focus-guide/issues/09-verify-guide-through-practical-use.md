Kind: ticket
Title: Retire the superseded guide verification protocol
Milestone: M01
Type: task
Status: resolved
Blocked by: 07, 08
Implementation: Closed as superseded; human checks not performed or passed
Slice: Position focus baseline

---
# 09: Retire the superseded guide verification protocol

## Current disposition — 15 October 2026

This ticket is resolved by replacing its stale guide-only protocol with hosted current-app trial verification. It is **not** resolved because its human acceptance checks passed.

## Evidence and transfer

Automated evidence and a protocol were prepared for the earlier guide beta. The application later gained persisted authoring and adopted the accepted concise Refine 4 guidance/example. Jaco accepted that local minimal experience. No newcomer, live Google or multi-user practical verification was performed.

Relevant newcomer authoring/guide and lead/member access checks are now [M06/06 stage verification](../../team-trial/issues/06-stage-verification.md), after hosted access, lead visibility and initial locking exist. Checks of intentionally removed teaching content are withdrawn. Department editing/two-department checks stay parked with those candidate features.

The [historical ticket](../history/2026-10-15-pre-team-trial/09-verify-guide-through-practical-use.md) and [historical specification](../history/2026-10-15-pre-team-trial/spec.md) preserve the former criteria and unperformed state. Closing M01 records a revised accepted baseline; it does not establish participant completion or a finished team cycle.

## Sources

[Accepted baseline](../spec.md), [M01 closure](../milestone.md), [current PRD](../../../docs/PRD.md) and [M06](../../team-trial/milestone.md).

## Comments

### 15 October 2026 — Reconciled for the team trial

The current disposition above supersedes the original scope and execution holds. Historical comments below describe what was true at their recorded date; they are not fresh verification claims or current authorization requirements.

### 14 October 2026 — Publication approved

Jaco approved the four slices and dependencies and requested individual tickets. Implementation remains pending explicit approval.


### 14 October 2026 — Automated evidence and practical protocol ready

Jaco authorized proceeding through 07–08 and automated/preparation work for 09 without requiring Google configuration first. The [private guide preview](https://jacobuntu.tail5c6dbf.ts.net/lantern-guide/) is ready to explore as a fictional member.

The [verification record](../../../docs/system/guide-verification.md) contains passing automated evidence, source/content coverage, an uncued newcomer walkthrough protocol, timing questions, an anonymized observation format and the later live-access checks. Typecheck, all 25 automated checks and both builds pass; private HTTPS/assets and VM Chromium interactions pass. Agent visual review covered desktop/mobile captures. A navigation refinement brings each new step heading into view for mobile readers.

No human participant has prepared a focus or demonstrated understanding in this verification. No live Google sign-in or real assignment/removal session has been performed. Those acceptance criteria remain unchecked above. The synthetic other-department fixture is authorization-test evidence only. Authoring and multi-department practical checks remain deferred; M01 is in Verify and is not complete.

Pause for Jaco’s content/usability review now. Google setup and live verification can follow once he is ready.


### 15 October 2026 — Visual direction not accepted; interactive prototypes requested

Jaco rejected the reading-oriented layout and excessive guide text, requested a SaaS work application structure and compact visual guidance, and selected image concepts 02, 04 and 09 for further exploration. Interactive throwaway prototypes are captured on branch `codex/lantern-ui-prototypes`, in `/home/jacobuntu/Ops/worktrees/lantern-ui-prototypes/client/prototype-layouts/`. They simulate work screens and interactions with in-memory data; these controls are design proposals, not authorization to expand the production beta scope. No winning layout is selected yet. Practical acceptance remains pending.

The [interactive chooser](https://jacobuntu.tail5c6dbf.ts.net/lantern-prototypes/) is ready with direct variants 02, 04 and 09, a bottom switcher, and independent in-memory sessions. Hosted asset checks and browser smoke for navigation, draft edits, discussion entry and retained edits across style switches passed. Awaiting Jaco’s layout selection and feedback; no production implementation or acceptance closure is implied.

### 15 October 2026 — Navy styling chosen as a starting point; focused base added

Jaco prefers option 02 styling and sidebar, but has not accepted its screen contents, workflow stages or editing mechanisms. Requested a fourth minimal comparison option: separate guide, spacious objective/goal editing, dated position-focus documents, and optional development/leadership concerns represented with the same objective-and-goal structure plus labels. Notes, gaps, inline teaching and drafting/discussing/refining stages are excluded from this base. The [focused base](https://jacobuntu.tail5c6dbf.ts.net/lantern-prototypes/?variant=base) is captured on `codex/lantern-ui-prototypes` alongside unchanged earlier variants. Browser smoke passed document opening, editing, optional objective addition, save, guide navigation and retention across style switches. Await incremental screen/content feedback; production scope and practical acceptance remain pending.

Jaco requested read-first position focus documents to preserve the overall picture when many objectives/goals exist. The Base prototype now shows compact objective/goal columns, with focused edit dialogs for objectives, individual SMART goals and title/dates. Optional concerns use the same structure. Save applies temporary changes; Cancel/Escape discards dialog edits. Captured on `codex/lantern-ui-prototypes`; browser interaction checks passed. Await layout feedback.

### 15 October 2026 — Three read-layout refinements requested

Jaco accepted the read-first direction as an improvement and requested a small review team to explore spacing, margins, typography, buttons and positioning in Base 1, 2 and 3. These extend the same disposable viewer/branch. The supplied 2025 state contains two core objectives plus personal-development and leadership concerns, with multiple goals; obvious placeholder/gibberish text was cleaned up. The 2026 document stays empty. Current Base shares this seed for fair comparison. Alternatives explore balanced columns, a stacked document and structured rows while preserving read mode and field edit dialogs. Layout choice remains pending Jaco’s review.

### 15 October 2026 — Retained prototype journey

Jaco requested one maintained `prototype/` directory with agent guidance, committed additions, chronological phases and nested comparison options. Captured on `codex/lantern-ui-prototypes`: `prototype/AGENTS.md` (with lowercase `agents.md` compatibility link), `prototype/site/catalog.json`, and one shared chooser. Six phases retain the original guide, ten paired concepts, interactive 02/04/09, focused Base, three Base alternatives, and Refine 1. Imported older artifacts are frozen snapshots with provenance in `prototype/README.md`. All 19 options and all image pairs opened successfully in the hosted browser. The old guide/layout viewer registrations were removed after verification; the single prototype viewer remains at the existing URL. Roadmap hosting remains separate.

### 15 October 2026 — Refine 4 implemented as application authoring

Jaco authorized moving the selected Refine 4 experience into the actual application, adding database-backed focus authoring per user/department, a local-user walkthrough without Google setup, guide/account screens and comprehensive tests. This explicitly extends the earlier guide-only beta deferral for document authoring. TDD interfaces (browser and HTTP with real PostgreSQL) were confirmed. Implementation and operating notes are in `docs/system/position-focus-application.md`. Prototype controls/data are excluded from the app. Joint agreement, notifications, review scheduling and department editing remain outside this implementation. Human walkthrough and live Google configuration remain pending.
