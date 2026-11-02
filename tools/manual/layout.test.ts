import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutMedia } from "./layout.js";

const box = { width: 800, height: 560 };
for (const [name, aspects] of Object.entries({
  "one desktop screen": [1.6],
  "a tall desktop page": [0.6],
  "four phone frames": [0.46, 0.46, 0.46, 0.46],
  "two desktop screens": [1.6, 1.6],
  "desktop with phone": [1.6, 0.46],
  "five mixed images": [1.6, 1.6, 0.46, 0.46, 1.1],
})) {
  test(`${name} fit the media box uncropped, in order`, () => {
    const { rows } = layoutMedia(aspects, box, 16, 28);
    assert.deepEqual(rows.flat().map((p) => p.index), aspects.map((_, i) => i));
    for (const row of rows) {
      assert.ok(row.reduce((w, p) => w + p.width, 0) + 16 * (row.length - 1) <= box.width);
      for (const p of row) assert.ok(Math.abs(p.width / p.height - aspects[p.index]!) < 0.02, "aspect ratio preserved");
    }
    const height = rows.reduce((h, row) => h + Math.max(...row.map((p) => p.height)) + 28, 0) + 16 * (rows.length - 1);
    assert.ok(height <= box.height);
    assert.ok(rows.flat().every((p) => p.height >= 120), "images stay legible");
  });
}

