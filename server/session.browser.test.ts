import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import { createApp } from "./app.js";
import { migrate } from "./schema.js";

test("private browser state follows the current server session", { timeout: 60000 }, async (t) => {
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const schema = `session_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  const server = createServer();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  try {
    await migrate(db);
    const memberA = randomUUID(), memberB = randomUUID(), department = randomUUID();
    await db.query("INSERT INTO allowed_domains VALUES('example.test')");
    await db.query("INSERT INTO departments(id,name) VALUES($1,'Engineering')", [department]);
    for (const [id, name] of [[memberA, "Member A"], [memberB, "Member B"]]) {
      await db.query(
        "INSERT INTO users VALUES($1::uuid,$1::text,$2,$3,'example.test')",
        [id, `${id}@example.test`, name],
      );
      await db.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [id, department]);
      await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')", [
        createHash("sha256").update(id!).digest("hex"), id,
      ]);
    }
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const app = createApp(db, { origin });
    vite = await createViteServer({
      server: { middlewareMode: { server }, hmr: { server } }, appType: "spa",
    });
    app.use(vite.middlewares);
    server.on("request", app);
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    async function signIn(userId: string) {
      await context.addCookies([{ name: "lantern-session", value: userId, url: origin }]);
    }
    async function refreshSession() {
      await page.evaluate("window.dispatchEvent(new Event('focus'))");
    }
    async function createFocus(userId: string, title: string) {
      await signIn(userId);
      const response = await context.request.post(`${origin}/api/focuses`, {
        headers: { Origin: origin },
        data: { title, start: "2026-01-01", end: "2026-12-31", sections: [
          { kind: "normal", objective: `${title} objective`, goals: [] },
        ] },
      });
      assert.equal(response.status(), 201);
      return (await response.json()) as { id: string };
    }
    const focusA = await createFocus(memberA, "Private member A focus");
    await createFocus(memberB, "Private member B focus");

    await t.test("switching accounts in another tab clears the previous member's focus", async () => {
      await signIn(memberA);
      await page.goto(`${origin}/?focus=${focusA.id}`);
      await expect(page.getByRole("heading", { name: "Private member A focus", exact: true })).toBeVisible();
      await signIn(memberB);
      await refreshSession();
      await expect(page.locator(".aside-foot")).toContainText("Member B");
      await expect(page.getByText("Private member A focus objective", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Private member B focus", exact: true })).toBeVisible();
    });

    await t.test("a delayed profile save cannot restore the previous member's account", async () => {
      await signIn(memberA);
      await page.goto(origin);
      await page.getByRole("button", { name: "Account", exact: true }).click();
      await page.getByRole("button", { name: "Edit name", exact: true }).click();
      await page.getByLabel("Display name", { exact: true }).fill("Saved member A");
      let release!: () => void, captured!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const ready = new Promise<void>((resolve) => { captured = resolve; });
      await page.route("**/api/account", async (route) => {
        const response = await route.fetch();
        captured();
        await held;
        await route.fulfill({ response });
      }, { times: 1 });
      try {
        await page.getByRole("button", { name: "Save changes", exact: true }).click();
        await ready;
        await signIn(memberB);
        await refreshSession();
        await expect(page.locator(".aside-foot")).toContainText("Member B");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const response = page.waitForResponse("**/api/account");
        release();
        await (await response).finished();
        await page.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
        await expect(page.locator(".aside-foot")).toContainText("Member B");
        await expect(page.locator("dd").first()).toHaveText("Member B");
      } finally {
        release();
        await page.unroute("**/api/account");
      }
    });

    await t.test("an older session response cannot replace a newer account refresh", async () => {
      await signIn(memberA);
      await page.goto(origin);
      await expect(page.getByRole("button", { name: "Private member A focus", exact: true })).toBeVisible();
      let release!: () => void, captured!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const ready = new Promise<void>((resolve) => { captured = resolve; });
      await page.route("**/api/session", async (route) => {
        const response = await route.fetch();
        captured();
        await held;
        await route.fulfill({ response });
      }, { times: 1 });
      try {
        await refreshSession();
        await ready;
        await signIn(memberB);
        await refreshSession();
        await expect(page.locator(".aside-foot")).toContainText("Member B");
        await expect(page.getByRole("button", { name: "Private member B focus", exact: true })).toBeVisible();
        const response = page.waitForResponse("**/api/session");
        release();
        await (await response).finished();
        await page.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
        await expect(page.locator(".aside-foot")).toContainText("Member B");
      } finally {
        release();
        await page.unroute("**/api/session");
      }
    });

    await t.test("membership changes clear documents from the previous department", async () => {
      await signIn(memberB);
      await page.goto(origin);
      await page.getByRole("button", { name: "Private member B focus", exact: true }).click();
      await expect(page.getByText("Private member B focus objective", { exact: true })).toBeVisible();
      // Synthetic department change tests scope isolation; no transfer UI is implied.
      const otherDepartment = randomUUID();
      await db.query("INSERT INTO departments(id,name) VALUES($1,'Other department')", [otherDepartment]);
      await db.query("UPDATE memberships SET department_id=$1 WHERE user_id=$2", [otherDepartment, memberB]);
      await createFocus(memberB, "Current department focus");
      await refreshSession();
      await expect(page.locator(".aside-foot")).toContainText("Other department");
      await expect(page.getByText("Private member B focus objective", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Current department focus", exact: true })).toBeVisible();
      await db.query("UPDATE memberships SET deleted_at=now() WHERE user_id=$1", [memberB]);
      await refreshSession();
      await expect(page.getByRole("heading", { name: "Your account is ready", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Current department focus", exact: true })).toHaveCount(0);
    });
  } finally {
    await browser?.close();
    await vite?.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
