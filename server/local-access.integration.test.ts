import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import pg from "pg";

test(
  "explicit local startup provisions once and retains the account across process restart",
  { timeout: 30000 },
  async () => {
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
      schema = `local_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const socket = createServer();
    await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
    const addr = socket.address();
    assert.ok(addr && typeof addr !== "string");
    const port = addr.port;
    await new Promise<void>((r) => socket.close(() => r()));
    const origin = `http://127.0.0.1:${port}`;
    let child: ReturnType<typeof spawn> | undefined;
    async function start() {
      child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
        env: {
          ...process.env,
          DATABASE_URL: url.toString(),
          HOST: "127.0.0.1",
          PORT: String(port),
          APP_ORIGIN: origin,
          LOCAL_ACCESS: "1",
          NODE_ENV: "test",
          GOOGLE_CLIENT_ID: "",
          GOOGLE_CLIENT_SECRET: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      await new Promise<void>((resolve, reject) => {
        child!.once("exit", () =>
          reject(new Error("Server exited before listening")),
        );
        child!.stdout!.on("data", (data) => {
          if (String(data).includes("Lantern:")) resolve();
        });
      });
    }
    async function stop() {
      if (child) {
        const c = child;
        child = undefined;
        await new Promise<void>((r) => {
          c.once("exit", () => r());
          c.kill("SIGTERM");
        });
      }
    }
    try {
      await start();
      const first = (await (await fetch(origin + "/api/session")).json()) as {
        user: { id: string; name: string };
        department: { id: string };
        localAccess: boolean;
      };
      assert.ok(first.user);
      assert.ok(first.department);
      assert.equal(first.localAccess, true);
      assert.equal(
        (
          await fetch(origin + "/api/account", {
            method: "PATCH",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Persisted local name" }),
          })
        ).status,
        200,
      );
      await stop();
      for (let n = 0; n < 2; n++) execFileSync(process.execPath, ['dist/server/migrate.js'], {
        env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
      });
      await start();
      const next = (await (
        await fetch(origin + "/api/session")
      ).json()) as typeof first;
      assert.equal(next.user.id, first.user.id);
      assert.equal(next.department.id, first.department.id);
      assert.equal(next.user.name, "Persisted local name");
      assert.deepEqual(await (await fetch(origin + "/api/focuses")).json(), []);
    } finally {
      await stop();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
