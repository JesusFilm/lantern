import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { transformSync } from "esbuild";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "node:test";

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "manual-notes-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.email", "test@example.test");
  git("config", "user.name", "Manual test");
  await mkdir(join(root, "tools/manual"), { recursive: true });
  await mkdir(join(root, "docs/manual"), { recursive: true });
  const commit = async (edition: number, slides: string, screenshots: Record<string, string> = {}) => {
    await writeFile(join(root, "tools/manual/content.ts"), `export const chapters = [{ title: "Account", summary: "Accounts", slides: [${slides}] }];`);
    await writeFile(join(root, "docs/manual/manifest.json"), JSON.stringify({ edition, screenshots, supplied: {} }));
    git("add", "."); git("commit", "-qm", `edition ${edition}`);
    return git("rev-parse", "HEAD");
  };
  const command = fileURLToPath(new URL("./_release-notes.mjs", import.meta.url));
  const notes = (old: string, next: string) => execFileSync(process.execPath, [command, old, next], { cwd: root, encoding: "utf8" });
  const commitContent = async (edition: number, source: string) => {
    await writeFile(join(root, "tools/manual/content.ts"), source);
    await writeFile(join(root, "docs/manual/manifest.json"), JSON.stringify({ edition, screenshots: {}, supplied: {} }));
    git("add", "."); git("commit", "-qm", `edition ${edition}`);
    return git("rev-parse", "HEAD");
  };
  return { commit, notes, root, git, commitContent };
}

test("the notes evaluator can read the repository's own content.ts", async (t) => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  const { commitContent, notes } = await fixture(t);
  const source = await readFile(join(repoRoot, "tools/manual/content.ts"), "utf8");
  // The release job only installs the runtime dependencies, so transpile the
  // real content the same way the notes generator will (esbuild is a declared
  // dependency). The result is committed twice and evaluated in the sandbox.
  const evaluated = transformSync(source, { loader: "ts", format: "esm" }).code;
  const old = await commitContent(1, evaluated);
  const next = await commitContent(2, evaluated);
  const output = notes(old, next);
  assert.match(output, /What changed since edition 1/);
  assert.doesNotMatch(output, /First published edition/, "the evaluator must compare two revisions, not fall back");
  assert.match(output, /no changes to slide text or screenshots were detected/, "identical revisions must be recognized, not misread");
});

test("release notes describe a newly documented feature since the previous edition", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(4, '{kind:"feature",title:"Sign in",summary:"Sign in to Lantern.",tryIt:[],check:[],shots:[]}');
  const next = await commit(7, '{kind:"feature",title:"Sign in",summary:"Sign in to Lantern.",tryIt:[],check:[],shots:[]}, {kind:"feature",title:"Inspect feature flags",summary:"Owners can see current flag states.",tryIt:[],check:[],shots:[]}');
  const output = notes(old, next);
  assert.match(output, /What changed since edition 4/);
  assert.match(output, /- Added \*\*Inspect feature flags\*\*: Owners can see current flag states\./);
});

test("screenshot-only editions identify the affected manual topic", async (t) => {
  const { commit, notes } = await fixture(t);
  const slide = '{kind:"feature",title:"Sign in",summary:"Sign in to Lantern.",tryIt:[],check:[],shots:[{id:"sign-in",caption:"Sign in"}]}';
  const old = await commit(8, slide, {"sign-in.png":"old"});
  const next = await commit(9, slide, {"sign-in.png":"new"});
  assert.match(notes(old, next), /- Updated screenshots for \*\*Sign in\*\*/);
});

test("release notes identify changed and removed manual guidance", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(7, '{kind:"feature",title:"Sign in",summary:"Use Google.",tryIt:[],check:["Check the old screen."],shots:[]},{kind:"feature",title:"Old feature",summary:"Old guidance.",tryIt:[],check:[],shots:[]}');
  const next = await commit(8, '{kind:"feature",title:"Sign in",summary:"Use Jesus Film sign-in.",tryIt:[],check:["Check the new screen."],shots:[]}');
  const output = notes(old, next);
  assert.match(output, /- Updated \*\*Sign in\*\*: Use Jesus Film sign-in\./);
  assert.match(output, /Check the new screen\./);
  assert.match(output, /- Removed \*\*Old feature\*\*/);
  assert.doesNotMatch(output, /Use Google/);
});

test("release notes describe changed checklist guidance", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(10, '{kind:"checklist",title:"Manual checks",lead:"Check by hand.",items:[{title:"Phones",text:"Test portrait."}]}');
  const next = await commit(11, '{kind:"checklist",title:"Manual checks",lead:"Check by hand.",items:[{title:"Phones",text:"Test portrait and landscape."}]}');
  assert.match(notes(old, next), /Phones: Test portrait and landscape\./);
});

test("release notes include changes to the roles covered by a topic", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(11, '{kind:"feature",title:"Confirm focus",summary:"Confirm a focus.",roles:["Career lead"],tryIt:[],check:[],shots:[]}');
  const next = await commit(12, '{kind:"feature",title:"Confirm focus",summary:"Confirm a focus.",roles:["Member","Career lead"],tryIt:[],check:[],shots:[]}');
  assert.match(notes(old, next), /Roles: Member, Career lead/);
});
