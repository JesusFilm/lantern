# Prototype journey

This directory contains retained design experiments, served by one project prototype viewer. Read `site/catalog.json` before adding or changing a prototype; it is the chooser's source of truth. Read `README.md` for provenance and hosting.

## Adding work

1. Decide the design question and lineage. A **phase** is one concept or question in the journey. A **comparison** phase contains sibling alternatives to that question; a **standalone** phase contains one prototype. A new refinement of a selected alternative starts a later phase and records `basedOn` on its option. Use chronological phase titles and descriptive option labels; preserve IDs used in shared URLs.
2. Keep each option in a self-contained directory with relative assets and independent temporary memory. Reuse an existing phase only when adding another alternative to the same question. Copy a selected option for a new design direction so its predecessor remains available. Routine fixes can update that option; commit them so its earlier states remain recoverable.
3. Add every new option to `site/catalog.json` in the same change: unique `id`, human `label`, relative `src`, and `basedOn` when derived. Each phase needs `id`, chronological `title`, `kind`, a short `summary` explaining its question/result, and `options`. Standalone phases have one option; comparison phases have two or more. The chooser renders phase selection first and alternative selection beneath it. Maintain this hierarchy instead of adding all options to a flat toolbar.
4. Preserve the sample data across alternatives being compared unless the question concerns data. Keep full text readable and editing simulated. Treat old snapshots as evidence; record source and capture context when importing them. Update the phase summary or review note when user feedback establishes a decision, distinguishing styling choices from approved features.
5. Verify the affected option and chooser through the hosted viewer: navigation, assets, relevant interactions, and a visual check. Confirm predecessor options still open. Keep verification proportional to throwaway work.
6. Commit every completed addition or update, including assets, catalog and explanatory notes, on the prototype branch. Report the commit and shareable `?variant=ID` URL. A prototype is not complete until it is committed and reachable through the chooser. Preserve unrelated working changes.

## Hosting boundary

Publish only `prototype/site/` through the existing `lantern-prototypes` registration. Use the VM viewers skill for registry changes. Add prototypes to this viewer rather than registering separate sites. Retire a previous registration only after its content is available and verified here. Keep roadmap/ticket viewers separate: they are project operations, not design prototypes.

Use uppercase `AGENTS.md` as the canonical agent instruction file. `agents.md` is a compatibility pointer to this file.
