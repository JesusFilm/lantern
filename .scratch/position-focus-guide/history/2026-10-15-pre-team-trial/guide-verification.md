# Position-focus guide verification

Date: 14 October 2026. Scope: tickets 06–09, engineering beta.

Tickets 07 and 08 are implemented. Ticket 09 has automated evidence, content review and a prepared practical protocol; **human practical verification has not occurred**. Live Google setup/verification is deferred by Jaco until after reviewing the guide. M01 remains open in Verify; this does not establish completion of anyone’s position focus or the whole team cycle.

## Open the guide without Google

[Private guide preview](https://jacobuntu.tail5c6dbf.ts.net/lantern-guide/) — open with Tailscale connected. It is a static preview as a fictional engineering member, using the same `Guide` component and curated content as the real app. It has no account management, authentication bypass, database, personnel records or saved drafts. The actual application still requires Google sign-in and active membership for `/api/guide`.

Rebuild the preview from this checkout with `npm run preview:build`. The VM viewer mounts only `dist/guide-preview`, not the repository or `dist/server`. Registration is `lantern-guide`; `ops-viewer test lantern-guide` verifies private HTTPS HTML/assets. This is an explicitly rebuilt snapshot, not a production deployment. For local development, use `npm run preview:dev`.

## Automated evidence

Node 24.21.0, PostgreSQL 17 and Playwright Chromium. `npm run typecheck`, `npm test` (25 checks), `npm run build`, and `npm run preview:build` pass. Production and preview use separate entry points and outputs.

| Observable behavior | Evidence |
| --- | --- |
| Registration, waiting, lead assignment and session persistence | Real HTTP/PostgreSQL and Chromium journey in `server/access.integration.test.ts`, with a synthetic provider boundary. |
| Unauthorized access, forged roles/departments and duplicate assignment | HTTP checks; membership comes from the server. |
| Former/other-department assignment restrictions | Synthetic membership fixtures. These do not constitute real-world multi-department verification. |
| Removal affects existing sessions, including guide content | HTTP 403 from `/api/department` and `/api/guide`; signed-in browser returns to waiting. |
| Google identity validation | `server/google.test.ts` uses the real verification library and signed synthetic tokens, with invalid signature/claims rejected. Actual Google consent and hosted callback remain untested. |
| Member discovers the real app’s engineering example | Chromium member journey loads `/api/guide` and opens the example after assignment. |
| Independent objective and SMART entry, Back/Next/Finish, switching | `server/guide.browser.test.ts`; no preceding walkthrough is required. |
| Reader-controlled context persists across steps | Browser checks expand/collapse and retain state; exact mission text is checked. |
| Missing context is omitted | Browser fixtures exercise no context, mission only, department only and both. The individual objective requirement remains. |
| Full engineering example, goals, optional development and timing | Browser discovery and section navigation; content/source review below. |
| Small screens and keyboard use | 390px viewport, no horizontal overflow, keyboard entry, heading focus/visibility after navigation and reduced-motion setting. |

Desktop and mobile screenshots were visually inspected. Browser interaction checks run on the VM; Mac/browser and human comprehension checks remain separate.

## Content and source review

Reviewed the consolidated answers D01–D05, the later beta specification/deferrals, and the actual supplied image `.scratch/position-focus-guide/references/position-focus-working-example.png`.

| Requirement/source | Delivered content |
| --- | --- |
| D01: purpose/outcomes, work/source, users, expectations, gaps | Objective steps 1–5 and full-example purpose/gaps sections. Areas to consider, not mandatory fields; objective + SMART goals required. |
| D01/D03: internal contribution and discovery | Dedicated objective steps. Leadership retains responsibility for absent direction; Jaco coordinates Tatai/Edmond, with Sushma for QA. |
| D02: joint review and lock-in | Objective final step and example review section. No extra approvers, remaining gaps with next steps, agreed revisable baseline, agreement distinct from achievement. |
| D03: optional help, independent steps, context, all SMART qualities | Both walkthroughs, collapsible context and a progressively improved product goal. No invented department contribution is supplied in the real banner. |
| D03: optional development | Final SMART step; separate optional personal and leadership development sections in the example, with leadership beneath personal. No editor or lock-in action. |
| D04 + beta deferrals | Fixed application-supplied content. No authoring UI, guidance switcher or cross-department example selector. |
| D05 supersedes earlier timing | Ask the career lead if timing is absent; no fixed first review or default schedule. Annual/quarterly patterns and example month markers are clearly illustrative. |
| Supplied product reference | One video devotional; clearer next-step screen; AI-assisted implementation; Month 1 test 20, Month 3 release after accessibility/reliability checks, Month 6 retest 20 with at least 16 finding the next step. |
| Supplied development reference | Lead technical design and AI code reviews; Month 2 compare two build options for Product; Month 6 record three AI reviews and fixes. |
| Added explanatory scenario detail | Users/needs, Product/QA collaboration, unknowns, next steps and a coach-given leadership example are explicitly illustrative. None establishes live assignments, confirmed strategy or universal targets. |

No unresolved mismatch was identified in this content review. That is agent review, not evidence that a newcomer understands or can use the guide.

## Human practical protocol — pending

Use the preview first. Google setup is not needed for the content checks. No fixed participant count or numerical success threshold is prescribed. Do not retain real personnel details in this repository.

1. Ask someone unfamiliar with the process to use the guide to prepare a position focus in a separate document for their own work or a clearly fictional scenario. Let them choose resources without coaching them through the interface.
2. Ask them to explain whom they serve, the intended outcome, the mission connection, their objective and SMART goals. Check whether the proposed evidence/timeframe fits the objective rather than merely copying the example’s counts or months.
3. Ask what they still do not know and what they will do next to pursue answers. For missing work/direction, check that they know leadership must help establish direction.
4. Ask what must happen before lock-in, who agrees, whether every gap must be resolved, what completion means, and whether the focus can change later.
5. Ask them to find the full example and explain when personal development or a leadership development assignment would be useful and whether either is mandatory.
6. Ask: “When should your first and later reviews happen?” Check that they distinguish example goal milestones and annual/quarterly illustrations from actual department expectations, and ask the career lead when timing is absent.
7. Record anonymized observations and unmet criteria. Correct relevant failures, rerun affected checks and record the follow-through before claiming practical acceptance.

### Observation record

No participant observations yet. For each actual session, record:

| Field | What to record |
| --- | --- |
| Session | Date, anonymous participant label, preview/build used, starting situation. |
| Preparation | What they could prepare; anonymized description of objective, evidence and gaps. |
| Discovery/usability | Resources found, confusing wording/navigation, assistance needed. |
| Understanding | Review/lock-in, optional development, timing and leadership responsibility in their own words. |
| Finding | Criterion met/unmet/uncertain, observed evidence and necessary correction. |
| Follow-through | Change made, affected automated/practical checks rerun, resulting observation. |

## Live access verification — pending until final setup

Follow [access setup](access-setup.md) after Jaco is ready to configure the real domains, career lead, Google client and hosting callback. Verify real eligible/ineligible Google sign-in, lead/member assignment, reopening, sign-out and backend removal of a disposable test member while their existing session remains open. No actual account/domain values belong in planning files.

Career-lead text authoring and two-department generic/custom guidance with cross-department examples remain deferred. Those checks were not performed or passed. Keep ticket 09 and M01 open until the agreed practical evidence and acceptance decision are recorded.
