Kind: ticket
Title: Verify the guide with practical use
Milestone: M01
Type: task
Status: ready-for-human
Blocked by: 07, 08
Implementation: Automated evidence and practical protocol complete; human verification pending
Slice: Engineering beta

---

# 09: Verify the guide with practical use

## Execution hold

Jaco authorized tickets 07–08 and automated/preparation work for 09 on 14 October 2026. Provide a preview without Google setup; defer live Google and practical human verification to final review.

**What to build:** Evidence of whether the fixed beta guide works for its intended users, plus findings and follow-through.

## Acceptance criteria

- [ ] A newcomer prepares an objective and SMART goals, records gaps/next steps, explains review/lock-in, finds useful examples and understands optional development. They may prepare the focus outside the app because the drafting workflow is separate.
- [ ] A reader distinguishes cycle illustrations from actual expectations and asks the career lead when timing is absent.
- [ ] Confirm the beta assignment/access journey alongside the automated evidence from 06; do not describe a test fixture as real-world multi-department verification.
- [ ] Record anonymized observations, unmet criteria and necessary corrections. No fixed participant count or numerical success target. Rerun affected checks after corrections.
- [x] Do not claim the deferred authoring/two-department practical checks occurred. Do not automatically close M01 or equate guide verification with team-cycle completion.

**Traceability:** retained D03/D05 practical checks; current beta acceptance plan.

## Sources and boundaries

Follow the [specification](../spec.md), [approved breakdown](../breakdown.md) and [deferred features](../deferred.md). Publication does not authorize implementation, deployment or milestone closure.

## Comments

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
