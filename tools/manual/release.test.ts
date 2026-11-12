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
  await writeFile(join(root, "docs/manual/manifest.json"), JSON.stringify({ edition: 7, editionDate: "2026-11-02", deck: "published-deck" }));
  await writeFile(join(root, "published-manifest.json"), JSON.stringify({ edition: 7, deck: "published-deck", pdf: "f".repeat(64) }));
  await writeFile(join(root, "tagged-manifest.json"), JSON.stringify({ edition: 7, deck: "published-deck" }));
  await writeFile(join(root, "before-manifest.json"), JSON.stringify({ edition: 6, deck: "previous-deck" }));
  await writeFile(join(root, "docs/manual/lantern-manual.pdf"), "fixture PDF");
  await writeFile(join(root, "state.json"), JSON.stringify({ exists: draft !== null, draft, uploaded: draft === false, calls: [] }));
  await writeFile(join(root, "gh"), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync('state.json', 'utf8'));
state.calls.push(args);
let status = 0;
if (args[1] === 'view') {
  if (fs.existsSync('gh-unavailable')) { console.error('network unavailable'); status = 1; }
  else if (!state.exists) { console.error('release not found'); status = 1; }
  else if (args.includes('assets')) console.log(JSON.stringify({assets:fs.existsSync('missing-asset') ? [] : [{name:'lantern-manual.pdf',digest:'sha256:' + (fs.existsSync('wrong-asset') ? 'e' : 'f').repeat(64)}]}));
  else console.log(args.includes('targetCommitish') ? 'a'.repeat(40) : args.includes('--json') ? String(state.draft) : 'QA manual, edition 7');
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
  await writeFile(join(root, "git"), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'fetch') process.exit(0);
if (args[0] === 'merge-base') process.exit(0);
if (args[0] === 'rev-list') { console.log('a'.repeat(40) + '\\n' + 'b'.repeat(40)); process.exit(0); }
if (args[0] === 'ls-remote') { if (fs.existsSync('existing-tag')) console.log('b'.repeat(40) + '\\trefs/tags/manual-7'); process.exit(0); }
if (args[0] === 'show') { console.log(fs.readFileSync(args[1].startsWith('b'.repeat(40)) ? 'before-manifest.json' : args[1].startsWith('manual-') && fs.existsSync('existing-tag') ? 'tagged-manifest.json' : 'published-manifest.json', 'utf8')); process.exit(0); }
if (args[0] === 'rev-parse') {
  console.log(args[1] === 'HEAD' || !fs.existsSync('main-moved') ? 'a'.repeat(40) : 'b'.repeat(40));
  process.exit(0);
}
process.exit(1);
`, { mode: 0o755 });
  const script = await readFile(new URL("./release.sh", import.meta.url), "utf8");
  return {
    root,
    run: (mode = "--publish", before = "b".repeat(40), sha = "a".repeat(40)) => promisify(execFile)("bash", ["-e", "-o", "pipefail", "-c", script, "release.sh", mode], {
      cwd: root, env: { PATH: root + ":" + process.env.PATH, GITHUB_SHA: sha, MANUAL_PUSH_BEFORE: before },
    }),
    state: async () => JSON.parse(await readFile(join(root, "state.json"), "utf8")) as { draft: boolean; uploaded: boolean; calls: string[][] },
  };
}

test("an edition superseded by an unrelated push can still be published", async (t) => {
  const fixture = await releaseFixture(t, null);
  await rm(join(fixture.root, "git"));
  const git = async (...args: string[]) => (await promisify(execFile)("git", args, {cwd: fixture.root})).stdout.trim();
  await git("init", "--bare", "remote.git");
  await git("init", "-b", "main");
  await git("config", "user.name", "Manual Test");
  await git("config", "user.email", "manual@example.test");
  await git("remote", "add", "origin", join(fixture.root, "remote.git"));
  await writeFile(join(fixture.root, "docs/manual/manifest.json"), JSON.stringify({edition:6,deck:"previous-deck"}));
  await git("add", "docs/manual"); await git("commit", "-m", "previous edition");
  await writeFile(join(fixture.root, "docs/manual/manifest.json"), JSON.stringify({edition:7,editionDate:"2026-11-02",deck:"published-deck"}));
  await git("add", "docs/manual"); await git("commit", "-m", "new edition");
  const before = await git("rev-parse", "HEAD");
  await writeFile(join(fixture.root, "unrelated.txt"), "unrelated");
  await git("add", "unrelated.txt"); await git("commit", "-m", "unrelated push");
  const sha = await git("rev-parse", "HEAD");
  await git("push", "origin", "main");
  await fixture.run("--check", before, sha);
  await fixture.run("--publish", before, sha);
  assert.equal((await fixture.state()).uploaded, true);
});

test("one push can introduce an edition through multiple draft commits", async (t) => {
  const fixture = await releaseFixture(t, null);
  await rm(join(fixture.root, "git"));
  const git = async (...args: string[]) => (await promisify(execFile)("git", args, {cwd: fixture.root})).stdout.trim();
  await git("init", "--bare", "remote.git"); await git("init", "-b", "main");
  await git("config", "user.name", "Manual Test"); await git("config", "user.email", "manual@example.test");
  await git("remote", "add", "origin", join(fixture.root, "remote.git"));
  await writeFile(join(fixture.root, "docs/manual/manifest.json"), JSON.stringify({edition:6,deck:"old"}));
  await git("add", "docs/manual"); await git("commit", "-m", "old edition");
  const before = await git("rev-parse", "HEAD");
  await writeFile(join(fixture.root, "docs/manual/manifest.json"), JSON.stringify({edition:7,deck:"draft"}));
  await git("add", "docs/manual"); await git("commit", "-m", "draft edition");
  await writeFile(join(fixture.root, "docs/manual/manifest.json"), JSON.stringify({edition:7,editionDate:"2026-11-02",deck:"published-deck"}));
  await git("add", "docs/manual"); await git("commit", "-m", "final edition");
  const sha = await git("rev-parse", "HEAD"); await git("push", "origin", "main");
  await fixture.run("--check", before, sha);
  await fixture.run("--publish", before, sha);
  assert.equal((await fixture.state()).uploaded, true);
});

test("a published edition must have its verified PDF asset", async (t) => {
  const fixture = await releaseFixture(t, false);
  for (const marker of ["missing-asset", "wrong-asset"]) {
    await writeFile(join(fixture.root, marker), "");
    await assert.rejects(fixture.run("--check"), /manual.*asset/i);
    await rm(join(fixture.root, marker));
  }
});

test("release rerun resumes an unpublished draft and uploads the PDF before publishing", async (t) => {
  const fixture = await releaseFixture(t, true);
  await fixture.run();
  const state = await fixture.state();
  assert.equal(state.draft, false, "a successful rerun must make the manual available to QA");
  assert.equal(state.uploaded, true);
  assert.deepEqual(state.calls.map((args) => args[1]), ["view", "view", "upload", "edit"]);
  assert.ok(state.calls[2]!.includes("--clobber"));
  assert.ok(state.calls[3]!.includes("--latest"));
});

test("a draft cannot publish a different deck after an unrelated push", async (t) => {
  const fixture = await releaseFixture(t, true);
  await writeFile(join(fixture.root, "docs/manual/manifest.json"), JSON.stringify({edition: 7, editionDate: "2026-11-02", deck: "changed-deck"}));
  await assert.rejects(fixture.run(), /edition.*different content/i);
  await assert.rejects(fixture.run("--check"), /edition.*different content/i);
  assert.equal((await fixture.state()).draft, true);
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ["view", "view", "view", "view"]);
});

test("CI checks a valid draft without uploading or publishing it", async (t) => {
  const fixture = await releaseFixture(t, true);
  await fixture.run("--check");
  assert.equal((await fixture.state()).draft, true);
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ["view", "view"]);
});

test("a draft cannot publish a deck that differs from its already existing tag", async (t) => {
  const fixture = await releaseFixture(t, true);
  await writeFile(join(fixture.root, 'existing-tag'), '');
  await writeFile(join(fixture.root, 'tagged-manifest.json'), JSON.stringify({edition:7,deck:'older-tag-deck'}));
  await assert.rejects(fixture.run(), /edition.*different content/i);
  assert.equal((await fixture.state()).draft, true);
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
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ["view", "view"]);
});

test("a reused published edition remains blocked after an unrelated push", async (t) => {
  const fixture = await releaseFixture(t, false);
  await writeFile(join(fixture.root, "docs/manual/manifest.json"), JSON.stringify({edition: 7, editionDate: "2026-11-02", deck: "changed-deck"}));
  await assert.rejects(fixture.run(), /edition.*different content/i);
  await assert.rejects(fixture.run(), /edition.*different content/i);
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ["view", "view"]);
});

test("a published edition without a verifiable tagged manifest fails closed", async (t) => {
  const fixture = await releaseFixture(t, false);
  await writeFile(join(fixture.root, "published-manifest.json"), JSON.stringify({edition: 7}));
  await assert.rejects(fixture.run(), /edition.*different content/i);
});

test("a new edition is created with its PDF", async (t) => {
  const fixture = await releaseFixture(t, null);
  await fixture.run();
  const state = await fixture.state();
  assert.equal(state.draft, false);
  assert.equal(state.uploaded, true);
  assert.ok(state.calls[1]!.includes("docs/manual/lantern-manual.pdf"));
});

test("a new edition can restore a damaged PDF without changing the deck", async (t) => {
  const fixture = await releaseFixture(t, null);
  await writeFile(join(fixture.root, 'before-manifest.json'), JSON.stringify({edition:6,deck:'published-deck'}));
  await fixture.run();
  assert.equal((await fixture.state()).uploaded, true);
});

test("CI fails closed when the release lookup is unavailable", async (t) => {
  const fixture = await releaseFixture(t, null);
  await writeFile(join(fixture.root, 'gh-unavailable'), '');
  await assert.rejects(fixture.run('--check'), /cannot verify.*release/i);
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ['view']);
});

test("an unpublished edition with no tag cannot be silently retried after an unrelated push", async (t) => {
  const fixture = await releaseFixture(t, null);
  await writeFile(join(fixture.root, 'before-manifest.json'), JSON.stringify({edition:7,deck:'published-deck'}));
  await assert.rejects(fixture.run('--check'), /cannot verify.*edition/i);
  await assert.rejects(fixture.run('--publish'), /cannot verify.*edition/i);
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ['view','view']);
});

test("a new release cannot reuse an existing tag for different content", async (t) => {
  const fixture = await releaseFixture(t, null);
  await writeFile(join(fixture.root, 'existing-tag'), '');
  await writeFile(join(fixture.root, 'tagged-manifest.json'), JSON.stringify({edition:7,deck:'older-tag-deck'}));
  await assert.rejects(fixture.run(), /edition.*different content/i);
  assert.deepEqual((await fixture.state()).calls.map((args) => args[1]), ['view']);
});

test("a newer main blocks publishing an older manual as latest", async (t) => {
  const fixture = await releaseFixture(t, null);
  await writeFile(join(fixture.root, "main-moved"), "");
  await assert.rejects(fixture.run(), /no longer current main/);
  assert.deepEqual((await fixture.state()).calls, []);
});

test("every main push can publish a pending manual edition", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/manual.yml", import.meta.url), "utf8");
  const trigger = workflow.split("\npermissions:")[0]!;
  assert.match(trigger, /push:\s*\n\s*branches:\s*\[main\]/);
  assert.doesNotMatch(trigger, /\n\s*paths(?:-ignore)?:/, "an unrelated newer main push must still retry publication");
});

test("staging waits for both manual checks before producing promotion evidence", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const stage = workflow.split("\n  stage:")[1]!;
  const needs = stage.match(/\n\s*needs:\s*\[([^\]]+)\]/)?.[1]?.split(',').map(name => name.trim()) ?? [];
  assert.ok(needs.includes('manual'));
  assert.ok(needs.includes('manual-release-guard'));
});
