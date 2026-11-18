# Local ticket board

Optional read-only tooling: run `npm run tickets` and open http://127.0.0.1:4393. The board reads `.scratch/<feature>/milestone.md` and `.scratch/<feature>/issues/*.md` without creating records. Missing files or a missing `.scratch` directory produce “No milestones or tickets yet.” Product direction lives in [the PRD](../../docs/PRD.md) and [roadmap](../../docs/ROADMAP.md).

The TypeScript server uses the existing Node.js, Express and tsx dependencies and binds to loopback. The browser refreshes every five seconds. HTML in records is escaped, and other repository files are not exposed.

Run `npm run tickets:test` to verify parsing, HTTP refresh and empty-board behavior. On macOS, `python3 tools/ticket-board/macos/install.py` installs a user login service for the current checkout and expects the local schedules registry to exist. A new registry entry records the current checkout. The installer recognizes an existing entry only when `  - id: career-lead-ticket-board` appears on its own line without a comment; other formats may create a duplicate. Run `python3 -B -m unittest tools/ticket-board/macos/test_install.py` to check the installer without changing your services.
