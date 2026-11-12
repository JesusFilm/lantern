import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkManual, recordManifest, readManifest, productSources, editionBase, requiresEditionBase, type ManualLayout } from "./freshness.js";

async function project(t: import("node:test").TestContext) {
  const root = await mkdtemp(join(tmpdir(), "manual-freshness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (path: string, content: string | Buffer) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), content); };
  await write("client/main.tsx", "render()");
  await write("server/focus.ts", "save()");
  await write("server/focus.integration.test.ts", "test()");
  await write("docs/PRD.md", "# Lantern");
  await write("package-lock.json", "dependency version 1");
  await write("README.md", "unrelated");
  await write("docs/manual/screenshots/home.png", "png-1");
  await write("docs/manual/lantern-manual.pdf", "pdf-1");
  const layout: ManualLayout = { root, supplied: [{ id: "google-consent", file: "google-consent.png", sources: ["server/google.ts"] }] };
  return { root, write, layout };
}

test("a fresh manual passes, and pending supplied captures are reported as warnings", async (t) => {
  const { layout } = await project(t);
  await recordManifest(layout, { edition: 1, editionDate: "2026-10-30", deck: "d1" });
  const result = await checkManual(layout);
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /google-consent.*not been supplied/);
});

test("changing product source without regenerating names the changed files", async (t) => {
  const { layout, write } = await project(t);
  await recordManifest(layout, { edition: 1, editionDate: "2026-10-30", deck: "d1" });
  await write("client/main.tsx", "render(changed)");
  await write("shared/new-feature.ts", "export {}");
  const result = await checkManual(layout);
  assert.match(result.errors.join("\n"), /changed: client\/main.tsx/);
  assert.match(result.errors.join("\n"), /added: shared\/new-feature.ts/);
  assert.match(result.errors.join("\n"), /npm run manual/);
});

test("a dependency change requires the manual to be regenerated", async (t) => {
  const { layout, write } = await project(t);
  await recordManifest(layout, { edition: 1, editionDate: "2026-10-30", deck: "d1" });
  await write("package-lock.json", "dependency version 2");
  assert.match((await checkManual(layout)).errors.join("\n"), /changed: package-lock.json/);
});

test("tests, unrelated docs and the manual's own output do not make the manual stale", async (t) => {
  const { layout, write } = await project(t);
  await recordManifest(layout, { edition: 1, editionDate: "2026-10-30", deck: "d1" });
  await write("server/focus.integration.test.ts", "test(changed)");
  await write("README.md", "changed");
  const result = await checkManual(layout);
  assert.deepEqual(result.errors, []);
});

test("edited, missing or uncommitted screenshots and a mismatched PDF fail the check", async (t) => {
  const { layout, write } = await project(t);
  await recordManifest(layout, { edition: 1, editionDate: "2026-10-30", deck: "d1" });
  await write("docs/manual/screenshots/home.png", "png-edited");
  await write("docs/manual/screenshots/extra.png", "png-extra");
  await write("docs/manual/lantern-manual.pdf", "pdf-edited");
  const errors = (await checkManual(layout)).errors.join("\n");
  assert.match(errors, /home.png does not match/);
  assert.match(errors, /extra.png is not recorded/);
  assert.match(errors, /lantern-manual.pdf does not match/);
});

test("a supplied capture is recorded once added, and flagged for recapture when its sources change", async (t) => {
  const { layout, write } = await project(t);
  await write("server/google.ts", "oauth()");
  await write("docs/manual/supplied/google-consent.png", "consent-1");
  await recordManifest(layout, { edition: 1, editionDate: "2026-10-30", deck: "d1" });
  assert.deepEqual(await checkManual(layout), { errors: [], warnings: [] });

  await write("server/google.ts", "oauth(changed)");
  await recordManifest(layout, { edition: 2, editionDate: "2026-10-31", deck: "d2" });
  const result = await checkManual(layout);
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings.join("\n"), /google-consent.*recapture.*server\/google.ts/);

  await recordManifest(layout, { edition: 2, editionDate: "2026-10-31", deck: "d2", confirm: ["google-consent"] });
  assert.deepEqual((await checkManual(layout)).warnings, []);
});

test("replacing a supplied capture without regenerating fails the check", async (t) => {
  const { layout, write } = await project(t);
  await write("docs/manual/supplied/google-consent.png", "consent-1");
  await recordManifest(layout, { edition: 1, editionDate: "2026-10-30", deck: "d1" });
  await write("docs/manual/supplied/google-consent.png", "consent-2");
  assert.match((await checkManual(layout)).errors.join("\n"), /google-consent.png.*changed.*npm run manual/);
});



test("type-only dependency metadata does not require recapturing the manual", async (t) => {
  const { layout, write } = await project(t);
  await write("package.json", JSON.stringify({ devDependencies: { "@types/node": "^26.0.0", vite: "^8.3.4" } }));
  const lock = { lockfileVersion: 3, packages: { "": { devDependencies: { "@types/node": "^26.0.0", vite: "^8.3.4" } },
    "node_modules/@types/node": { version: "26.6.6", dev: true }, "node_modules/vite": { version: "8.3.4", dev: true } } };
  await write("package-lock.json", JSON.stringify(lock));
  await recordManifest(layout, { edition: 1, editionDate: "2026-11-10", deck: "d1" });
  await write("package.json", JSON.stringify({ devDependencies: { "@types/node": "^26.6.6", vite: "^8.3.4" } }));
  lock.packages[""].devDependencies["@types/node"] = "^26.6.6";
  lock.packages["node_modules/@types/node"].version = "26.6.7";
  await write("package-lock.json", JSON.stringify(lock));
  assert.deepEqual((await checkManual(layout)).errors, []);
});

test("type-only exclusions preserve dependencies that can affect the manual", async (t) => {
  for (const scenario of ["unused undici", "retained undici", "root runtime type", "linked type"] as const) {
    await t.test(scenario, async (t) => {
      const {layout, write} = await project(t);
      const pkg = {devDependencies:{"@types/node":"^1", vite:"^1"}, ...(scenario === "root runtime type" ? {dependencies:{"@types/node":"^1"}} : {})};
      const entries: Record<string, unknown> = {
        "": pkg,
        "node_modules/@types/node": {version:"1",dev:true,dependencies:{"undici-types":"^1"}, ...(scenario === "linked type" ? {link:true} : {})},
        "node_modules/undici-types": {version:"1",dev:true},
        "node_modules/vite": {version:"1",dev:true, ...(scenario === "retained undici" ? {dependencies:{"undici-types":"^1"}} : {})},
      };
      await write("package.json", JSON.stringify(pkg));
      await write("package-lock.json", JSON.stringify({lockfileVersion:3,packages:entries}));
      await recordManifest(layout, {edition:1,editionDate:"2026-11-10",deck:"d1"});
      const changed = scenario.endsWith("undici") ? "node_modules/undici-types" : "node_modules/@types/node";
      entries[changed] = {...entries[changed] as object, version:"2"};
      await write("package-lock.json", JSON.stringify({lockfileVersion:3,packages:entries}));
      const errors = (await checkManual(layout)).errors.join("\n");
      if (scenario === "unused undici") assert.equal(errors, "");
      else assert.match(errors, /changed: package-lock.json/);
    });
  }
});


test("runtime, build, browser, unknown and install-script dependency changes stay relevant", async (t) => {
  for (const [name, dev, extra] of [["react", false, {}], ["vite", true, {}], ["@vitejs/plugin-react", true, {}], ["@playwright/test", true, {}], ["unknown-tool", true, {}], ["@types/node", true, { hasInstallScript: true }]] as const) {
    await t.test(name, async (t) => {
      const { layout, write } = await project(t);
      const field = dev ? "devDependencies" : "dependencies";
      const config = { [field]: { [name]: "^1.0.0" } };
      const lock = { lockfileVersion: 3, packages: { "": config, ["node_modules/" + name]: { version: "1.0.0", dev, ...extra } } };
      await write("package.json", JSON.stringify(config));
      await write("package-lock.json", JSON.stringify(lock));
      await recordManifest(layout, { edition: 1, editionDate: "2026-11-10", deck: "d1" });
      lock.packages["node_modules/" + name] = { version: "1.0.1", dev, ...extra };
      await write("package-lock.json", JSON.stringify(lock));
      assert.match((await checkManual(layout)).errors.join("\n"), /changed: package-lock.json/);
    });
  }
});

test("capture fixture, rendering environment and build configuration changes require verification", async (t) => {
  for (const path of ["server/privilege-test-support.ts", ".env.example", "compose.yaml", "tsconfig.json", "tools/manual/render.ts", "public/icon.svg"]) {
    const { layout, write } = await project(t);
    await write(path, "before");
    await recordManifest(layout, { edition: 1, editionDate: "2026-11-10", deck: "d1" });
    await write(path, "after");
    assert.ok((await checkManual(layout)).errors.some((error) => error.includes(path)), path);
  }
});

test("ignored dependency changes do not rewrite generation provenance", async (t) => {
  const { layout, write } = await project(t);
  const lock = { lockfileVersion: 3, packages: { "": { devDependencies: { "@types/node": "^1" } }, "node_modules/@types/node": { dev: true, version: "1" } } };
  await write("package.json", JSON.stringify({ devDependencies: { "@types/node": "^1" } }));
  await write("package-lock.json", JSON.stringify(lock));
  const generated = await recordManifest(layout, { edition: 1, editionDate: "2026-11-10", deck: "d1" });
  assert.ok(generated.verification, "a full generation records verification provenance");
  lock.packages["node_modules/@types/node"].version = "2";
  await write("package-lock.json", JSON.stringify(lock));
  assert.deepEqual((await checkManual(layout)).errors, []);
  assert.deepEqual((await readManifest(layout.root))?.verification, generated.verification);
  assert.equal((await readManifest(layout.root))?.edition, 1);
});

test("a full generation records the raw input hashes of the generation that succeeded", async (t) => {
  const { layout, write } = await project(t);
  const generated = await recordManifest(layout, { edition: 1, editionDate: "2026-11-10", deck: "d1" });
  assert.ok(generated.verification, "a full generation records verification provenance");
  // A byte-only change to a product source: the raw hash must move on rerun.
  await write("docs/PRD.md", "# Lantern\n");
  const rerun = await recordManifest(layout, { edition: 1, editionDate: "2026-11-10", deck: "d1" });
  assert.ok(rerun.verification);
  assert.equal(rerun.verification.policy, "manual-inputs/2");
  assert.ok(rerun.verification.generatedAt);
  assert.notEqual(rerun.verification.rawSources["docs/PRD.md"], generated.verification!.rawSources["docs/PRD.md"]);
  assert.deepEqual((await readManifest(layout.root))?.verification, rerun.verification);
  assert.equal((await readManifest(layout.root))?.edition, 1);
});

test("generation provenance records byte changes excluded from freshness", async (t) => {
  const { layout, write } = await project(t);
  const pkg = {devDependencies:{"@types/node":"^1"}};
  await write("package.json", JSON.stringify(pkg));
  await write("package-lock.json", JSON.stringify({lockfileVersion:3,packages:{"":pkg,"node_modules/@types/node":{dev:true,version:"1"}}}));
  const generated = await recordManifest(layout, {edition:1,editionDate:"2026-11-10",deck:"d1"});
  await write("package.json", JSON.stringify(pkg, null, 2));
  const rerun = await recordManifest(layout, {edition:1,editionDate:"2026-11-10",deck:"d1"});
  assert.equal(rerun.sources.fingerprint, generated.sources.fingerprint);
  assert.notEqual(rerun.verification!.rawSources["package.json"], generated.verification!.rawSources["package.json"]);
  assert.notEqual(rerun.verification!.rawSources["package.json"], rerun.sources.files["package.json"]);
});

test("a changed deck must not reuse an edition main has already published", async (t) => {
  const { layout, write } = await project(t);
  // The base is main's manifest, the deck the branch's edition must move past.
  const base = () => ({ edition: 7, deck: "deck-main" });
  // The branch generated edition 8 from a changed deck: the lineage is fine.
  const generated = await recordManifest(layout, { edition: 8, editionDate: "2026-11-10", deck: "deck-branch" });
  assert.deepEqual((await checkManual(layout, base)).errors, []);
  // The buggy merge instead kept main's edition 7 while recording the branch's
  // different deck, so edition 7 would be published again with different content.
  await write("docs/manual/manifest.json", JSON.stringify({ ...generated, edition: 7, editionDate: "2026-11-10" }));
  const result = await checkManual(layout, base);
  assert.match(result.errors.join("\n"), /edition did not move forward from 7/);
  assert.match(result.errors.join("\n"), /npm run manual/);
});

test('an updated deck cannot publish an edition older than the current main edition', async (t) => {
  const {layout} = await project(t);
  await recordManifest(layout, {edition: 6, editionDate: '2026-11-10', deck: 'new-branch-deck'});
  const base = () => ({edition: 7, deck: 'current-main-deck', ancestor: {edition: 5, deck: 'old-branch-deck'}});
  assert.match((await checkManual(layout, base)).errors.join('\n'), /edition did not move forward from 7/);
});

test('an untouched manual on an older branch is not mistaken for a new edition', async (t) => {
  const {layout} = await project(t);
  await recordManifest(layout, {edition: 5, editionDate: '2026-11-10', deck: 'old-branch-deck'});
  const base = () => ({edition: 7, deck: 'current-main-deck', ancestor: {edition: 5, deck: 'old-branch-deck'}});
  assert.deepEqual((await checkManual(layout, base)).errors, []);
});

test("edition comparison reads current main and the real common ancestor", async (t) => {
  const {root, layout} = await project(t);
  const git = (...args:string[]) => execFileSync("git", ["-c", "user.name=Manual Test", "-c", "user.email=manual@example.test", ...args], {cwd:root, stdio:"pipe"}).toString().trim();
  await recordManifest(layout, {edition:5, editionDate:"2026-11-10", deck:"old-branch-deck"});
  git("init", "-b", "main"); git("add", "."); git("commit", "-m", "base"); git("branch", "old-branch");
  await recordManifest(layout, {edition:7, editionDate:"2026-11-11", deck:"current-main-deck"});
  git("add", "."); git("commit", "-m", "new manual"); git("update-ref", "refs/remotes/origin/main", "HEAD"); git("checkout", "old-branch");
  assert.deepEqual(editionBase(root), {edition:7, deck:"current-main-deck", ancestor:{edition:5, deck:"old-branch-deck"}});
  assert.deepEqual((await checkManual(layout)).errors, []);
  assert.match((await checkManual(layout, undefined, {requireBase:true, push:true})).errors.join("\n"), /push.*current main/i);
  await recordManifest(layout, {edition:6, editionDate:"2026-11-11", deck:"new-branch-deck"});
  assert.match((await checkManual(layout)).errors.join("\n"), /edition did not move forward from 7/);
  git("add", "."); git("commit", "-m", "old branch manual"); git("checkout", "main");
  assert.deepEqual(editionBase(root), {edition:5, deck:"old-branch-deck"});
  assert.deepEqual((await checkManual(layout, undefined, {requireBase:true})).errors, []);
  const beforePush = git("rev-parse", "HEAD");
  assert.match((await checkManual(layout, undefined, {requireBase:true, push:true})).errors.join("\n"), /revision before this push/);
  await recordManifest(layout, {edition:7, editionDate:"2026-11-11", deck:"modified-working-deck"});
  assert.match((await checkManual(layout)).errors.join("\n"), /edition did not move forward from 7/);
  git("add", "."); git("commit", "-m", "bad edition");
  await writeFile(join(root, "README.md"), "later unrelated commit"); git("add", "."); git("commit", "-m", "unrelated");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  assert.match((await checkManual(layout, undefined, {requireBase:true, push:true, pushBase:beforePush})).errors.join("\n"), /edition did not move forward from 7/);
  await writeFile(join(root, "docs/manual/manifest.json"), "malformed");
  git("add", "."); git("commit", "-m", "broken remote"); git("update-ref", "refs/remotes/origin/main", "HEAD"); git("checkout", "old-branch");
  assert.equal(editionBase(root, {requireRemote:true}), undefined);
});

test('a required edition comparison fails clearly when main is unavailable', async (t) => {
  const {layout} = await project(t);
  await recordManifest(layout, {edition:1, editionDate:'2026-11-10', deck:'deck'});
  const result = await checkManual(layout, () => undefined, {requireBase:true});
  assert.match(result.errors.join('\n'), /cannot compare.*main/i);
});

test('a multi-commit push may change an unpublished deck more than once in its new edition', async (t) => {
  const {root, layout} = await project(t);
  const git = (...args:string[]) => execFileSync('git', ['-c','user.name=Manual Test','-c','user.email=manual@example.test',...args], {cwd:root,stdio:'pipe'}).toString().trim();
  await recordManifest(layout, {edition:7, editionDate:'2026-11-10', deck:'old-deck'});
  git('init','-b','main');git('add','.');git('commit','-m','base');git('checkout','-b','feature');
  const before = git('rev-parse','HEAD');
  await recordManifest(layout, {edition:8, editionDate:'2026-11-10', deck:'intermediate-deck'});git('add','.');git('commit','-m','first deck');
  await recordManifest(layout, {edition:8, editionDate:'2026-11-10', deck:'final-deck'});git('add','.');git('commit','-m','final deck');
  git('checkout','main');git('merge','--no-ff','feature','-m','merge feature');git('update-ref','refs/remotes/origin/main','HEAD');
  assert.deepEqual((await checkManual(layout, undefined, {requireBase:true,push:true,pushBase:before})).errors, []);
});

test("CI requires the edition comparison for common true values", () => {
  assert.equal(requiresEditionBase({CI:"true"}), true);
  assert.equal(requiresEditionBase({CI:"1"}), true);
  assert.equal(requiresEditionBase({CI:"false"}), false);
  assert.equal(requiresEditionBase({}), false);
});

test("version 2 lockfiles remain conservative for type-only updates", async (t) => {
  const {layout, write} = await project(t);
  const lock = {lockfileVersion:2, packages:{"":{devDependencies:{"@types/node":"^1"}}, "node_modules/@types/node":{dev:true,version:"1"}}, dependencies:{"@types/node":{version:"1",dev:true}}};
  await write("package.json", JSON.stringify({devDependencies:{"@types/node":"^1"}}));
  await write("package-lock.json", JSON.stringify(lock));
  await recordManifest(layout, {edition:1,editionDate:"2026-11-10",deck:"d1"});
  lock.packages["node_modules/@types/node"].version="2"; lock.dependencies["@types/node"].version="2";
  await write("package-lock.json", JSON.stringify(lock));
  assert.match((await checkManual(layout)).errors.join("\n"), /changed: package-lock.json/);
});
