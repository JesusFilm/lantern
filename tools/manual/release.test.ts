import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { promisify } from "node:util";

// Exercise the actual workflow shell command with an offline GitHub CLI fixture.
async function releaseFixture(t: TestContext, draft: boolean | null) {
  const root = await mkdtemp(join(tmpdir(), "manual-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "docs/manual"), { recursive: true });
  await writeFile(join(root, "docs/manual/manifest.json"), JSON.stringify({ edition: 7, editionDate: "2026-11-02" }));
  await writeFile(join(root, "docs/manual/lantern-manual.pdf"), "fixture PDF");
  await writeFile(join(root, "state.json"), JSON.stringify({ exists: draft !== null, draft, uploaded: draft === false, calls: [] }));
  await writeFile(join(root, "gh"), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync('state.json', 'utf8'));
state.calls.push(args);
let status = 0;
if (args[1] === 'view') {
  if (!state.exists) status = 1;
  else console.log(args.includes('--json') ? String(state.draft) : 'QA manual, edition 7');
} else if (args[1] === 'create') {
  state.exists = true; state.draft = false; state.uploaded = true;
} else if (args[1] === 'upload') {
  if (fs.existsSync('fail-upload')) status = 1;
  else state.uploaded = true;
} else if (args[1] === 'edit') {
  if (!state.uploaded) throw new Error('Published without the PDF');
  state.draft = false;
} else throw new Error('Unexpected gh call');
fs.writeFileSync('state.json', JSON.stringify(state));
process.exit(status);
`, { mode: 0o755 });
  const workflow = await readFile(new URL("../../.github/workflows/manual.yml", import.meta.url), "utf8");
  const script = workflow.split("        run: |\n")[1]!.replace(/^          /gm, "");
  return {
    root,
    run: () => promisify(execFile)("bash", ["-e", "-o", "pipefail", "-c", script], {
      cwd: root, env: { PATH: root + ":" + process.env.PATH, GITHUB_SHA: "a".repeat(40) },
    }),
    state: async () => JSON.parse(await readFile(join(root, "state.json"), "utf8")) as { draft: boolean; uploaded: boolean; calls: string[][] },
  };
}

test("release rerun resumes an unpublished draft and uploads the PDF before publishing", async (t) => {
  const fixture = await releaseFixture(t, true);
  await fixture.run();
  const state = await fixture.state();
  assert.equal(state.draft, false, "a successful rerun must make the manual available to QA");
  assert.equal(state.uploaded, true);
  assert.deepEqual(state.calls.map((args) => args[1]), ["view", "upload", "edit"]);
  assert.ok(state.calls[1]!.includes("--clobber"));
  assert.ok(state.calls[2]!.includes("--latest"));
});

test("a failed draft upload fails the run and can be retried", async (t) => {
  const fixture = await releaseFixture(t, true);
  await writeFile(join(fixture.root, "fail-upload"), "");
  await assert.rejects(fixture.run());
  assert.equal((await fixture.state()).draft, true);
  await rm(join(fixture.root, "fail-upload"));
  await fixture.run();
  assert.equal((await fixture.state()).draft, false);
});

test("an already published edition is left unchanged", async (t) => {
  const fixture = await releaseFixture(t, false);
  await fixture.run();
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ["view"]);
});

test("a new edition is created with its PDF", async (t) => {
  const fixture = await releaseFixture(t, null);
  await fixture.run();
  const state = await fixture.state();
  assert.equal(state.draft, false);
  assert.equal(state.uploaded, true);
  assert.ok(state.calls[1]!.includes("docs/manual/lantern-manual.pdf"));
});
