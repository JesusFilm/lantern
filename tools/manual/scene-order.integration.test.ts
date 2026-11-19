import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);

test("manual scenes have the same pixels across repeated captures", { timeout: 180_000 }, async (t) => {
  const preview = await mkdtemp(join(tmpdir(), "lantern-manual-preview-test-"));
  t.after(() => rm(preview, { recursive: true, force: true }));
  const scenes = ["member-confirm-dialog", "confirm-unrequested"];

  async function generate(scene: string, shots: string) {
    await run(process.execPath, ["--import", "tsx", "tools/manual/generate.ts", `--only=${shots}`, `--preview-dir=${preview}`]);
    return readFile(join(preview, `${scene}.png`));
  }
  for (const scene of scenes) {
    const images: Buffer[] = [];
    for (let index = 0; index < 6; index++) {
      images.push(await generate(scene, index % 2 ? `sign-in,${scene}` : scene));
    }
    assert.ok(images.every((image) => image.equals(images[0]!)), `${scene} must have identical pixels on repeated captures`);
  }
});
