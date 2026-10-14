# Disposable Lantern layout prototypes

Question: which of the selected 02, 04 and 09 layouts makes day-to-day task work and contextual guidance easiest to understand?

These are interactive design proposals, not production features. No winning design or business-rule expansion has been approved. Built on 15 October 2026 in worktree `/home/jacobuntu/Ops/worktrees/lantern-ui-prototypes`, branch `codex/lantern-ui-prototypes`. The existing implementation checkout is separate and untouched by these builds.

Run from this worktree with `npm run prototype:layouts`, then open `http://127.0.0.1:4395`. Python's static server needs no npm dependencies, compilation, database or Google setup. Stop with Ctrl+C.

Hosted privately at `https://jacobuntu.tail5c6dbf.ts.net/lantern-prototypes/` using the existing VM viewer service. Only this directory is published.

- `?variant=02`: Navy operations — sidebar and split work panes.
- `?variant=04`: Swiss grid — compact table and horizontal task tabs.
- `?variant=09`: Graphite navigator — global navigation, item list and detail pane.

Choose through the landing cards, the bottom style buttons/arrows, or direct URLs. Each iframe retains its own memory session across style switches; browser refresh resets all sessions. Internal navigation retains changes. Each prototype has Reset demo and a state view. All identities, inbox items, membership changes and review actions are simulations. No external messages are sent, and no localStorage, cookies or database stores user input.

Explore: My work → Position focus (edit, goals, notes, gaps, optional development) → discussion/review → Inbox → Department → Guide → Account. Refer to the original image pairs in `references/` to compare intent and implementation. Static source can also be opened directly from each variant's `index.html`.

Verification is limited to a short browser smoke walkthrough and viewer checks, appropriate for throwaway design exploration. No production test suite, backend or migration work is included. Retain the branch as design evidence; revise/rewrite chosen behavior in the real app only after a selection is made. To retire hosting, unregister `lantern-prototypes` before removing the disposable worktree.

## Focused base — fourth option

User selected 02 styling/sidebar as a starting point only; screen contents and mechanisms remain unapproved. `?variant=base` starts with dated position-focus documents and an empty current document. A spacious editor uses identical objective/SMART-goal fields for core, personal-development and leadership-initiative concerns. Guide content is separate. Workflow stages, inline teaching, notes, gaps, inbox and department are omitted from this base pending incremental design. Prior variants remain unchanged. This is a design proposal, not production scope approval.
