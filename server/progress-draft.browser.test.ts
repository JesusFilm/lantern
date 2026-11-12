import {resolveFeatureConfig} from './features.js';
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { privilegeFixture } from "./privilege-test-support.js";
import { migrate } from "./schema.js";
import { createApp } from "./app.js";
import { hash } from "./access.js";
import type { PositionFocus } from "../shared/focus.js";

test("confirmed focus status badges do not appear on earlier-draft review snapshots", { timeout: 60000 }, async () => {
  const f = await privilegeFixture();
  const server = createServer();
  const browser = await chromium.launch();
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  try {
    await migrate(f.migration, f.roles);
    const lead = randomUUID(), member = randomUUID(), team = randomUUID();
    await f.admin.query("INSERT INTO departments(id,name) VALUES($1,'Team')", [team]);
    for (const [id, name, role] of [[lead, "Lead", "career-lead"], [member, "Member", "member"]]) {
      await f.admin.query("INSERT INTO users(id,google_sub,email,name) VALUES($1::uuid,$1::text,$2,$3)", [id, `${id}@example.test`, name]);
      await f.admin.query("INSERT INTO approved_emails VALUES($1)", [`${id}@example.test`]);
      await f.admin.query("INSERT INTO memberships VALUES($1,$2,$3,NULL)", [id, team, role]);
      await f.admin.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')", [hash(id!), id]);
    }
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const app = createApp(f.runtime, { origin, features: resolveFeatureConfig({}, 'local') });
    vite = await createViteServer({ server: { middlewareMode: { server }, hmr: { server } }, appType: "spa" });
    app.use(vite.middlewares);
    server.on("request", app);
    const memberContext = await browser.newContext(), leadContext = await browser.newContext();
    await memberContext.addCookies([{ name: "lantern-session", value: member, url: origin }]);
    await leadContext.addCookies([{ name: "lantern-session", value: lead, url: origin }]);
    const page = await memberContext.newPage(), leadPage = await leadContext.newPage();
    page.setDefaultTimeout(8000);
    leadPage.setDefaultTimeout(8000);
    // Request review of draft 1, then reorder the goals before sending draft 2.
    const created = await memberContext.request.post(origin + "/api/focuses", {
      headers: { Origin: origin },
      data: { title: "Annual focus", start: "2026-01-01", end: "2026-12-31", sections: [{ kind: "normal", objective: "Help onboarding", goals: ["Publish a guide", "Run two sessions"] }] },
    });
    assert.equal(created.status(), 201);
    const focus = (await created.json()) as PositionFocus;
    await page.goto(origin + "/?page=focuses&focus=" + focus.id);
    await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
    await page.getByRole("button", { name: "Send request", exact: true }).click();
    await expect(page.getByRole("button", { name: "Send request", exact: true })).toHaveCount(0);
    // The lead replies on draft 1, so the confirmed view keeps that note in history.
    const noted = await leadContext.request.post(origin + "/api/coach/focuses/" + focus.id + "/notes", {
      headers: { Origin: origin },
      data: { version: 1, body: "Good start — how will you measure the sessions?" },
    });
    assert.equal(noted.status(), 200);
    const updated = await memberContext.request.put(origin + "/api/focuses/" + focus.id, {
      headers: { Origin: origin },
      data: { title: "Annual focus", start: "2026-01-01", end: "2026-12-31", sections: [{ kind: "normal", objective: "Help onboarding", goals: ["Run two sessions", "Publish a guide"] }], version: 1 },
    });
    assert.equal(updated.status(), 200);
    await page.reload();
    await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
    await page.getByRole("button", { name: "Send changes for review", exact: true }).click();
    // The lead confirms the reordered draft in the browser.
    await leadPage.goto(origin + "/?page=reviews");
    await expect(leadPage.getByRole("heading", { name: "Member · Annual focus" })).toBeVisible();
    await leadPage.getByRole("button", { name: "Review focus", exact: true }).click();
    await leadPage.getByRole("checkbox", { name: "We have discussed and agreed this focus." }).check();
    await leadPage.getByRole("button", { name: "Confirm focus", exact: true }).click();
    await expect(leadPage.getByText("Confirmed", { exact: true })).toBeVisible();
    // The member records Achieved on the first confirmed goal ("Run two sessions").
    await page.reload();
    await page.getByRole("button", { name: "Progress & notes", exact: true }).click();
    const goal = page.getByRole("region", { name: "Objective 1" }).getByRole("region", { name: "SMART goal 1" });
    await goal.getByRole("button", { name: "Add note", exact: true }).click();
    await page.getByLabel("Status", { exact: true }).selectOption("achieved");
    await page.getByRole("button", { name: "Save progress", exact: true }).click();
    await expect(goal.getByRole("button", { name: "Edit progress", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Focus", exact: true }).click();
    // The confirmed goal shows the badge; the earlier-draft snapshot must not.
    await expect(page.getByText("Achieved", { exact: true })).toBeVisible();
    const earlier = page.locator("details", { hasText: "Earlier draft · 1" });
    await expect(earlier).toHaveCount(1);
    await earlier.locator("summary").click();
    await expect(earlier.locator(".progress-pill")).toHaveCount(0);
    await expect(earlier.getByText("Achieved", { exact: true })).toHaveCount(0);
    // The draft-1 snapshot lists "Publish a guide" first; the badge must not sit next to it.
    await expect(earlier.locator("p", { hasText: "Publish a guide" })).toBeVisible();
  } finally {
    await browser.close();
    await vite?.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await f.close();
  }
});
