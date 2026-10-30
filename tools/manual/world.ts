import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "../../server/app.js";
import { hash } from "../../server/access.js";
import type { CoachProvider } from "../../server/coach-provider.js";
import type { IdentityProvider } from "../../server/google.js";
import { initiativeDefaults } from "../../server/local-initiatives.js";
import { privilegeFixture } from "../../server/privilege-test-support.js";
import { migrate } from "../../server/schema.js";
import type { DepartmentDirection } from "../../shared/direction.js";
import type { FocusDraft, PositionFocus } from "../../shared/focus.js";

/**
 * A deterministic, entirely synthetic Lantern used to photograph the manual.
 * Data is written through the public HTTP interface as each person, so the
 * screenshots show states the product can actually reach. Only timestamps are
 * pinned afterwards, because the server stamps them with the real clock.
 */
export const manualNow = "2026-11-02T10:00:00+13:00";
export const timezone = "Pacific/Auckland";

export const people = {
  member: { name: "Aroha Ngata", email: "aroha.ngata@example.test", department: "Engineering", role: "member" },
  peer: { name: "Sam Patel", email: "sam.patel@example.test", department: "Engineering", role: "member" },
  lead: { name: "Morgan Lee", email: "morgan.lee@example.test", department: "Engineering", role: "career-lead" },
  outsider: { name: "Riley Chen", email: "riley.chen@example.test", department: "Design", role: "career-lead" },
  newcomer: { name: "Casey Brown", email: "casey.brown@example.test", department: undefined, role: undefined },
} as const;
export type Persona = keyof typeof people;

export const mission =
  "Build dependable tools that help people everywhere encounter the story of Jesus in their own language.";

type Json = Record<string, any>;

/** Every suggestion stage accepts this one validated response. */
function fakeCoach(initiative: () => string): CoachProvider {
  return {
    async suggest(_system: string, _context: string, validate: (value: unknown) => any) {
      return validate({
        ready: true,
        objective:
          "Help engineers resolve failed deployments faster by turning recurring failures into clear, shared runbooks.",
        actions: ["Review the last ten failed deployments with the team", "Publish runbooks for the three most common causes"],
        suggestedDate: "2027-04-30",
        goal: "By 30 April 2027, publish runbooks for the three most common deployment failures and walk the team through each one.",
        initiativeIds: [initiative()],
        recommendedKind: "normal",
      });
    },
  } as CoachProvider;
}

const signInOnly: IdentityProvider = {
  authorizationUrl: () => "/?signInError=1",
  exchange: async () => {
    throw new Error("The manual never completes Google sign-in.");
  },
};

export interface ManualWorld {
  origin: string;
  /** Session cookie value for a persona, or undefined for a signed-out visitor. */
  session(persona: Persona | "anonymous"): string | undefined;
  ids: Record<Persona, string> & { draftFocus: string; reviewFocus: string; confirmedFocus: string };
  close(): Promise<void>;
}

/** Starts the synthetic world against a disposable local database and serves the given built client. */
export async function startWorld(clientDirectory: string): Promise<ManualWorld> {
  const fixture = await privilegeFixture();
  const server: Server = createServer();
  try {
    await migrate(fixture.migration, fixture.roles);
    const ids = Object.fromEntries(Object.keys(people).map((key) => [key, randomUUID()])) as Record<Persona, string>;
    const departments = { Engineering: randomUUID(), Design: randomUUID() };
    for (const [name, id] of Object.entries(departments))
      await fixture.admin.query("INSERT INTO departments(id,name) VALUES($1,$2)", [id, name]);
    for (const [key, person] of Object.entries(people) as [Persona, (typeof people)[Persona]][]) {
      await fixture.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)", [
        ids[key], "manual:" + key, person.email, person.name,
      ]);
      await fixture.admin.query("INSERT INTO approved_emails VALUES($1)", [person.email]);
      if (person.department)
        await fixture.admin.query("INSERT INTO memberships VALUES($1,$2,$3,NULL)", [
          ids[key], departments[person.department], person.role,
        ]);
      await fixture.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')", [hash(key), ids[key]]);
    }

    let firstInitiative = "";
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const app = createApp(fixture.runtime, { origin, provider: signInOnly, coach: fakeCoach(() => firstInitiative) });
    app.use(express.static(resolve(clientDirectory)));
    server.on("request", app);

    const call = async (persona: Persona, path: string, method = "GET", body?: unknown): Promise<Json> => {
      const response = await fetch(origin + path, {
        method,
        headers: { Origin: origin, Cookie: "lantern-session=" + persona, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`Seeding ${method} ${path} as ${persona} failed (${response.status}): ${text}`);
      return text ? JSON.parse(text) : {};
    };

    const direction = (await call("lead", "/api/department/direction", "PUT", {
      mission,
      version: 0,
      initiatives: initiativeDefaults.map((item) => ({ ...item, archived: false })),
    })) as DepartmentDirection;
    const initiative = (name: string) => {
      const found = direction.initiatives.find((item) => item.name === name);
      assert.ok(found, name);
      return { id: found.id };
    };
    firstInitiative = initiative("Rethink How We Build").id;

    const confirmedDraft: FocusDraft = {
      title: "Second half 2026",
      start: "2026-07-01",
      end: "2026-12-31",
      sections: [
        {
          kind: "normal",
          objective: "Make releases predictable by owning the staging pipeline and its documentation.",
          goals: [
            "By 30 September 2026, document every manual staging step and remove two of them.",
            "By 15 December 2026, run three releases end to end with no manual fixes.",
          ],
          alignment: { initiatives: [initiative("Rethink How We Build")], other: false },
        },
        {
          kind: "personal-development",
          objective: "Grow confidence leading technical discussions.",
          goals: ["By 30 November 2026, facilitate two design reviews and ask for written feedback."],
          alignment: { initiatives: [initiative("Role Clarity And Growth")], other: false },
        },
      ],
    };
    const confirmed = (await call("member", "/api/focuses", "POST", confirmedDraft)) as PositionFocus;
    const confirmedPath = "/api/coach/focuses/" + confirmed.id;
    await call("member", confirmedPath + "/request", "POST", { version: confirmed.version, note: "Ready for our check-in on Thursday." });
    await call("lead", confirmedPath + "/notes", "POST", { version: confirmed.version, body: "This reads well. The release goal is clear and measurable." });
    await call("member", confirmedPath + "/notes", "POST", { version: confirmed.version, body: "Thanks — I'll share the runbook draft next week." });
    await call("lead", confirmedPath + "/confirm", "POST", { version: confirmed.version });

    const draft = (await call("member", "/api/focuses", "POST", {
      title: "First half 2027",
      start: "2027-01-01",
      end: "2027-06-30",
      sections: [
        {
          kind: "normal",
          objective: "Help engineers ship safely by making deployment failures quick to understand and fix.",
          goals: [
            "By 28 February 2027, add a failure summary to every staging deployment report.",
            "By 30 May 2027, reduce the median time to fix a failed deployment to under one hour.",
          ],
          alignment: { initiatives: [initiative("Rethink How We Build"), initiative("Love What We Build")], other: false },
        },
        {
          kind: "personal-development",
          objective: "Build my skills in accessible interface design.",
          goals: ["By 31 March 2027, complete an accessibility course and audit one Lantern screen with a designer."],
          alignment: { initiatives: [initiative("Role Clarity And Growth")], other: false },
        },
        {
          kind: "leadership",
          objective: "Help new engineers feel at home in their first month.",
          goals: ["By 30 June 2027, pair with each new starter for one afternoon in their first two weeks."],
          alignment: { initiatives: [initiative("Team Connectedness")], other: false },
        },
      ],
    } satisfies FocusDraft)) as PositionFocus;

    const review = (await call("peer", "/api/focuses", "POST", {
      title: "Sam's 2027 focus",
      start: "2027-01-01",
      end: "2027-06-30",
      sections: [
        {
          kind: "normal",
          objective: "Make the video catalogue search faster for people on slow connections.",
          goals: ["By 31 March 2027, halve the search response size on mobile."],
          alignment: { initiatives: [initiative("Love What We Build")], other: false },
        },
      ],
    } satisfies FocusDraft)) as PositionFocus;
    const reviewPath = "/api/coach/focuses/" + review.id;
    await call("peer", reviewPath + "/request", "POST", { version: review.version, note: "First draft — keen to hear your thoughts." });
    await call("lead", reviewPath + "/notes", "POST", { version: review.version, body: "Could the goal say how you will measure the mobile improvement?" });
    const revised = (await call("peer", "/api/focuses/" + review.id, "PUT", {
      version: review.version,
      title: "Sam's 2027 focus",
      start: "2027-01-01",
      end: "2027-06-30",
      sections: [
        {
          kind: "normal",
          objective: "Make the video catalogue search faster for people on slow connections.",
          goals: [
            "By 31 March 2027, halve the median search response size on mobile, measured in the weekly performance report.",
            "By 30 June 2027, keep search under two seconds on a simulated 3G connection.",
          ],
          alignment: { initiatives: [initiative("Love What We Build")], other: false },
        },
      ],
    })) as PositionFocus;
    await call("peer", reviewPath + "/request", "POST", { version: revised.version, note: "Updated the goals with measures." });

    await pinTimestamps(fixture.bootstrap);
    return {
      origin,
      session: (persona) => (persona === "anonymous" ? undefined : persona),
      ids: { ...ids, draftFocus: draft.id, reviewFocus: review.id, confirmedFocus: confirmed.id },
      async close() {
        server.closeAllConnections();
        await new Promise<void>((done) => server.close(() => done()));
        await fixture.close();
      },
    };
  } catch (error) {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((done) => server.close(() => done()));
    await fixture.close();
    throw error;
  }
}

/** Replace wall-clock stamps with fixed, ordered times a few days before manualNow. */
async function pinTimestamps(pool: import("pg").Pool) {
  const base = "2026-10-27T09:00:00+13:00";
  const owner = await pool.connect();
  await owner.query("SET session_replication_role = replica");
  try {
    for (const [table, column] of [
      ["lantern.focus_review_requests", "created_at"],
      ["lantern.focus_review_notes", "created_at"],
    ])
      await owner.query(
        `UPDATE ${table} t SET ${column} = $1::timestamptz + (o.n * interval '47 minutes')
         FROM (SELECT id, row_number() OVER (ORDER BY ${column}, id) AS n FROM ${table}) o WHERE o.id = t.id`,
        [base],
      );
    await owner.query(
      `UPDATE lantern.position_focuses f SET updated_at = $1::timestamptz + (o.n * interval '53 minutes')
       FROM (SELECT id, row_number() OVER (ORDER BY updated_at, id) AS n FROM lantern.position_focuses) o WHERE o.id = f.id`,
      [base],
    );
    await owner.query("UPDATE lantern.position_focuses SET confirmed_at = '2026-10-29T15:30:00+13:00' WHERE confirmed_at IS NOT NULL");
  } finally {
    await owner.query("SET session_replication_role = DEFAULT");
    owner.release();
  }
}

