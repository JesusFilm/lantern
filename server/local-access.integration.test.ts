import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { privilegeFixture } from './privilege-test-support.js';
import { migrate } from './schema.js';
import type { DepartmentDirection } from "../shared/direction.js";
import { prepareLocalAccount } from './local-access.js';

test(
  "local startup seeds staging initiative identities and preserves local edits across restarts",
  { timeout: 30000 },
  async () => {
    const fixture = await privilegeFixture();
    const { runtime, migration, admin, roles } = fixture;
    const url = new URL(runtime.options.connectionString!);
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
      if (child && child.exitCode === null) {
        const c = child;
        child = undefined;
        await new Promise<void>((r) => {
          c.once("exit", () => r());
          c.kill("SIGTERM");
        });
      }
    }
    try {
      await migrate(migration, roles);
      await prepareLocalAccount(admin);
      await start();
      const first = (await (await fetch(origin + "/api/session")).json()) as {
        user: { id: string; name: string };
        department: { id: string };
        localAccess: boolean;
      };
      assert.ok(first.user);
      assert.ok(first.department);
      assert.equal(first.localAccess, true);
      const direction = await (await fetch(origin + "/api/department/direction")).json() as DepartmentDirection;
      assert.deepEqual(direction.initiatives.map(({ name, appearance, archived }) => ({ name, appearance, archived })), [
        { name: "Love What We Build", appearance: { icon: "heart", color: "#c74998" }, archived: false },
        { name: "Rethink How We Build", appearance: { icon: "lightbulb", color: "#3276b0" }, archived: false },
        { name: "Role Clarity And Growth", appearance: { icon: "sprout", color: "#267c65" }, archived: false },
        { name: "Team Connectedness", appearance: { icon: "users", color: "#e4bf24" }, archived: false },
      ]);

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
      await migrate(migration, roles);
      await start();
      const next = (await (
        await fetch(origin + "/api/session")
      ).json()) as typeof first;
      assert.equal(next.user.id, first.user.id);
      assert.equal(next.department.id, first.department.id);
      assert.equal(next.user.name, "Persisted local name");
      assert.deepEqual(await (await fetch(origin + "/api/department/direction")).json(), direction);
      assert.deepEqual(await (await fetch(origin + "/api/focuses")).json(), []);

      // Fixture setup grants this synthetic person the ordinary settings workflow.
      await admin.query("UPDATE memberships SET role='career-lead' WHERE user_id=$1", [first.user.id]);
      const edited = {
        ...direction, mission: "Keep my local mission", missionImage: null,
        initiatives: [
          { ...direction.initiatives[0]!, archived: true, appearance: { icon: "flag", color: "#526578" } },
          { ...direction.initiatives[1]!, name: " rethink how we build ", appearance: undefined },
          ...direction.initiatives.slice(2),
          { id: undefined, name: "My local experiment", archived: false },
        ],
      };
      const response = await fetch(origin + "/api/department/direction", {
        method: "PUT", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(edited),
      });
      assert.equal(response.status, 200);
      const saved = await response.json() as DepartmentDirection;
      const created = await fetch(origin + "/api/focuses", {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Keep my local draft", start: "2026-11-01", end: "2026-12-31", sections: [] }),
      });
      assert.equal(created.status, 201);
      const focus = await created.json() as { id: string };
      const savedFocus = await (await fetch(origin + "/api/focuses/" + focus.id)).json();
      await stop();
      await start();
      const filled = await (await fetch(origin + "/api/department/direction")).json() as DepartmentDirection;
      const expected = {
        ...saved, version: saved.version + 1,
        initiatives: saved.initiatives.map(item => item.id === saved.initiatives[1]!.id
          ? { ...item, appearance: { icon: "lightbulb", color: "#3276b0" } } : item),
      };
      assert.deepEqual(filled, expected);
      assert.deepEqual(await (await fetch(origin + "/api/focuses/" + focus.id)).json(), savedFocus);
      await stop();
      await start();
      assert.deepEqual(await (await fetch(origin + "/api/department/direction")).json(), expected);
      await stop();
      await admin.query("UPDATE memberships SET deleted_at=now() WHERE user_id=$1", [first.user.id]);
      await start();
      const removed = await (await fetch(origin + "/api/session")).json() as { department?: unknown };
      assert.equal(removed.department, undefined);
      assert.equal((await fetch(origin + "/api/department/direction")).status, 403);

    } finally {
      await stop();
      await fixture.close();
    }
  },
);
