# Local ticket board

The viewer is written in TypeScript and uses the project’s existing Node.js, Express and tsx dependencies. Python is not required.

Open and bookmark http://127.0.0.1:4393. On Jaco’s Mac, a launchd login service keeps the board running while the Mac is awake and you are logged in. Install or refresh it with `python3 tools/ticket-board/macos/install.py`; this also registers it in `~/Jaxs/schedules/schedules.yaml`. Logs are in `~/Library/Logs/career-lead-ticket-board/`. For manual development, stop the service first with `launchctl bootout gui/$(id -u)/com.jaxs.career-lead-ticket-board`, then run `npm run tickets`; reinstall to restore automatic startup. It reads `.scratch/<feature>/milestone.md` and `.scratch/<feature>/issues/*.md` on every request and the browser refreshes every five seconds and when you return to the page. Ticket edits require no HTML generation.

The board displays only actual tracker files. Milestone records must declare `Kind: milestone`; issue files default to `Kind: ticket`. Use the Item type filter to view either kind. Milestone progress has its own ordered filter (Planning, Specification, Delivery, Verify, Learn, Complete), separate from ticket statuses. Choosing a progress stage selects milestones; choosing a ticket status selects tickets. Stages describe current progress and do not enforce transitions; Verify and Learn may be skipped. Maps and specifications are not duplicate cards. With no records, it shows “No milestones or tickets yet.” The viewer does not create records. See `docs/agents/issue-tracker.md` for the milestone planning workflow.

Metadata is shown separately above the rendered description. The reader accepts plain `Key: value` headers followed by `---`, scalar `---` front matter, and the skills’ Markdown ticket format (`# 01: Title`, `**Status:** …`, `**Blocked by:** …`). Markdown tickets without metadata use the feature folder, title heading, and `needs-triage` defaults; milestones without a status default to Planning. The renderer supports headings, paragraphs, bullets, checkboxes, bold text, inline code and fenced code; HTML is escaped.

The server is read-only and bound to `127.0.0.1:4393`. It serves the page and ticket API without exposing other repository files. The website uses this server and is opened by URL.

Run `npm run tickets:test` to verify tracker format compatibility, metadata separation and HTTP freshness for ticket additions, edits and deletions, including returning to an empty board.
