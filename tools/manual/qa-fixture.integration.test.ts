import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { coachingFixture } from "../../server/coach-test-support.js";
import { hash } from "../../server/access.js";
import { resetQaDepartment } from "./qa-fixture.js";

test("QA reset leaves active CI acceptance accounts and sessions untouched", async () => {
  // @ts-expect-error The release fixture is a JavaScript module.
  const { withAcceptanceFixture } = await import("../release/acceptance-fixture.mjs");
  const f = await coachingFixture();
  try {
    for (let i = 0; i < 2; i++) {
      const id = randomUUID(), email = `acceptqa${i}@example.test`;
      await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)", [id, "acceptqa-"+i,email,"QA "+i]);
      await f.admin.query("INSERT INTO approved_emails VALUES($1)", [email]);
    }
    await withAcceptanceFixture(f.migration, async (fixture: { actors: Record<string, { userId: string }> }) => {
      const ids = Object.values(fixture.actors).map((actor) => actor.userId);
      const before = await f.admin.query("SELECT count(*)::int n FROM sessions WHERE user_id=ANY($1::uuid[])", [ids]);
      await resetQaDepartment(f.admin, { participants: ["acceptqa0@example.test","acceptqa1@example.test","acceptqa2@example.test"], lead: "acceptqa0@example.test" });
      const after = await f.admin.query("SELECT count(*)::int n FROM sessions WHERE user_id=ANY($1::uuid[])", [ids]);
      assert.equal(before.rows[0].n, 4);
      assert.equal(after.rows[0].n, 4);
      assert.equal((await f.admin.query("SELECT count(*)::int n FROM memberships WHERE user_id=ANY($1::uuid[])", [ids])).rows[0].n, 4);
    });
  } finally { await f.close(); }
});


test("refuses a registered QA account whose approval has been revoked", async () => {
  const f = await coachingFixture();
  try {
    for (let i = 0; i < 3; i++) {
      const id = randomUUID(), email = `revoked${i}@example.test`;
      await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)", [id, "revoked-"+i,email,"QA "+i]);
      if (i < 2) await f.admin.query("INSERT INTO approved_emails VALUES($1)", [email]);
    }
    await assert.rejects(resetQaDepartment(f.admin, { participants: ["revoked0@example.test","revoked1@example.test","revoked2@example.test"], lead: "revoked0@example.test" }), /not approved/i);
  } finally { await f.close(); }
});


test("refuses to adopt an unrelated department that happens to have the QA name", async () => {
  const f = await coachingFixture();
  try {
    for (const i of [0, 1]) {
      const id = randomUUID();
      await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)", [id, "independent-" + i, `independent${i}@example.test`, `QA Person ${i}`]);
      await f.admin.query("INSERT INTO approved_emails VALUES($1)", [`independent${i}@example.test`]);
    }
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Lantern QA')", [randomUUID()]);
    await assert.rejects(resetQaDepartment(f.admin, { participants: ["independent0@example.test", "independent1@example.test", "independent2@example.test"], lead: "independent0@example.test" }), /ownership|unrelated/i);
    assert.equal((await f.admin.query("SELECT count(*)::int AS n FROM departments WHERE name='Lantern QA'")).rows[0].n, 1);
  } finally { await f.close(); }
});


test("provision two registered QA participants and preserve unrelated acceptance data", async () => {
  const f = await coachingFixture();
  try {
    const ids = [randomUUID(), randomUUID()];
    for (const [i, id] of ids.entries()) {
      await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)", [id, "qa-test-" + i, `qa${i}@example.test`, `QA Person ${i}`]);
      await f.admin.query("INSERT INTO approved_emails VALUES($1)", [`qa${i}@example.test`]);
      if (i === 1) await f.admin.query("INSERT INTO memberships(user_id,department_id,role) SELECT $1,department_id,'member' FROM memberships WHERE user_id=$2", [id, f.ids.member]);
    }
    await resetQaDepartment(f.admin, { participants: ["qa0@example.test", "qa1@example.test", "qa2@example.test"], lead: "qa0@example.test" });
    const members = await f.admin.query("SELECT u.name,m.role,d.name AS department FROM memberships m JOIN users u ON u.id=m.user_id JOIN departments d ON d.id=m.department_id WHERE u.id=ANY($1::uuid[]) ORDER BY u.name", [ids]);
    assert.deepEqual(members.rows, [
      { name: "QA Person 0", role: "career-lead", department: "Lantern QA" },
      { name: "QA Person 1", role: "member", department: "Lantern QA" },
    ]);
    assert.equal((await f.admin.query("SELECT count(*)::int AS n FROM memberships WHERE user_id=ANY($1::uuid[])", [Object.values(f.ids)])).rows[0].n, 4);
    assert.ok((await f.admin.query("SELECT count(*)::int AS n FROM position_focuses WHERE user_id=ANY($1::uuid[])", [ids])).rows[0].n > 0);
    const seeded = await f.admin.query("SELECT status FROM position_focuses WHERE user_id=ANY($1::uuid[]) ORDER BY status", [ids]);
    assert.deepEqual(seeded.rows.map((r) => r.status), ["confirmed", "draft", "draft", "draft"]);
    assert.ok((await f.admin.query("SELECT count(*)::int n FROM focus_review_notes")).rows[0].n > 0);
    await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 hour')", [hash("qa-lead"), ids[0]]);
    const underReview = (await f.admin.query("SELECT id FROM position_focuses WHERE user_id=$1 AND title='Ready for review'", [ids[1]])).rows[0].id;
    const response = await fetch(f.origin + "/api/coach/focuses/" + underReview, { headers: { Cookie: "lantern-session=qa-lead" } });
    assert.equal(response.status, 200);
    const record = await response.json() as { requests: unknown[]; notes: { body: string }[] };
    assert.equal(record.requests.length, 1);
    assert.match(record.notes[0]!.body, /discuss/);
    const original = await f.admin.query("SELECT id FROM position_focuses WHERE user_id=ANY($1::uuid[])", [ids]);
    await resetQaDepartment(f.admin, { participants: ["qa0@example.test", "qa1@example.test", "qa2@example.test"], lead: "qa1@example.test" });
    const changed = await f.admin.query("SELECT u.name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE u.id=ANY($1::uuid[]) ORDER BY u.name", [ids]);
    assert.deepEqual(changed.rows, [{ name: "QA Person 0", role: "member" }, { name: "QA Person 1", role: "career-lead" }]);
    assert.equal((await f.admin.query("SELECT count(*)::int AS n FROM position_focuses WHERE id=ANY($1::uuid[])", [original.rows.map((row) => row.id)])).rows[0].n, 0);
    await resetQaDepartment(f.admin, { participants: ["qa0@example.test", "qa1@example.test", "qa2@example.test"] });
    assert.equal((await f.admin.query("SELECT role FROM memberships WHERE user_id=$1", [ids[1]])).rows[0].role, "career-lead");
    const third = randomUUID();
    await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,'qa-test-2','qa2@example.test','QA Person 2')", [third]);
    await f.admin.query("INSERT INTO approved_emails VALUES('qa2@example.test')");
    await resetQaDepartment(f.admin, { participants: ["qa0@example.test", "qa1@example.test", "qa2@example.test"] });
    assert.equal((await f.admin.query("SELECT role FROM memberships WHERE user_id=$1", [third])).rows[0].role, "member");
    const request = (await f.admin.query("SELECT id FROM focus_review_requests LIMIT 1")).rows[0].id;
    await f.admin.query("INSERT INTO focus_review_notes(id,request_id,author_id,body) VALUES($1,$2,$3,'foreign')", [randomUUID(), request, f.ids.outsider]);
    await assert.rejects(resetQaDepartment(f.admin, { participants: ["qa0@example.test", "qa1@example.test", "qa2@example.test"] }), /unexpected note author/i);
    assert.equal((await f.admin.query("SELECT count(*)::int n FROM focus_review_notes WHERE author_id=$1", [f.ids.outsider])).rows[0].n, 1);
    await f.admin.query("DELETE FROM focus_review_notes WHERE author_id=$1", [f.ids.outsider]);
    const focus = (await f.admin.query("SELECT id FROM position_focuses WHERE department_id=(SELECT department_id FROM memberships WHERE user_id=$1) AND status='confirmed' LIMIT 1", [ids[0]])).rows[0].id;
    await f.admin.query("UPDATE position_focuses SET confirmed_by=$2 WHERE id=$1", [focus, f.ids.outsider]);
    await assert.rejects(resetQaDepartment(f.admin, { participants: ["qa0@example.test", "qa1@example.test", "qa2@example.test"] }), /unexpected confirm/i);
  } finally { await f.close(); }
});
