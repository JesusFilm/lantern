# Business rules

These area files record product decisions: what should happen, why, and the exceptions. The [PRD](../PRD.md) indexes migrated areas. The catalogue is partial: its silence on a question does not mean that no rule or guidance exists. For areas not yet migrated, consult the PRD, glossary and relevant guidance; distinguish an owner decision from observed implementation or guidance, and report an unresolved provenance rather than assuming either approval or a lack of policy.

- [Weekly work](weekly-work.md)
- [Review, confirmation and the cycle](review-and-confirmation.md)

Each rule has a stable ID, status, decision reference, explanation and exceptions where relevant. An in-effect rule describes current intended behavior. Agreed but undelivered rules are labeled accordingly. Open and deferred entries state the question and current behavior without deciding the answer. ADRs record architectural choices; issues and PRs hold discussion and proposals.

The owner approves rule meanings. Agents and developers may draft and maintain entries, preserving approved decisions and exceptions. When behavior changes, update its rule in the same change, link the owner decision, list affected IDs in the PR, and update relevant guidance and tests. If sources disagree or intent is unclear, record the uncertainty and seek the owner's decision rather than silently choosing. Retire obsolete IDs with a link to their replacement or decision; never reuse an ID.

When a rule's meaning changes, assess the [QA manual](../development/manual.md) for affected wording and checks; update and regenerate it if needed. Rule files are not manual freshness inputs, so the automated check alone will not catch a stale manual after a rule-only edit.

Tests provide evidence for behavior at a revision; a rule entry records intent and cannot establish deployed behavior. Use the [testing guide](../development/testing.md) for the limits of local and deployed verification.
