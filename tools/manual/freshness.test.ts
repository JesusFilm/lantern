import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkManual, recordManifest, type ManualLayout } from "./freshness.js";

async function project(t: import("node:test").TestContext) {
  const root = await mkdtemp(join(tmpdir(), "manual-freshness-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = async (path: string, content: string | Buffer) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), content); };
  await write("client/main.tsx", "render()");
  await write("server/focus.ts", "save()");
  await write("server/focus.integration.test.ts", "test()");
  await write("docs/PRD.md", "# Lantern");
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

