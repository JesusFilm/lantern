# Architecture decision records

Before choosing or changing an architectural approach, list the records in this directory and read those relevant to the affected boundary. Check each record’s status and follow supersession links to the current decision. If a current accepted decision conflicts with the proposed work, bring that conflict to the repository owner.

An ADR records a consequential structural choice, why it was chosen over viable alternatives, and its material tradeoffs: module responsibilities, interfaces, state ownership, persistence, trust boundaries, dependencies or deployment architecture. Product behavior belongs in the [PRD](../PRD.md): what people can do, screen flows, controls, labels, validation rules and visible states. An architectural decision can enable product behavior; link to the PRD rather than duplicating its requirements. A UI change alone does not require an ADR.

Discuss consequential decisions with the repository owner before implementing them: explain the problem, simplest viable options, recommendation, and effects on interfaces, persistence, access, deployment, and future maintenance where applicable. Record the decision once the owner has agreed; routine implementation details do not need an ADR.

Use the next available number and a descriptive filename, such as `0001-session-storage.md`. Keep each record concise: title, date, status, decision, rationale, and material consequences. Link directly to relevant code or another ADR when useful. Capture unresolved choices as proposed, not accepted.

Keep each record accurate for its stated scope. Remove obsolete claims and product detail rather than appending a narrative of past states; Git preserves that history. Corrections or removal of stale prose do not need a new ADR. A replacement architectural decision does: link back from the new record and add a dated supersession notice to the old one naming the replacement ADR number(s). For partial replacement, name the superseded scope and retain only the still-current decision. For full replacement, retain the title, original date and a short supersession pointer instead of the obsolete proposal body. Example: `Superseded: 2026-10-30 — authoring state ownership replaced by [ADR 0011](0011-objective-authoring-methods.md).` Preserve ADR numbers and filenames so links continue to resolve.

Store decisions here; keep product requirements in `../PRD.md` and priorities in `../ROADMAP.md`.
