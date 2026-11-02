import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn, execFileSync } from "node:child_process";

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


test("stage labels cannot authorize a self-consistent connection to an unpinned endpoint", async () => {
  const { createServer } = await import("node:net");
  const { once } = await import("node:events");
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "qa-stage-target-"));
  let connections = 0;
  const server = createServer((socket) => {
    connections++;
    socket.on("data", () => socket.destroy());
  });
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-keyout", join(directory, "key.pem"), "-out", join(directory, "ca.pem"), "-days", "1", "-subj", "/CN=synthetic-qa-ca", "-addext", "basicConstraints=critical,CA:TRUE"], { stdio: "pipe" });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `127.0.0.1:${address.port}`;
    const child = spawn(process.execPath, ["--import", "tsx", "tools/manual/qa-stage.ts"], {
      env: {
        PATH: process.env.PATH,
        GITHUB_REPOSITORY: "JesusFilm/lantern", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch",
        GITHUB_SHA: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        RELEASE_TARGET: "stage", RAILWAY_PROJECT: "9a445065-bde0-4184-bdb8-4161b033cc8f", RAILWAY_ENVIRONMENT: "8e19675b-08a2-4bfb-9762-fd6d8561fcfd",
        LANTERN_DB_EXPECTED_ENDPOINT: endpoint, LANTERN_DB_NAME: "railway", LANTERN_DB_SCHEMA: "lantern",
        LANTERN_DB_RUNTIME_ROLE: "lantern_stage_runtime", LANTERN_DB_MIGRATION_ROLE: "lantern_stage_migration", LANTERN_DB_ADMIN_ROLE: "lantern_stage_admin",
        MIGRATION_DATABASE_URL: `postgresql://lantern_stage_migration:synthetic-only@${endpoint}/railway`,
        MIGRATION_DATABASE_CA: readFileSync(join(directory, "ca.pem"), "utf8"),
        QA_SHARON: "qa0@example.test", QA_SUSHMA: "qa1@example.test", QA_ESTHER: "qa2@example.test", QA_LEAD: "SharonQA",
      },
      timeout: 5000,
    });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { output += data; });
    const [code] = await once(child, "close");
    assert.equal(code, 1);
    assert.match(output, /failed safely/i);
    assert.doesNotMatch(output, /synthetic-only|qa[012]@example/);
    assert.equal(connections, 0, "untrusted endpoint must be rejected before opening a database connection");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
