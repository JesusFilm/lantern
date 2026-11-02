import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("the staging command refuses production and non-main dispatch before connecting", () => {
  for (const extra of [
    { RELEASE_TARGET: "production", GITHUB_REF: "refs/heads/main" },
    { RELEASE_TARGET: "stage", GITHUB_REF: "refs/heads/feature" },
  ]) {
    const run = spawnSync(process.execPath, ["--import", "tsx", "tools/manual/qa-stage.ts"], {
      env: { ...process.env, GITHUB_REPOSITORY: "JesusFilm/lantern", GITHUB_EVENT_NAME: "workflow_dispatch", ...extra },
      encoding: "utf8",
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /failed safely/i);
  }
});
