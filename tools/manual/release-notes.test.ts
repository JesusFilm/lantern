import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  const commit = async (edition: number, slides: string, screenshots: Record<string, string> = {}, supplied: Record<string, unknown> = {}) => {
    await writeFile(join(root, "tools/manual/content.ts"), `export const chapters = [{ title: "Account", summary: "Accounts", slides: [${slides}] }];`);
    await writeFile(join(root, "docs/manual/manifest.json"), JSON.stringify({ edition, screenshots, supplied }));
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
  // Transpile the real content as the notes generator does, then commit it
  // twice and evaluate the two revisions in the isolated fixture.
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

test("release notes describe removed checks alongside additions and reordered steps", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(12, '{kind:"feature",title:"Sign in",summary:"Sign in.",tryIt:["Open account.","Choose sign in."],check:["Old check.","Retained check."],shots:[]}');
  const next = await commit(13, '{kind:"feature",title:"Sign in",summary:"Sign in.",tryIt:["Choose sign in.","Open account."],check:["New check.","Retained check."],shots:[]}');
  const output = notes(old, next);
  assert.match(output, /New check\./);
  assert.match(output, /Removed check: Old check\./);
  assert.match(output, /Steps reordered/);
});

test("new topics include the relevant roles and checks", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(13, '');
  const next = await commit(14, '{kind:"feature",title:"Flags",summary:"Inspect flags.",roles:["Configured owner"],tryIt:["Open flags."],check:["Other users are denied."],shots:[]}');
  const output = notes(old, next);
  assert.match(output, /Added \*\*Flags\*\*/);
  assert.match(output, /Configured owner/);
  assert.match(output, /Open flags\./);
  assert.match(output, /Other users are denied\./);
});

test("changes to a person's role appear in the notes", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(14, '{kind:"people",title:"People",lead:"Team.",people:[{name:"Aroha",role:"Member",text:"Writes focuses."}]}');
  const next = await commit(15, '{kind:"people",title:"People",lead:"Team.",people:[{name:"Aroha",role:"Career lead",text:"Writes focuses."}]}');
  assert.match(notes(old, next), /Aroha.*Career lead/);
});

test("screenshot references and captions are compared even when image files do not change", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(15, '{kind:"feature",title:"First",summary:"First.",tryIt:[],check:[],shots:[{id:"shared",caption:"Old caption"}]},{kind:"feature",title:"Second",summary:"Second.",tryIt:[],check:[],shots:[{id:"shared",caption:"Shared"}]}', {"shared.png":"same"});
  const next = await commit(16, '{kind:"feature",title:"First",summary:"First.",tryIt:[],check:[],shots:[]},{kind:"feature",title:"Second",summary:"Second.",tryIt:[],check:[],shots:[{id:"shared",caption:"New caption"}]}', {"shared.png":"same"});
  const output = notes(old, next);
  assert.match(output, /First.*Screenshot removed: Old caption/);
  assert.match(output, /Second.*New caption/);
});

test("chapter changes appear even when the slides do not change", async (t) => {
  const { commitContent, notes } = await fixture(t);
  const slide = '{kind:"intro",title:"Start",lead:"Welcome.",points:[]}';
  const old = await commitContent(16, `export const chapters=[{title:"First",summary:"Old summary.",slides:[${slide}]}];`);
  const next = await commitContent(17, `export const chapters=[{title:"First",summary:"New summary.",slides:[${slide}]}];`);
  assert.match(notes(old, next), /Updated chapter \*\*First\*\*: New summary\./);
});

test("moving a topic between chapters is reported", async (t) => {
  const { commitContent, notes } = await fixture(t);
  const slide = '{kind:"intro",title:"Start",lead:"Welcome.",points:[]}';
  const old = await commitContent(17, `export const chapters=[{title:"First",summary:"First.",slides:[${slide}]},{title:"Second",summary:"Second.",slides:[]}];`);
  const next = await commitContent(18, `export const chapters=[{title:"First",summary:"First.",slides:[]},{title:"Second",summary:"Second.",slides:[${slide}]}];`);
  assert.match(notes(old, next), /Moved \*\*Start\*\*.*First.*Second/);
});

test("reordering checklist items is reported", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(18, '{kind:"checklist",title:"Checks",lead:"Check.",items:[{title:"First",text:"One."},{title:"Second",text:"Two."}]}');
  const next = await commit(19, '{kind:"checklist",title:"Checks",lead:"Check.",items:[{title:"Second",text:"Two."},{title:"First",text:"One."}]}');
  assert.match(notes(old, next), /Items reordered/);
});

test("new checklist and people topics include their guidance", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(19, '');
  const next = await commit(20, '{kind:"checklist",title:"Checks",lead:"Check by hand.",items:[{title:"Sign in",text:"Check access."}]},{kind:"people",title:"People",lead:"Team.",people:[{name:"Aroha",role:"Member",text:"Writes focuses."}]}');
  const output = notes(old, next);
  assert.match(output, /Sign in: Check access/);
  assert.match(output, /Aroha \(Member\): Writes focuses/);
});

test("changes to pending supplied screenshot instructions are reported", async (t) => {
  const { commit, notes } = await fixture(t);
  const old = await commit(20, '{kind:"feature",title:"Sign in",summary:"Sign in.",shots:[{id:"login",caption:"Login",file:"old.png",instructions:"Old instructions."}]}');
  const next = await commit(21, '{kind:"feature",title:"Sign in",summary:"Sign in.",shots:[{id:"login",caption:"Login",file:"new.png",instructions:"New instructions."}]}');
  const output = notes(old, next);
  assert.match(output, /New instructions/);
  assert.match(output, /new\.png/);
});

test("notes report when a supplied screenshot becomes outdated and when it is confirmed", async (t) => {
  const { root, commit, notes } = await fixture(t);
  const sourcePath = "account.txt";
  const hash = (source: string) => createHash("sha256").update(source).digest("hex");
  const slide = '{kind:"feature",title:"Sign in",summary:"Sign in.",shots:[{id:"login",caption:"Login",file:"login.png",instructions:"Capture login.",sources:["account.txt"]}]}';
  await writeFile(join(root, sourcePath), "original");
  const original = await commit(21, slide, {}, { login: { image: "same", capturedFor: { [sourcePath]: hash("original") } } });
  await writeFile(join(root, sourcePath), "changed");
  const outdated = await commit(22, slide, {}, { login: { image: "same", capturedFor: { [sourcePath]: hash("original") } } });
  const confirmed = await commit(23, slide, {}, { login: { image: "same", capturedFor: { [sourcePath]: hash("changed") } } });
  assert.match(notes(original, outdated), /Login.*may be outdated/i);
  assert.match(notes(outdated, confirmed), /Login.*confirmed/i);
});
