import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { finalizeGeneration } from "./finalize.js";
import { readManifest } from "./freshness.js";

test("successful unchanged-deck generation refreshes provenance without changing the PDF or edition", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "manual-generation-"));
  t.after(() => rm(root, {recursive:true,force:true}));
  await mkdir(join(root,"client"), {recursive:true});
  await mkdir(join(root,"docs/manual"), {recursive:true});
  await writeFile(join(root,"client/source.ts"), "first");
  const layout = {root, supplied:[]};
  let renders = 0;
  const render = async () => { renders++; return Buffer.from("the rendered manual"); };
  await finalizeGeneration(layout, "same deck", render);
  const first = await readManifest(root); const pdf = await readFile(join(root,"docs/manual/lantern-manual.pdf"));
  await writeFile(join(root,"client/source.ts"), "second");
  await finalizeGeneration(layout, "same deck", render);
  const second = await readManifest(root);
  assert.equal(renders, 1);
  assert.equal(second?.edition, first?.edition);
  assert.deepEqual(await readFile(join(root,"docs/manual/lantern-manual.pdf")), pdf);
  assert.notEqual(second?.verification?.rawSources["client/source.ts"], first?.verification?.rawSources["client/source.ts"]);
});
