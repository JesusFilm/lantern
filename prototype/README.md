# Lantern prototype journey

Run `npm run prototype:layouts` from this worktree. The canonical public surface is `prototype/site/`. Private viewer: https://jacobuntu.tail5c6dbf.ts.net/lantern-prototypes/ . Existing interactive links such as `?variant=refine1` are preserved.

`site/catalog.json` defines chronological phases and alternatives. `AGENTS.md` defines how to extend and commit the journey. Sources live on branch `codex/lantern-ui-prototypes` in `/home/jacobuntu/Ops/worktrees/lantern-ui-prototypes`.

## Retained evidence

- `site/guide-preview/`: static built snapshot copied from the original checkout's `dist/guide-preview` on 15 October 2026. It contains the ticket 07–08 guide preview; its authoring source remains in the original checkout under `tools/guide-preview` and the app source. This snapshot is intentionally frozen, not automatically rebuilt.
- `site/visual-concepts/`: retained paired-image carousel and 20 generated images copied from the original checkout's `output/layout-exploration`. The outer phase selector exposes all ten image pairs; the embedded carousel leaves alternative selection to the shared chooser.
- `site/interactive/02`, `04`, `09`: the three selected clickable layouts. Option 02 supplied the preferred styling/sidebar, not approval of all its features.
- `site/interactive/base`: reduced document-oriented application. Earlier spacious inline editor and its read-first evolution are retained in branch history (427900e and 44611d4).
- `site/interactive/base1`, `base2`, `base3`: three read-layout comparisons, using the supplied sample data with mixed text lengths.
- `site/interactive/refine1`: based on Base 2, combining objective types within Add Objective, defaulting to Normal on every open.

The old standalone `lantern-guide` and `lantern-layouts` viewer registrations are retired after consolidation. Their source folders remain preserved in the original checkout. The roadmap/ticket viewer is intentionally separate. Historical notes in `site/interactive/README.md` describe paths and URLs at the time; this file describes the current organisation.

Changing variants retains independent iframe sessions until refresh. Visual-concept pairs are static images, not functional application screens. No design prototype is production implementation approval.
