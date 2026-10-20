import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { privilegeFixture } from "./privilege-test-support.js";
import { migrate, assertSchemaReady } from "./schema.js";
import { createApp } from "./app.js";
import { hash } from "./access.js";
import type { DepartmentDirection } from "../shared/direction.js";
import type { PositionFocus } from "../shared/focus.js";

test("department direction persists through the authenticated HTTP interface", async (t) => {
  const f = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(f.migration, f.roles);
    const lead = randomUUID(), member = randomUUID(), outsider = randomUUID();
    const team = randomUUID(), otherTeam = randomUUID();
    for (const id of [team, otherTeam])
      await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Team')", [id]);
    for (const [id, role, department] of [[lead, "career-lead", team], [member, "member", team], [outsider, "career-lead", otherTeam]]) {
      await f.admin.query("INSERT INTO users VALUES($1::uuid,$1::text,$2,'Person')", [id, `${id}@example.test`]);
      await f.admin.query("INSERT INTO approved_emails VALUES($1)", [`${id}@example.test`]);
      await f.admin.query("INSERT INTO memberships VALUES($1,$2,$3,NULL)", [id, department, role]);
      await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')", [hash(id!), id]);
    }
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    server.on("request", createApp(f.runtime, { origin }));
    const request = (actor: string, path = "/api/department/direction", method = "GET", body?: unknown) =>
      fetch(origin + path, { method, headers: { Origin: origin, Cookie: `lantern-session=${actor}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

    await t.test("lead saves mission and initiatives, which members can reopen", async () => {
      const initial = await request(lead);
      assert.equal(initial.status, 200);
      assert.deepEqual(await initial.json(), { mission: "", initiatives: [], version: 0 });
      const response = await request(lead, undefined, "PUT", {
        mission: "Help people find hope in their heart language.", version: 0,
        initiatives: [{ name: "Language access", archived: false }, { name: "Partner pathways", archived: false }],
      });
      assert.equal(response.status, 200);
      const saved = await response.json() as DepartmentDirection;
      assert.equal(saved.version, 1);
      assert.equal(saved.initiatives.length, 2);
      assert.match(saved.initiatives[0]!.id, /^[a-f0-9-]{36}$/);
      // Recreate the application connection to prove this is persisted state.
      server.removeAllListeners("request");
      server.on("request", createApp(f.runtime, { origin }));
      assert.deepEqual(await (await request(member)).json(), saved);
      assert.deepEqual(await (await request(outsider)).json(), { mission: "", initiatives: [], version: 0 });
    });

    await t.test("direction rejects unauthorized, invalid and stale writes without losing saved content", async () => {
      const saved = await (await request(lead)).json() as DepartmentDirection;
      for (const actor of [member, "missing-session"]) {
        assert.equal((await request(actor, undefined, "PUT", saved)).status, actor === member ? 403 : 401);
      }
      for (const invalid of [
        { ...saved, departmentId: otherTeam }, { ...saved, mission: "x".repeat(1001) },
        { ...saved, initiatives: [{ name: " ", archived: false }] },
        { ...saved, initiatives: [...saved.initiatives, { name: "language ACCESS", archived: false }] },
        { ...saved, initiatives: [] },
        { ...saved, initiatives: [{ ...saved.initiatives[0], id: randomUUID() }, saved.initiatives[1]] },
      ]) assert.equal((await request(lead, undefined, "PUT", invalid)).status, 400);
      assert.equal((await request(lead, undefined, "PUT", { ...saved, version: 0 })).status, 409);
      assert.deepEqual(await (await request(lead)).json(), saved);
      assert.equal((await request("missing-session")).status, 401);
      await f.admin.query("UPDATE memberships SET deleted_at=now() WHERE user_id=$1", [member]);
      assert.equal((await request(member)).status, 403);
      await f.admin.query("UPDATE memberships SET deleted_at=NULL WHERE user_id=$1", [member]);
      const originDenied = await fetch(origin + "/api/department/direction", {
        method: "PUT", headers: { Origin: "https://other.test", Cookie: `lantern-session=${lead}`, "Content-Type": "application/json" },
        body: JSON.stringify(saved),
      });
      assert.equal(originDenied.status, 403);
    });

    await t.test("objective alignment persists, validates department choices and preserves confirmed history", async () => {
      let direction = await (await request(member)).json() as DepartmentDirection;
      const [first, second] = direction.initiatives;
      const draft = { title: "Aligned focus", start: "2026-01-01", end: "2026-12-31",
        sections: [{ kind: "normal", objective: "Share useful media.", goals: ["Publish a guide by June."],
          alignment: { initiatives: [{ id: first!.id, name: "Forged label" }, { id: second!.id, name: second!.name }], other: false } }] };
      const response = await request(member, "/api/focuses", "POST", draft);
      assert.equal(response.status, 201);
      let focus = await response.json() as PositionFocus;
      let reopened = await (await request(member, "/api/focuses/" + focus.id)).json() as PositionFocus;
      assert.deepEqual(reopened.sections[0]!.alignment!, { initiatives: [
        { id: first!.id, name: "Language access" }, { id: second!.id, name: "Partner pathways" },
      ], other: false });
      const path = "/api/focuses/" + focus.id;
      for (const alignment of [
        { initiatives: [{ id: randomUUID(), name: "Unknown" }], other: false },
        { initiatives: [{ id: first!.id, name: first!.name }], other: true },
        { initiatives: [{ id: first!.id, name: first!.name }, { id: first!.id, name: first!.name }], other: false },
        { initiatives: [], other: "yes" },
      ]) assert.equal((await request(member, path, "PUT", { ...draft, version: focus.version,
        sections: [{ ...draft.sections[0], alignment }] })).status, 400);
      assert.equal((await request(outsider, "/api/focuses", "POST", draft)).status, 400);
      assert.equal((await request(outsider, path)).status, 404);

      // Archive a selected initiative: existing references survive, new selections cannot use it.
      direction.initiatives[0]!.archived = true;
      const archived = await request(lead, undefined, "PUT", direction);
      assert.equal(archived.status, 200); direction = await archived.json() as DepartmentDirection;
      assert.equal((await request(member, "/api/focuses", "POST", draft)).status, 400);
      const newlyAlignedObjective = { ...draft, version: focus.version,
        sections: [...draft.sections, { kind: "normal", objective: "A new objective", goals: [],
          alignment: { initiatives: [{ id: first!.id, name: first!.name }], other: false } }] };
      assert.equal((await request(member, path, "PUT", newlyAlignedObjective)).status, 400);
      const retained = await request(member, path, "PUT", { ...draft, version: focus.version });
      assert.equal(retained.status, 200); focus = await retained.json() as PositionFocus;
      const confirmed = await request(lead, `/api/department/members/${member}/focuses/${focus.id}/confirm`, "POST", { version: focus.version });
      assert.equal(confirmed.status, 200); focus = await confirmed.json() as PositionFocus;
      direction.initiatives[1]!.name = "New partner direction";
      assert.equal((await request(lead, undefined, "PUT", direction)).status, 200);
      reopened = await (await request(member, path)).json() as PositionFocus;
      assert.equal(reopened.sections[0]!.alignment!.initiatives[1]!.name, "Partner pathways");
      const leadView = await (await request(lead, `/api/department/members/${member}/focuses/${focus.id}`)).json() as { focus: PositionFocus };
      assert.deepEqual(leadView.focus.sections, reopened.sections);
      assert.equal((await request(member, path, "PUT", { ...draft, version: focus.version })).status, 409);

      const other = { ...draft, sections: [{ ...draft.sections[0], alignment: { initiatives: [], other: true } }] };
      const otherResponse = await request(member, "/api/focuses", "POST", other);
      assert.equal(otherResponse.status, 201);
      const otherFocus = await otherResponse.json() as PositionFocus;
      assert.deepEqual(((await (await request(member, "/api/focuses/" + otherFocus.id)).json()) as PositionFocus).sections[0]!.alignment,
        { initiatives: [], other: true });
      assert.equal((await request(member, "/api/focuses", "POST", { ...draft, sections: [] })).status, 201);
    });

    await t.test("failed and concurrent configuration saves cannot partially replace the mission or initiatives", async () => {
      const before = await (await request(lead)).json() as DepartmentDirection;
      await f.migration.query("ALTER TABLE department_direction ADD CONSTRAINT synthetic_direction_failure CHECK (mission <> 'Fail this write')");
      const failed = await request(lead, undefined, "PUT", { ...before, mission: "Fail this write",
        initiatives: [...before.initiatives, { name: "Should not persist", archived: false }] });
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { error: "The service is temporarily unavailable. Please try again." });
      assert.deepEqual(await (await request(member)).json(), before);
      await f.migration.query("ALTER TABLE department_direction DROP CONSTRAINT synthetic_direction_failure");
      const results = await Promise.all(["First mission", "Second mission"].map(mission => request(lead, undefined, "PUT", { ...before, mission })));
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      const after = await (await request(member)).json() as DepartmentDirection;
      assert.equal(after.version, before.version + 1);
      assert.deepEqual(after.initiatives, before.initiatives);
      await f.admin.query("UPDATE memberships SET deleted_at=now() WHERE user_id=$1", [lead]);
      assert.equal((await request(lead, undefined, "PUT", after)).status, 403);
      await f.admin.query("UPDATE memberships SET deleted_at=NULL WHERE user_id=$1", [lead]);
      assert.deepEqual(await (await request(lead)).json(), after);
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await f.close();
  }
});

test("schema 6 upgrades add empty direction without rewriting existing focus documents", async () => {
  const f = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(f.migration, f.roles);
    await f.migration.query("DROP TABLE department_direction");
    await f.migration.query("DELETE FROM schema_migrations WHERE version=7");
    const user = randomUUID(), department = randomUUID(), id = randomUUID();
    await f.admin.query("INSERT INTO users VALUES($1::uuid,$1::text,'legacy@example.test','Legacy member')", [user]);
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Legacy team')", [department]);
    await f.admin.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [user, department]);
    const sections = [{ kind: "normal", objective: "Keep this objective", goals: [] }];
    await f.admin.query(`INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end,sections)
      VALUES($1,$2,$3,'Legacy focus','2026-01-01','2026-12-31',$4)`, [id, user, department, JSON.stringify(sections)]);
    await assert.rejects(assertSchemaReady(f.runtime));
    await Promise.all([migrate(f.migration, f.roles), migrate(f.migration, f.roles)]);
    await assertSchemaReady(f.runtime);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    server.on("request", createApp(f.runtime, { origin, localUserId: user }));
    assert.deepEqual(await (await fetch(origin + "/api/department/direction")).json(), { mission: "", initiatives: [], version: 0 });
    const focus = await (await fetch(origin + "/api/focuses/" + id)).json() as PositionFocus;
    assert.deepEqual(focus.sections, sections);
    assert.equal(focus.version, 1);
    assert.equal(focus.status, "draft");
    await assert.rejects(f.runtime.query("UPDATE department_direction SET department_id=gen_random_uuid()"), { code: "42501" });
    await assert.rejects(f.runtime.query("DELETE FROM department_direction"), { code: "42501" });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await f.close();
  }
});
