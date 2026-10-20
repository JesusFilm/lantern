import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { privilegeFixture } from './privilege-test-support.js';
import { createApp } from "./app.js";
import { hash } from "./access.js";
import { migrate } from "./schema.js";
import type {
  PositionFocus,
  MemberFocusList,
  MemberFocusDetail,
} from "../shared/focus.js";

test("career lead reads current members through scoped HTTP routes", async (t) => {
  const fixture = await privilegeFixture();
  const {runtime:db,admin,migration,roles} = fixture;
  const server = createServer();
  try {
    await migrate(migration, roles);
    const lead = randomUUID(),
      alice = randomUUID(),
      bob = randomUUID(),
      outsider = randomUUID();
    const department = randomUUID(),
      otherDepartment = randomUUID();
    for (const id of [department, otherDepartment])
      await admin.query("INSERT INTO departments(id,name) VALUES($1,'Team')", [
        id,
      ]);
    for (const [id, name, role, team] of [
      [lead, "Lead", "career-lead", department],
      [alice, "Alice", "member", department],
      [bob, "Bob", "member", department],
      [outsider, "Outsider", "career-lead", otherDepartment],
    ]) {
      await admin.query(
        "INSERT INTO users(id,google_sub,email,name) VALUES($1::uuid,$1::text,$2,$3)",
        [id, `${name}@example.test`, name],
      );
      await admin.query("INSERT INTO approved_emails VALUES(lower($1))", [
        `${name}@example.test`,
      ]);
      await admin.query("INSERT INTO memberships VALUES($1,$2,$3,NULL)", [
        id,
        team,
        role,
      ]);
      await admin.query(
        "INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')",
        [hash(id!), id],
      );
    }
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    server.on("request", createApp(db, { origin }));
    const request = (
      actor: string,
      path: string,
      method = "GET",
      body?: unknown,
    ) =>
      fetch(origin + path, {
        method,
        headers: {
          Cookie: `lantern-session=${actor}`,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const draft = {
      title: "Alice annual focus",
      start: "2026-01-01",
      end: "2026-12-31",
      sections: [
        {
          kind: "normal",
          objective: "Support onboarding",
          goals: ["Publish a guide by June"],
        },
      ],
    };
    const created = await request(alice, "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const focus = (await created.json()) as PositionFocus;
    const path = `/api/department/members/${alice}/focuses`;
    await t.test(
      "lead sees named roster, dated lists including empty lists, and full persisted detail",
      async () => {
        const roster = await request(lead, "/api/department");
        assert.equal(roster.status, 200);
        assert.deepEqual(
          (
            (await roster.json()) as { members: { name: string }[] }
          ).members.map((m: { name: string }) => m.name),
          ["Alice", "Bob", "Lead"],
        );
        const list = await request(lead, path);
        assert.equal(list.status, 200);
        const data = (await list.json()) as MemberFocusList;
        assert.deepEqual(data.member, {
          id: alice,
          name: "Alice",
          email: "Alice@example.test",
        });
        assert.equal(data.focuses[0]!.start, "2026-01-01");
        assert.equal(data.focuses[0]!.id, focus.id);
        const detail = await request(lead, `${path}/${focus.id}`);
        assert.equal(detail.status, 200);
        assert.deepEqual(
          ((await detail.json()) as MemberFocusDetail).focus,
          focus,
        );
        assert.deepEqual(
          (
            (await (
              await request(lead, `/api/department/members/${bob}/focuses`)
            ).json()) as MemberFocusList
          ).focuses,
          [],
        );
      },
    );
    await t.test(
      "members cannot fetch the roster or grant themselves read authority; lead reads are never writes",
      async () => {
        for (const actor of [alice, bob]) {
          assert.equal((await request(actor, "/api/department")).status, 403);
          for (const endpoint of [path, `${path}/${focus.id}`]) {
            assert.equal(
              (
                await request(
                  actor,
                  endpoint +
                    `?role=career-lead&userId=${lead}&departmentId=${department}`,
                )
              ).status,
              403,
            );
          }
        }
        for (const actor of [lead, bob, outsider]) {
          assert.equal(
            (await request(actor, `/api/focuses/${focus.id}`)).status,
            404,
          );
          assert.equal(
            (
              await request(actor, `/api/focuses/${focus.id}`, "PUT", {
                ...draft,
                version: 1,
              })
            ).status,
            404,
          );
        }
        assert.equal(
          (
            await request(lead, `${path}/${focus.id}`, "PUT", {
              ...draft,
              version: 1,
            })
          ).status,
          404,
        );
        for (const field of ["role", "userId", "departmentId"]) {
          assert.equal(
            (
              await request(lead, "/api/focuses", "POST", {
                ...draft,
                [field]: alice,
              })
            ).status,
            400,
          );
        }
        assert.deepEqual(
          await (await request(alice, `/api/focuses/${focus.id}`)).json(),
          focus,
        );
      },
    );
    await t.test(
      "guessed IDs, mismatched people and other departments do not reveal records",
      async () => {
        for (const endpoint of [path, `${path}/${focus.id}`]) {
          assert.equal((await request("", endpoint)).status, 401);
          assert.equal((await request(outsider, endpoint)).status, 404);
        }
        const absent = await request(
          lead,
          `/api/department/members/unknown/focuses/${focus.id}`,
        );
        const mismatch = await request(
          lead,
          `/api/department/members/${bob}/focuses/${focus.id}`,
        );
        assert.equal(absent.status, 404);
        assert.equal(mismatch.status, 404);
        assert.deepEqual(await absent.json(), await mismatch.json());
        assert.equal((await request(lead, `${path}/unknown`)).status, 404);
        await admin.query(
          "UPDATE memberships SET department_id=$1 WHERE user_id=$2",
          [otherDepartment, alice],
        );
        assert.equal((await request(lead, path)).status, 404);
        assert.deepEqual(
          ((await (await request(outsider, path)).json()) as MemberFocusList)
            .focuses,
          [],
        );
        await admin.query(
          "UPDATE memberships SET department_id=$1 WHERE user_id=$2",
          [department, alice],
        );
      },
    );
    await t.test(
      "storage failures return safe errors and recover without changing the document",
      async () => {
        await migration.query(
          "ALTER TABLE position_focuses RENAME TO unavailable_focuses",
        );
        try {
          for (const endpoint of [path, `${path}/${focus.id}`]) {
            const response = await request(lead, endpoint);
            assert.equal(response.status, 503);
            assert.deepEqual(await response.json(), {
              error:
                "The service is temporarily unavailable. Please try again.",
            });
          }
        } finally {
          await migration.query(
            "ALTER TABLE unavailable_focuses RENAME TO position_focuses",
          );
        }
        assert.deepEqual(
          (
            (await (
              await request(lead, `${path}/${focus.id}`)
            ).json()) as MemberFocusDetail
          ).focus,
          focus,
        );
        for (const actor of [lead, bob]) {
          const response = await request(actor, "/api/focuses", "POST", {
            ...draft,
            title: `${actor} own focus`,
          });
          assert.equal(response.status, 201);
          const own = (await response.json()) as PositionFocus;
          assert.equal(
            (
              await request(actor, `/api/focuses/${own.id}`, "PUT", {
                ...draft,
                title: "Owner edited",
                version: 1,
              })
            ).status,
            200,
          );
          assert.equal(
            (await request(alice, `/api/focuses/${own.id}`)).status,
            404,
          );
          assert.equal(
            (
              await request(
                lead,
                `/api/department/members/${actor}/focuses/${own.id}`,
              )
            ).status,
            200,
          );
        }
      },
    );
    await t.test(
      "revocation denies existing sessions and target removal hides retained focuses",
      async () => {
        await admin.query(
          "UPDATE memberships SET deleted_at=now() WHERE user_id=$1",
          [alice],
        );
        assert.equal((await request(lead, path)).status, 404);
        assert.equal((await request(lead, `${path}/${focus.id}`)).status, 404);
        assert.equal((await request(alice, "/api/focuses")).status, 403);
        const roster = (await (
          await request(lead, "/api/department")
        ).json()) as { members: { id: string }[] };
        assert.ok(!roster.members.some((m: { id: string }) => m.id === alice));
        // Restore only this synthetic fixture to verify retained history via HTTP.
        await admin.query(
          "UPDATE memberships SET deleted_at=NULL WHERE user_id=$1",
          [alice],
        );
        assert.deepEqual(
          (
            (await (
              await request(lead, `${path}/${focus.id}`)
            ).json()) as MemberFocusDetail
          ).focus,
          focus,
        );
        await admin.query(
          "UPDATE memberships SET deleted_at=now() WHERE user_id=$1",
          [lead],
        );
        assert.equal((await request(lead, path)).status, 403);
        await admin.query(
          "UPDATE memberships SET deleted_at=NULL,role='member' WHERE user_id=$1",
          [lead],
        );
        assert.equal((await request(lead, path)).status, 403);
        await admin.query(
          "UPDATE memberships SET role='career-lead' WHERE user_id=$1",
          [lead],
        );
        await admin.query(
          "DELETE FROM approved_emails WHERE email='lead@example.test'",
        );
        for (const endpoint of ["/api/department", path, `${path}/${focus.id}`])
          assert.equal((await request(lead, endpoint)).status, 401);
      },
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await fixture.close();
  }
});
