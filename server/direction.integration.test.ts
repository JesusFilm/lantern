import sharp from "sharp";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { privilegeFixture } from "./privilege-test-support.js";
import { migrate, assertSchemaReady } from "./schema.js";
import { createApp } from "./app.js";
import { hash } from "./access.js";
import type { DepartmentDirection } from "../shared/direction.js";
import type { PositionFocus } from "../shared/focus.js";

const approvedDescriptions = [
  {
    "name": "Love What We Build",
    "description": "Understand who our work serves, why it matters to the mission, and whether it helps. This initiative connects meaningful ownership with access to the people and evidence needed to shape solutions. It includes understanding user needs, clarifying decisions we own, and using feedback after delivery to improve what we build and guide what happens next."
  },
  {
    "name": "Rethink How We Build",
    "description": "Improve how we move from an identified need to a validated outcome as AI changes the way we work. This includes stronger problem framing, effective use of agents, quality and validation throughout development, and shared tools and practices that help the whole team. Human judgment and responsibility remain central as we experiment, evaluate results and share useful capabilities."
  },
  {
    "name": "Role Clarity and Growth",
    "description": "Connect the team’s strategy to each person’s contribution, desired results and personal development. This initiative helps people understand their responsibilities, how their strengths complement others, and the capabilities they need to develop. Position Focus makes that connection practical over roughly six months, with support from the Career Leader and relevant managers, adapting as priorities change."
  },
  {
    "name": "Team Connectedness",
    "description": "Build a team where people know one another, understand what others are working on, and can find help and offer support. This includes sharing work and learning through Show and Tell, making space for relationships beyond delivery, and giving people regular opportunities to raise feedback. Visible responses and follow-through help that feedback improve our experience of working together."
  }
];

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
      assert.deepEqual(await initial.json(), { mission: "", missionImage: "/mission-jesus-geometric.png", initiatives: [], version: 0 });
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
      assert.deepEqual(await (await request(outsider)).json(), { mission: "", missionImage: "/mission-jesus-geometric.png", initiatives: [], version: 0 });
    });

    await t.test("mission artwork persists atomically, is isolated and rejects invalid uploads", async () => {
      const before = await (await request(lead)).json() as DepartmentDirection;
      const png = await sharp({ create: { width: 1600, height: 400, channels: 4, background: "#007e95" } }).png().toBuffer();
      const missionImage = `data:image/png;base64,${png.toString("base64")}`;
      const response = await request(lead, undefined, "PUT", { ...before, missionImage });
      assert.equal(response.status, 200);
      const saved = await response.json() as DepartmentDirection;
      assert.equal(typeof saved.missionImage, "string");
      assert.match(saved.missionImage!, /^data:image\/webp;base64,/);
      const metadata = await sharp(Buffer.from(saved.missionImage!.split(",")[1]!, "base64")).metadata();
      assert.equal(metadata.width, 1280); assert.equal(metadata.height, 320);
      server.removeAllListeners("request"); server.on("request", createApp(f.runtime, { origin }));
      assert.deepEqual(await (await request(member)).json(), saved);
      assert.notEqual(((await (await request(outsider)).json()) as DepartmentDirection).missionImage, saved.missionImage);
      assert.equal((await request(member, undefined, "PUT", { ...saved, missionImage: null })).status, 403);
      assert.equal((await request(lead, undefined, "PUT", { ...before, missionImage: null })).status, 409);
      for (const invalid of ["https://example.test/image.png", "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,YmFk", missionImage.replace("image/png", "image/jpeg"), 4,
        `data:image/png;base64,${Buffer.alloc(513 * 1024).toString("base64")}`]) {
        assert.equal((await request(lead, undefined, "PUT", { ...saved, mission: "Must not save", missionImage: invalid })).status, 400);
      }
      assert.deepEqual(await (await request(lead)).json(), saved);
      // Older clients that omit the image must preserve the saved image.
      const { missionImage: ignored, ...legacy } = saved;
      const retained = await (await request(lead, undefined, "PUT", legacy)).json() as DepartmentDirection;
      assert.equal(retained.missionImage, saved.missionImage);
      const removed = await (await request(lead, undefined, "PUT", { ...retained, missionImage: null })).json() as DepartmentDirection;
      assert.equal(removed.missionImage, null);
      const reset = await (await request(lead, undefined, "PUT", { ...removed, missionImage: "/mission-jesus-geometric.png" })).json() as DepartmentDirection;
      assert.equal(reset.missionImage, "/mission-jesus-geometric.png");
    });

    await t.test("initiative descriptions persist as optional department guidance with atomic validation", async () => {
      const before = await (await request(lead)).json() as DepartmentDirection;
      const payload = { ...before, initiatives: before.initiatives.map((item, i) => ({ ...item,
        ...(i === 0 ? { description: "  Help people discover media in their heart language.  " } : {}),
      })) };
      const response = await request(lead, undefined, "PUT", payload);
      assert.equal(response.status, 200);
      const saved = await response.json() as DepartmentDirection;
      assert.equal(saved.initiatives[0]!.description, "Help people discover media in their heart language.");
      assert.equal(saved.initiatives[1]!.description, undefined);
      server.removeAllListeners("request");
      server.on("request", createApp(f.runtime, { origin }));
      assert.deepEqual(await (await request(member)).json(), saved);
      assert.deepEqual(((await (await request(outsider)).json()) as DepartmentDirection).initiatives, []);
      assert.equal((await request(member, undefined, "PUT", saved)).status, 403);
      for (const description of ["x".repeat(501), null, 3, {}, []]) {
        const invalid = await request(lead, undefined, "PUT", { ...saved,
          initiatives: saved.initiatives.map((item, i) => i === 0 ? { ...item, description } : item),
        });
        assert.equal(invalid.status, 400);
        assert.match(((await invalid.json()) as { error: string }).error, /description/i);
        assert.deepEqual(await (await request(member)).json(), saved);
      }
      const maximum = await request(lead, undefined, "PUT", { ...saved,
        initiatives: saved.initiatives.map((item, i) => i === 0 ? { ...item, description: "x".repeat(500) } : item),
      });
      assert.equal(maximum.status, 200);
      const current = await maximum.json() as DepartmentDirection;
      assert.equal(current.initiatives[0]!.description?.length, 500);
      assert.equal((await request(lead, undefined, "PUT", saved)).status, 409);
      assert.deepEqual(await (await request(member)).json(), current);
      const cleared = await request(lead, undefined, "PUT", { ...current,
        initiatives: current.initiatives.map(item => ({ ...item, description: "   " })),
      });
      assert.equal(cleared.status, 200);
      assert.equal(((await cleared.json()) as DepartmentDirection).initiatives[0]!.description, "");
    });

    await t.test("initiative appearance persists for the department and is validated atomically", async () => {
      const before = await (await request(lead)).json() as DepartmentDirection;
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12 L12 4 L20 12 Z" fill="currentColor"/></svg>';
      const payload = { ...before, initiatives: before.initiatives.map((item, index) => ({
        ...item, appearance: index === 0 ? { icon: "globe", color: "#d13d46" } : { icon: "handshake", color: "#e4bf24" },
      })) };
      const response = await request(lead, undefined, "PUT", payload);
      assert.equal(response.status, 200);
      const saved = await response.json() as DepartmentDirection;
      assert.deepEqual(saved.initiatives[0]!.appearance, { icon: "globe", color: "#d13d46" });
      assert.deepEqual(saved.initiatives[1]!.appearance, { icon: "handshake", color: "#e4bf24" });
      assert.deepEqual(await (await request(member)).json(), saved);
      assert.deepEqual(((await (await request(outsider)).json()) as DepartmentDirection).initiatives, []);
      for (const appearance of [
        { svg, color: "#8560bb" }, { icon: "heart", color: "#123456" },
        { icon: "unknown", color: "#b43e65" }, { icon: "heart", color: "red;display:none" },
        { icon: "heart", svg, color: "#b43e65" },
        { svg: '<svg viewBox="0 0 24 24" onload="alert(1)"/>', color: "#b43e65" },
        { svg: '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>', color: "#b43e65" },
        { svg: '<svg viewBox="0 0 24 24"><image href="https://example.test/track"/></svg>', color: "#b43e65" },
        { svg: '<!DOCTYPE svg [<!ENTITY x "boom">]><svg viewBox="0 0 24 24">&x;</svg>', color: "#b43e65" },
        { svg: '<svg viewBox="0 0 24 24"><path fill="url(https://example.test/track)"/></svg>', color: "#b43e65" },
        { svg: '<svg viewBox="0 0 24 24"><foreignObject>hello</foreignObject></svg>', color: "#b43e65" },
        { svg: '<svg viewBox="0 0 24 24"><path></svg>', color: "#b43e65" },
        { svg: "x".repeat(25000), color: "#b43e65" },
      ]) {
        assert.equal((await request(lead, undefined, "PUT", { ...saved, initiatives: [
          { ...saved.initiatives[0], appearance }, saved.initiatives[1],
        ] })).status, 400);
      }
      assert.equal((await request(member, undefined, "PUT", saved)).status, 403);
      assert.deepEqual(await (await request(lead)).json(), saved);
      // Preserve the legacy fixture for the independent alignment regression below.
      assert.equal((await request(lead, undefined, "PUT", { ...before, version: saved.version })).status, 200);
    });

    await t.test("legacy custom appearances remain readable and retainable but cannot be changed to another custom value", async () => {
      const before = await (await request(lead)).json() as DepartmentDirection;
      const legacyAppearance = { color: "#123456", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>' };
      // Fixture for data saved before editing was restricted to presets.
      await f.admin.query("UPDATE department_direction SET initiatives=$1,version=version+1 WHERE department_id=$2",
        [JSON.stringify(before.initiatives.map((item, index) => index === 0 ? { ...item, appearance: legacyAppearance } : item)), team]);
      const legacy = await (await request(lead)).json() as DepartmentDirection;
      assert.deepEqual(legacy.initiatives[0]!.appearance, legacyAppearance);
      const retained = await request(lead, undefined, "PUT", { ...legacy, mission: "Updated mission" });
      assert.equal(retained.status, 200);
      const saved = await retained.json() as DepartmentDirection;
      assert.deepEqual(saved.initiatives[0]!.appearance, legacyAppearance);
      const changed = { ...saved, initiatives: saved.initiatives.map((item, index) => index === 0 ?
        { ...item, appearance: { ...legacyAppearance, color: "#abcdef" } } : item) };
      assert.equal((await request(lead, undefined, "PUT", changed)).status, 400);
      assert.deepEqual(await (await request(member)).json(), saved);
      assert.equal((await request(lead, undefined, "PUT", { ...before, version: saved.version })).status, 200);
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
      direction.initiatives[1]!.description = "Updated guidance must not change confirmed history.";
      assert.equal((await request(lead, undefined, "PUT", direction)).status, 200);
      reopened = await (await request(member, path)).json() as PositionFocus;
      assert.equal(reopened.sections[0]!.alignment!.initiatives[1]!.name, "Partner pathways");
      assert.deepEqual(reopened, focus);
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

    await t.test("objective appearance comes from department configuration and survives confirmation and later edits", async () => {
      let direction = await (await request(lead)).json() as DepartmentDirection;
      direction.initiatives[1]!.appearance = { icon: "sprout", color: "#267c65" };
      direction = await (await request(lead, undefined, "PUT", direction)).json() as DepartmentDirection;
      const choice = direction.initiatives[1]!;
      const draft = { title: "Visual alignment", start: "2026-01-01", end: "2026-12-31",
        sections: [{ kind: "normal", objective: "Grow capability", goals: ["Finish a guide by June"],
          alignment: { other: false, initiatives: [{ id: choice.id, name: "Forged",
            appearance: { icon: "flag", color: "#000000" } }] } }] };
      const created = await request(member, "/api/focuses", "POST", draft);
      assert.equal(created.status, 201);
      let focus = await created.json() as PositionFocus;
      assert.deepEqual(focus.sections[0]!.alignment!.initiatives[0]!.appearance, { icon: "sprout", color: "#267c65" });
      const confirmed = await request(lead, `/api/department/members/${member}/focuses/${focus.id}/confirm`, "POST", { version: focus.version });
      assert.equal(confirmed.status, 200); focus = await confirmed.json() as PositionFocus;
      direction.initiatives[1]!.appearance = { icon: "heart", color: "#d13d46" };
      direction.initiatives[1]!.archived = true;
      assert.equal((await request(lead, undefined, "PUT", direction)).status, 200);
      const reopened = await (await request(member, `/api/focuses/${focus.id}`)).json() as PositionFocus;
      assert.deepEqual(reopened.sections, focus.sections);
      const leadView = await (await request(lead, `/api/department/members/${member}/focuses/${focus.id}`)).json() as { focus: PositionFocus };
      assert.deepEqual(leadView.focus.sections, focus.sections);
    });

    await t.test("members save ID-only choices and receive trusted snapshots on create and update", async () => {
      const before = await (await request(lead)).json() as DepartmentDirection;
      const configured = await request(lead, undefined, "PUT", { ...before, initiatives: [...before.initiatives,
        { name: "ID-only selection", archived: false, appearance: { icon: "heart", color: "#d13d46" } }] });
      assert.equal(configured.status, 200);
      const direction = await configured.json() as DepartmentDirection;
      const choice = direction.initiatives.at(-1)!;
      const draft = { title: "Member intent", start: "2026-01-01", end: "2026-12-31", sections: [
        { kind: "normal", objective: "Choose by identity", goals: ["Deliver by June"], alignment: { other: false, initiatives: [{ id: choice.id }] } },
      ] };
      const created = await request(member, "/api/focuses", "POST", draft);
      assert.equal(created.status, 201);
      let focus = await created.json() as PositionFocus;
      const expected = { id: choice.id, name: "ID-only selection", appearance: { icon: "heart", color: "#d13d46" } };
      assert.deepEqual(focus.sections[0]!.alignment!.initiatives, [expected]);
      const path = `/api/focuses/${focus.id}`;
      const updated = await request(member, path, "PUT", { ...draft, title: "Edited intent", version: focus.version });
      assert.equal(updated.status, 200);
      focus = await updated.json() as PositionFocus;
      assert.deepEqual(focus.sections[0]!.alignment!.initiatives, [expected]);
      for (const initiatives of [
        [{ id: choice.id }, { id: choice.id }], [{ id: "invalid" }], [{ id: randomUUID() }],
        [{ id: choice.id, name: "" }], [{ id: choice.id, appearance: { icon: "unknown" } }],
      ]) {
        assert.equal((await request(member, path, "PUT", { ...draft, version: focus.version,
          sections: [{ ...draft.sections[0], alignment: { other: false, initiatives } }] })).status, 400);
      }
      assert.equal((await request(outsider, "/api/focuses", "POST", draft)).status, 400);
      assert.deepEqual(await (await request(member, path)).json(), focus);
    });

    await t.test("draft saves retain archived identity across objectives and refresh active identity", async () => {
      let direction = await (await request(lead)).json() as DepartmentDirection;
      const configured = await request(lead, undefined, "PUT", { ...direction, initiatives: [
        ...direction.initiatives,
        { name: "Historical identity", archived: false, appearance: { icon: "heart", color: "#d13d46" } },
        { name: "Active identity", archived: false, appearance: { icon: "sprout", color: "#267c65" } },
      ] });
      assert.equal(configured.status, 200);
      direction = await configured.json() as DepartmentDirection;
      const archived = direction.initiatives.at(-2)!, active = direction.initiatives.at(-1)!;
      const draft = { title: "Retained identities", start: "2026-01-01", end: "2026-12-31", sections: [
        { kind: "normal", objective: "Original objective", goals: [], alignment: { other: false, initiatives: [archived, active].map(({ id, name }) => ({ id, name })) } },
      ] };
      const created = await request(member, "/api/focuses", "POST", draft);
      assert.equal(created.status, 201);
      let focus = await created.json() as PositionFocus;
      const historical = focus.sections[0]!.alignment!.initiatives[0]!;
      const changed = await request(lead, undefined, "PUT", { ...direction, initiatives: direction.initiatives.map(item =>
        item.id === archived.id ? { ...item, archived: true, name: "Archived rename", appearance: { icon: "flag", color: "#8560bb" } } :
        item.id === active.id ? { ...item, name: "Current identity", appearance: { icon: "globe", color: "#e4bf24" } } : item) });
      assert.equal(changed.status, 200);
      const path = `/api/focuses/${focus.id}`;
      const moved = { ...draft, sections: [
        { kind: "normal", objective: "Replacement objective", goals: [], alignment: { other: false, initiatives: [{ id: archived.id, name: "Forged", appearance: { icon: "flag", color: "#000000" } }] } },
        { ...draft.sections[0]!, alignment: { other: false, initiatives: [{ id: active.id, name: "Stale label" }] } },
      ] };
      const saved = await request(member, path, "PUT", { ...moved, version: focus.version });
      assert.equal(saved.status, 200);
      focus = await saved.json() as PositionFocus;
      assert.deepEqual(focus.sections[0]!.alignment!.initiatives, [historical]);
      assert.deepEqual(focus.sections[1]!.alignment!.initiatives, [{ id: active.id, name: "Current identity", appearance: { icon: "globe", color: "#e4bf24" } }]);
      assert.deepEqual(await (await request(member, path)).json(), focus);
      const extra = await request(member, path, "PUT", { ...moved, version: focus.version, sections: [...moved.sections, moved.sections[0]] });
      assert.equal(extra.status, 400);
      assert.deepEqual(await (await request(member, path)).json(), focus);
    });

    await t.test("archive and focus saves serialize without introducing archived references", async () => {
      for (const first of ["archive", "save"]) {
        const before = await (await request(lead)).json() as DepartmentDirection;
        const configured = await request(lead, undefined, "PUT", { ...before, initiatives: [...before.initiatives,
          { name: `Concurrent ${first}`, archived: false, appearance: { icon: "heart", color: "#d13d46" } }] });
        assert.equal(configured.status, 200);
        const direction = await configured.json() as DepartmentDirection;
        const choice = direction.initiatives.at(-1)!;
        const draft = { title: `Concurrent ${first}`, start: "2026-01-01", end: "2026-12-31", sections: [] };
        const created = await request(member, "/api/focuses", "POST", draft);
        assert.equal(created.status, 201);
        const focus = await created.json() as PositionFocus;
        const path = `/api/focuses/${focus.id}`;
        const save = () => request(member, path, "PUT", { ...draft, version: focus.version, sections: [
          { kind: "normal", objective: "New alignment", goals: [], alignment: { other: false, initiatives: [{ id: choice.id }] } },
        ] });
        const archive = () => request(lead, undefined, "PUT", { ...direction, initiatives: direction.initiatives.map(item =>
          item.id === choice.id ? { ...item, archived: true, name: "Archived during save", appearance: { icon: "flag", color: "#8560bb" } } : item) });
        // Hold the real shared transaction lock until both HTTP writes are queued.
        // This makes both orderings deterministic without substituting storage.
        const blocker = await f.admin.connect();
        const pending: Array<Promise<Response>> = [];
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT pg_advisory_xact_lock(603106)");
          const waitForWriters = async (count: number) => {
            for (let attempt = 0; attempt < 200; attempt++) {
              const locks = await f.admin.query(`SELECT count(*)::int AS count FROM pg_locks
                WHERE locktype='advisory' AND objid=603106 AND NOT granted
                AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`);
              if (locks.rows[0].count === count) return;
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            assert.fail("HTTP writes did not queue on the shared transaction lock");
          };
          pending.push(first === "archive" ? archive() : save());
          await waitForWriters(1);
          pending.push(first === "archive" ? save() : archive());
          await waitForWriters(2);
        } finally {
          await blocker.query("ROLLBACK");
          blocker.release();
        }
        const results = await Promise.all(pending);
        const archiveResult = results[first === "archive" ? 0 : 1]!;
        const saveResult = results[first === "save" ? 0 : 1]!;
        assert.equal(archiveResult.status, 200);
        assert.equal(saveResult.status, first === "archive" ? 400 : 200);
        const reopened = await (await request(member, path)).json() as PositionFocus;
        if (first === "archive") assert.deepEqual(reopened, focus);
        else {
          assert.equal(reopened.version, focus.version + 1);
          assert.deepEqual(reopened.sections[0]!.alignment!.initiatives, [{ id: choice.id, name: `Concurrent ${first}`, appearance: { icon: "heart", color: "#d13d46" } }]);
        }
      }
    });

    await t.test("failed and concurrent configuration saves cannot partially replace the mission or initiatives", async () => {
      const before = await (await request(lead)).json() as DepartmentDirection;
      await f.migration.query("ALTER TABLE department_direction ADD CONSTRAINT synthetic_direction_failure CHECK (mission <> 'Fail this write')");
      const failed = await request(lead, undefined, "PUT", { ...before, mission: "Fail this write", missionImage: null,
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

    await t.test("operator SQL adds missing identities once and preserves existing IDs, mission and archive status", async () => {
      const sql = await readFile(new URL("../tools/database/seed-initiative-appearance.sql", import.meta.url), "utf8");
      const untouched = await (await request(lead)).json();
      const response = await request(outsider, undefined, "PUT", { mission: "Keep this mission", version: 0,
        initiatives: [{ name: " love what we build ", archived: true }, { name: "Unrelated", archived: false }] });
      assert.equal(response.status, 200);
      const before = await response.json() as DepartmentDirection;
      const run = async (department: string) => {
        const client = await f.admin.connect();
        try { await client.query(sql.replace("REPLACE_WITH_DEPARTMENT_UUID", department)); }
        catch (error) { await client.query("ROLLBACK"); throw error; }
        finally { client.release(); }
      };
      await run(otherTeam);
      const seeded = await (await request(outsider)).json() as DepartmentDirection;
      assert.equal(seeded.mission, "Keep this mission");
      assert.equal(seeded.initiatives.length, 5);
      assert.equal(seeded.initiatives[0]!.id, before.initiatives[0]!.id);
      assert.equal(seeded.initiatives[0]!.archived, true);
      assert.deepEqual(seeded.initiatives[0]!.appearance, { icon: "heart", color: "#c74998" });
      assert.deepEqual(seeded.initiatives[1], before.initiatives[1]);
      for (const expected of approvedDescriptions) {
        assert.equal(seeded.initiatives.find(item => item.name.trim().toLowerCase() === expected.name.toLowerCase())?.description, expected.description);
      }
      assert.deepEqual(seeded.initiatives.slice(2).map(item => [item.name, item.appearance]), [
        ["Rethink How We Build", { icon: "lightbulb", color: "#3276b0" }],
        ["Role Clarity And Growth", { icon: "sprout", color: "#267c65" }],
        ["Team Connectedness", { icon: "users", color: "#e4bf24" }],
      ]);
      await run(otherTeam);
      assert.deepEqual(await (await request(outsider)).json(), seeded);
      await assert.rejects(run(randomUUID()), /active department/i);
      assert.deepEqual(await (await request(lead)).json(), untouched);
    });
    await t.test("description-only SQL updates exactly one department, preserves identities and is safe to repeat", async () => {
      const sql = await readFile(new URL("../tools/database/update-initiative-descriptions.sql", import.meta.url), "utf8");
      const untouched = await (await request(lead)).json() as DepartmentDirection;
      const existing = await (await request(outsider)).json() as DepartmentDirection;
      const changed = await request(outsider, undefined, "PUT", { ...existing,
        initiatives: existing.initiatives.map(item => ({ ...item, description: "Keep until explicitly replaced.",
          appearance: { icon: "flag", color: "#3276b0" } })),
      });
      assert.equal(changed.status, 200);
      const before = await changed.json() as DepartmentDirection;
      const run = async (department: string) => {
        const client = await f.admin.connect();
        try { await client.query(sql.replace("REPLACE_WITH_DEPARTMENT_UUID", department)); }
        catch (error) { await client.query("ROLLBACK"); throw error; }
        finally { client.release(); }
      };
      await run(otherTeam);
      const updated = await (await request(outsider)).json() as DepartmentDirection;
      assert.equal(updated.version, before.version + 1);
      assert.equal(updated.mission, before.mission);
      assert.deepEqual(updated.initiatives, before.initiatives.map(item => {
        const match = approvedDescriptions.find(expected => expected.name.toLowerCase() === item.name.trim().toLowerCase());
        return match ? { ...item, description: match.description } : item;
      }));
      await run(otherTeam);
      assert.deepEqual(await (await request(outsider)).json(), updated);
      assert.equal((await request(outsider, undefined, "PUT", before)).status, 409);
      // Seed output and manual updates must both remain editable through the application.
      const resaved = await request(outsider, undefined, "PUT", updated);
      assert.equal(resaved.status, 200);
      const valid = await resaved.json() as DepartmentDirection;
      await assert.rejects(run(randomUUID()), /active department/i);
      const missingResponse = await request(outsider, undefined, "PUT", { ...valid,
        initiatives: valid.initiatives.map((item, i) => i === 0 ? { ...item, name: "Renamed initiative" } : item),
      });
      assert.equal(missingResponse.status, 200);
      const missing = await missingResponse.json() as DepartmentDirection;
      await assert.rejects(run(otherTeam), /exactly one.*Love What We Build/i);
      assert.deepEqual(await (await request(outsider)).json(), missing);
      const duplicatedResponse = await request(outsider, undefined, "PUT", { ...valid, version: missing.version,
        initiatives: [...valid.initiatives, { name: "LOVE WHAT WE BUILD", archived: true }],
      });
      assert.equal(duplicatedResponse.status, 200);
      const duplicated = await duplicatedResponse.json() as DepartmentDirection;
      await assert.rejects(run(otherTeam), /exactly one.*Love What We Build/i);
      assert.deepEqual(await (await request(outsider)).json(), duplicated);
      assert.deepEqual(await (await request(lead)).json(), untouched);
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
    await f.migration.query("DELETE FROM schema_migrations WHERE version IN (7,8)");
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
    assert.deepEqual(await (await fetch(origin + "/api/department/direction")).json(), { mission: "", missionImage: "/mission-jesus-geometric.png", initiatives: [], version: 0 });
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

test("schema 7 upgrade preserves existing direction and adds the default artwork", async () => {
  const f = await privilegeFixture();
  const server = createServer();
  try {
    await migrate(f.migration, f.roles);
    const user = randomUUID(), department = randomUUID();
    await f.admin.query("INSERT INTO users VALUES($1::uuid,$1::text,'upgrade@example.test','Lead')", [user]);
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Upgrade team')", [department]);
    await f.admin.query("INSERT INTO memberships VALUES($1,$2,'career-lead',NULL)", [user, department]);
    await f.admin.query("INSERT INTO department_direction(department_id,mission,version) VALUES($1,'Keep this mission',3)", [department]);
    await f.migration.query("ALTER TABLE department_direction DROP COLUMN mission_image");
    await f.migration.query("DELETE FROM schema_migrations WHERE version=8");
    await assert.rejects(assertSchemaReady(f.runtime));
    await migrate(f.migration, f.roles);
    await migrate(f.migration, f.roles);
    await assertSchemaReady(f.runtime);
    await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    server.on("request", createApp(f.runtime, { origin, localUserId: user }));
    const direction = await (await fetch(origin + "/api/department/direction")).json() as DepartmentDirection;
    assert.deepEqual(direction, { mission: "Keep this mission", initiatives: [], version: 3, missionImage: "/mission-jesus-geometric.png" });
    // The previous deployed application's SQL remains valid during migration-before-deploy.
    await f.runtime.query("UPDATE department_direction SET mission='Older app edit',version=version+1 WHERE department_id=$1", [department]);
    assert.equal(((await (await fetch(origin + "/api/department/direction")).json()) as DepartmentDirection).missionImage, "/mission-jesus-geometric.png");
  } finally {
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await f.close();
  }
});
