import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { privilegeFixture } from './privilege-test-support.js';
import { createApp } from "./app.js";
import { migrate } from "./schema.js";
import type { PositionFocus } from "../shared/focus.js";
import type { SessionView } from "../shared/access.js";
import type { AccessConfig } from "./access.js";

test("local account and persisted position focuses", async (t) => {
  const fixture = await privilegeFixture();
  const {runtime:db,admin,migration,roles} = fixture;
  const server = createServer();
  try {
    await migrate(migration, roles);
    const user = randomUUID(),
      other = randomUUID(),
      dept = randomUUID();
    for (const id of [user, other])
      await admin.query(
        "INSERT INTO users(id,google_sub,email,name) VALUES($1::uuid,$1::text,'person@example.test','Original name')",
        [id],
      );
    await admin.query(
      "INSERT INTO departments(id,name) VALUES($1,'Engineering')",
      [dept],
    );
    for (const id of [user, other])
      await admin.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [
        id,
        dept,
      ]);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    server.on(
      "request",
      createApp(db, { origin, localUserId: user } as AccessConfig),
    );
    const request = (path: string, method = "GET", body?: unknown) =>
      fetch(origin + path, {
        method,
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    await t.test(
      "configured local user can open account and persist a display name",
      async () => {
        const session = (await (
          await request("/api/session")
        ).json()) as SessionView;
        assert.equal(session.user?.id, user);
        const result = await request("/api/account", "PATCH", {
          name: "  New display name  ",
        });
        assert.equal(result.status, 200);
        assert.equal(
          ((await (await request("/api/session")).json()) as SessionView).user!
            .name,
          "New display name",
        );
      },
    );
    await t.test(
      "create, reopen and revise a dated focus with all objective types and goals",
      async () => {
        const draft = {
          title: "2026 focus",
          start: "2026-01-01",
          end: "2026-12-31",
          sections: [
            {
              kind: "normal",
              objective: "Help new members find information.",
              goals: ["Publish a checklist by June."],
            },
            {
              kind: "personal-development",
              objective: "Improve facilitation.",
              goals: [],
            },
            {
              kind: "leadership",
              objective: "Support a new facilitator.",
              goals: ["Run a practice session."],
            },
          ],
        };
        const response = await request("/api/focuses", "POST", draft);
        assert.equal(response.status, 201);
        const created = (await response.json()) as PositionFocus;
        assert.equal(created.version, 1);
        assert.equal(
          ((await (await request("/api/focuses")).json()) as PositionFocus[])
            .length,
          1,
        );
        const loaded = (await (
          await request("/api/focuses/" + created.id)
        ).json()) as PositionFocus;
        assert.deepEqual(loaded.sections, draft.sections);
        const changed = await request("/api/focuses/" + created.id, "PUT", {
          ...draft,
          title: "Updated focus",
          version: loaded.version,
        });
        assert.equal(changed.status, 200);
        assert.equal(((await changed.json()) as PositionFocus).version, 2);
        assert.equal(
          (
            (await (
              await request("/api/focuses/" + created.id)
            ).json()) as PositionFocus
          ).title,
          "Updated focus",
        );
      },
    );

    await t.test(
      "reject invalid fields, ownership injection, impossible dates and oversized text",
      async () => {
        const valid = {
          title: "Valid",
          start: "2026-01-01",
          end: "2026-12-31",
          sections: [],
        };
        for (const body of [
          { ...valid, title: "" },
          { ...valid, start: "2026-02-30" },
          { ...valid, end: "2025-01-01" },
          { ...valid, userId: other },
          {
            ...valid,
            sections: [{ kind: "admin", objective: "X", goals: [] }],
          },
          {
            ...valid,
            sections: [{ kind: "normal", objective: " ", goals: [] }],
          },
          {
            ...valid,
            sections: [{ kind: "normal", objective: "X", goals: [" "] }],
          },
          { ...valid, title: "X".repeat(201) },
        ])
          assert.equal(
            (await request("/api/focuses", "POST", body)).status,
            400,
          );
        assert.equal(
          (
            await request("/api/account", "PATCH", {
              name: "",
              role: "career-lead",
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "malformed and oversized requests return safe JSON errors",
      async () => {
        for (const [body, status] of [
          ["{broken", 400],
          ["x".repeat(1024 * 1024 + 1), 413],
        ] as const) {
          const response = await fetch(origin + "/api/focuses", {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body,
          });
          assert.equal(response.status, status);
          assert.match(
            response.headers.get("content-type") ?? "",
            /application\/json/,
          );
          const error = (await response.json()) as { error: string };
          assert.ok(error.error);
          assert.ok(!error.error.includes(" at "));
        }
      },
    );
    await t.test(
      "stale edits cannot overwrite saved data; section and goal removal persist",
      async () => {
        const focus = (
          (await (await request("/api/focuses")).json()) as PositionFocus[]
        )[0]!;
        const draft = {
          title: focus.title,
          start: focus.start,
          end: focus.end,
          sections: [{ ...focus.sections[0], goals: [] }],
          version: focus.version,
        };
        assert.equal(
          (await request("/api/focuses/" + focus.id, "PUT", draft)).status,
          200,
        );
        assert.equal(
          (await request("/api/focuses/" + focus.id, "PUT", draft)).status,
          409,
        );
        const reopened = (await (
          await request("/api/focuses/" + focus.id)
        ).json()) as PositionFocus;
        assert.equal(reopened.sections.length, 1);
        assert.deepEqual(reopened.sections[0]!.goals, []);
      },
    );
    await t.test(
      "other users, unauthenticated requests and removed memberships cannot access documents",
      async () => {
        const focus = (
          (await (await request("/api/focuses")).json()) as PositionFocus[]
        )[0]!;
        async function as(
          id: string | undefined,
          path: string,
          method = "GET",
          body?: unknown,
        ) {
          const srv = createServer();
          await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
          const addr = srv.address();
          assert.ok(addr && typeof addr !== "string");
          const base = `http://127.0.0.1:${addr.port}`;
          srv.on("request", createApp(db, { origin: base, localUserId: id }));
          try {
            const res = await fetch(base + path, {
              method,
              headers: { Origin: base, "Content-Type": "application/json" },
              body: body ? JSON.stringify(body) : undefined,
            });
            return { status: res.status, data: await res.json() };
          } finally {
            srv.closeAllConnections();
            await new Promise<void>((r) => srv.close(() => r()));
          }
        }
        assert.equal((await as(undefined, "/api/focuses")).status, 401);
        assert.equal(
          (await as(undefined, "/api/account", "PATCH", { name: "Hacker" }))
            .status,
          401,
        );
        assert.deepEqual((await as(other, "/api/focuses")).data, []);
        assert.equal((await as(other, "/api/focuses/" + focus.id)).status, 404);
        assert.equal(
          (
            await as(other, "/api/focuses/" + focus.id, "PUT", {
              title: "Attack",
              start: focus.start,
              end: focus.end,
              sections: [],
              version: focus.version,
            })
          ).status,
          404,
        );
        const different = randomUUID();
        await admin.query("INSERT INTO departments(id,name) VALUES($1,'Other')", [
          different,
        ]);
        await admin.query(
          "UPDATE memberships SET department_id=$1 WHERE user_id=$2",
          [different, user],
        );
        assert.deepEqual(await (await request("/api/focuses")).json(), []);
        assert.equal((await request("/api/focuses/" + focus.id)).status, 404);
        await admin.query(
          "UPDATE memberships SET department_id=$1,deleted_at=now() WHERE user_id=$2",
          [dept, user],
        );
        assert.equal((await request("/api/focuses")).status, 403);
        await admin.query(
          "UPDATE memberships SET deleted_at=NULL WHERE user_id=$1",
          [user],
        );
        assert.equal((await request("/api/focuses/" + focus.id)).status, 200);
        assert.equal(
          (
            await fetch(origin + "/api/focuses", {
              method: "POST",
              headers: {
                Origin: "https://other.test",
                "Content-Type": "application/json",
              },
              body: "{}",
            })
          ).status,
          403,
        );
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await fixture.close();
  }
});
