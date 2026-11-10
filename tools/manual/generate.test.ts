import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

/**
 * A full successful generation always records fresh verification provenance
 * (manual.md, ADR 0012). The "deck and PDF unchanged" path must not copy the
 * previous manifest's verification, because the recorded raw sources would
 * then describe the earlier generation, not the one that just succeeded.
 */
test("a full generation with an unchanged deck still records fresh verification", async (t) => {
  const source = await readFile(join(import.meta.dirname, "generate.ts"), "utf8");
  assert.doesNotMatch(source, /previous\?\.verification/, "generate.ts must not carry over the previous manifest's verification");
});
