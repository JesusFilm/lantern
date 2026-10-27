import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { privilegeFixture } from "./privilege-test-support.js";
import { migrate } from "./schema.js";
import { createApp } from "./app.js";
import { hash } from "./access.js";

export async function coachingFixture(
  coach?: import("./coach-provider.js").CoachProvider,
) {
  const fixture = await privilegeFixture();
  await migrate(fixture.migration, fixture.roles);
  const ids = {
      member: randomUUID(),
      peer: randomUUID(),
      lead: randomUUID(),
      outsider: randomUUID(),
    },
    department = randomUUID(),
    outside = randomUUID();
  await fixture.admin.query(
    "INSERT INTO departments(id,name) VALUES($1,'Engineering'),($2,'Other')",
    [department, outside],
  );
  for (const [role, id] of Object.entries(ids)) {
    await fixture.admin.query("INSERT INTO users VALUES($1,$2,$3,$4)", [
      id,
      id,
      role + "@example.test",
      role,
    ]);
    await fixture.admin.query("INSERT INTO approved_emails VALUES($1)", [
      role + "@example.test",
    ]);
    await fixture.admin.query("INSERT INTO memberships VALUES($1,$2,$3,NULL)", [
      id,
      role === "outsider" ? outside : department,
      role === "lead" ? "career-lead" : "member",
    ]);
    await fixture.admin.query(
      "INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')",
      [hash(role), id],
    );
  }
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const a = server.address();
  assert.ok(a && typeof a !== "string");
  const origin = `http://127.0.0.1:${a.port}`;
  const app = createApp(fixture.runtime, { origin, coach });
  server.on("request", app);
  const request = (
    role: string,
    path: string,
    method = "GET",
    body?: unknown,
  ) =>
    fetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: "lantern-session=" + role,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => r as Omit<Response, "json"> & { json(): Promise<any> });
  return {
    ...fixture,
    ids,
    origin,
    server,
    app,
    request,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await fixture.close();
    },
  };
}
export const checkpoint = {
  step: 7,
  work: "Private project thoughts",
  answers: [],
  question: "",
  options: [],
  objective: "Help engineers find failures",
  initiatives: [],
  actions: [],
  action: "Review logs",
  date: "2026-11-30",
  goal: "By 30 November 2026, review failure reports.",
  title: "Useful failures",
  start: "2026-10-01",
  end: "2027-03-31",
  concern: "",
  sectionIndex: 0,
  goalIndex: 0,
};
export const draft = {
  title: checkpoint.title,
  start: checkpoint.start,
  end: checkpoint.end,
  sections: [
    {
      kind: "normal",
      objective: checkpoint.objective,
      goals: [checkpoint.goal],
    },
  ],
};
