import { chromium, expect } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import pg from "pg";
import { createApp } from "./app.js";
import { hash } from "./access.js";
import { migrate } from "./schema.js";
import type { PositionFocus } from "../shared/focus.js";

test(
  "career lead browses members and reads focuses in the browser",
  { timeout: 60000 },
  async (t) => {
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const schema = `lead_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    const server = createServer();
    const browser = await chromium.launch();
    let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
    try {
      await migrate(db);
      const lead = randomUUID(),
        alice = randomUUID(),
        bob = randomUUID(),
        outsider = randomUUID();
      const department = randomUUID(),
        otherDepartment = randomUUID();
      await db.query("INSERT INTO allowed_domains VALUES('example.test')");
      for (const id of [department, otherDepartment])
        await db.query("INSERT INTO departments(id,name) VALUES($1,'Team')", [
          id,
        ]);
      for (const [id, name, role, team] of [
        [lead, "Lead", "career-lead", department],
        [alice, "Alice", "member", department],
        [bob, "Bob", "member", department],
        [outsider, "Outsider", "career-lead", otherDepartment],
      ]) {
        await db.query(
          "INSERT INTO users VALUES($1::uuid,$1::text,$2,$3,'example.test')",
          [id, `${name}@example.test`, name],
        );
        await db.query("INSERT INTO approved_emails VALUES(lower($1))", [
          `${name}@example.test`,
        ]);
        await db.query("INSERT INTO memberships VALUES($1,$2,$3,NULL)", [
          id,
          team,
          role,
        ]);
        await db.query(
          "INSERT INTO sessions VALUES($1,$2,now()+interval '1 day')",
          [hash(id!), id],
        );
      }
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const origin = `http://127.0.0.1:${address.port}`;
      const app = createApp(db, { origin });
      vite = await createViteServer({
        server: { middlewareMode: { server }, hmr: { server } },
        appType: "spa",
      });
      app.use(vite.middlewares);
      server.on("request", app);
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
      const context = await browser.newContext();
      await context.addCookies([
        { name: "lantern-session", value: lead, url: origin },
      ]);
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(origin);
      await page
        .getByRole("button", { name: "Department users", exact: true })
        .click();
      await page.getByRole("button", { name: "Alice", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Alice’s position focuses" }),
      ).toBeVisible();
      await expect(
        page.getByText("Alice@example.test", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("1 Jan 2026 – 31 Dec 2026", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Alice annual focus", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Alice annual focus" }),
      ).toBeVisible();
      await expect(
        page.getByText("Publish a guide by June", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /Edit|Add objective|Add SMART|Remove/,
        }),
      ).toHaveCount(0);
      await page.screenshot({
        path: "/tmp/lantern-lead-focuses-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          "document.documentElement.scrollWidth <= innerWidth",
        ),
      );
      await page.screenshot({
        path: "/tmp/lantern-lead-focuses-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Alice annual focus" }),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "← Alice’s position focuses",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "← Department users", exact: true })
        .click();
      await page.getByRole("button", { name: "Bob", exact: true }).click();
      await expect(
        page.getByText("No position focuses yet.", { exact: true }),
      ).toBeVisible();
      await page.goBack();
      await expect(
        page.getByRole("heading", { name: "Department users" }),
      ).toBeVisible();
      await page.goForward();
      await expect(
        page.getByRole("heading", { name: "Bob’s position focuses" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Department users", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Department users", exact: true }),
      ).toBeVisible();
      await t.test(
        "loading, failed reads and retry never retain the previous private document",
        async () => {
          await page.route("**/api/department/members/*/focuses/*", (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Temporarily unavailable." }),
            }),
          );
          await page.goto(
            `${origin}/?page=department&member=${alice}&memberFocus=${focus.id}`,
          );
          await expect(page.getByRole("alert")).toContainText(
            "Temporarily unavailable.",
          );
          await expect(
            page.getByText("Publish a guide by June", { exact: true }),
          ).toHaveCount(0);
          await page.unroute("**/api/department/members/*/focuses/*");
          await page.getByRole("button", { name: "Try again" }).click();
          await expect(
            page.getByRole("heading", { name: "Alice annual focus" }),
          ).toBeVisible();
          await db.query(
            "UPDATE memberships SET deleted_at=now() WHERE user_id=$1",
            [alice],
          );
          await page.evaluate("window.dispatchEvent(new Event('focus'))");
          await expect(page.getByRole("alert")).toContainText(
            "Member or position focus unavailable.",
          );
          await expect(
            page.getByText("Publish a guide by June", { exact: true }),
          ).toHaveCount(0);
          await page
            .getByRole("button", { name: "← Department users", exact: true })
            .click();
          await expect(
            page.getByRole("button", { name: "Alice", exact: true }),
          ).toHaveCount(0);
          await db.query(
            "UPDATE memberships SET deleted_at=NULL WHERE user_id=$1",
            [alice],
          );
        },
      );
      await t.test(
        "ordinary members have no team navigation and direct routes expose no other member content",
        async () => {
          await context.addCookies([
            { name: "lantern-session", value: bob, url: origin },
          ]);
          await page.goto(
            `${origin}/?page=department&member=${alice}&memberFocus=${focus.id}`,
          );
          await expect(page.locator(".aside-foot")).toContainText("Bob");
          await expect(
            page.getByRole("button", { name: "Department users", exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("Publish a guide by June", { exact: true }),
          ).toHaveCount(0);
          assert.equal(
            (
              await context.request.get(
                `${origin}/api/department/members/${alice}/focuses/${focus.id}`,
              )
            ).status(),
            403,
          );
        },
      );
      await t.test(
        "a different team’s lead cannot open the member route",
        async () => {
          await context.addCookies([
            { name: "lantern-session", value: outsider, url: origin },
          ]);
          await page.goto(
            `${origin}/?page=department&member=${alice}&memberFocus=${focus.id}`,
          );
          await expect(page.getByRole("alert")).toContainText(
            "Member or position focus unavailable.",
          );
          await expect(
            page.getByText("Publish a guide by June", { exact: true }),
          ).toHaveCount(0);
        },
      );
      await t.test(
        "lead access revocation on a protected request clears the entire private view",
        async () => {
          await context.addCookies([
            { name: "lantern-session", value: lead, url: origin },
          ]);
          await page.goto(
            `${origin}/?page=department&member=${alice}&memberFocus=${focus.id}`,
          );
          await expect(
            page.getByRole("heading", { name: "Alice annual focus" }),
          ).toBeVisible();
          await db.query(
            "DELETE FROM approved_emails WHERE email='lead@example.test'",
          );
          await page
            .getByRole("button", {
              name: "← Alice’s position focuses",
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("heading", { name: "Welcome to Lantern" }),
          ).toBeVisible();
          await expect(page.locator(".aside-foot")).not.toContainText("Lead");
          await expect(
            page.getByText("Alice@example.test", { exact: false }),
          ).toHaveCount(0);
          await db.query(
            "INSERT INTO approved_emails VALUES('lead@example.test')",
          );
        },
      );
      await t.test(
        "roster and member-list loading and failures have a working retry",
        async () => {
          for (const [url, apiPath, heading] of [
            [
              `${origin}/?page=department`,
              "**/api/department",
              "Department users",
            ],
            [
              `${origin}/?page=department&member=${alice}`,
              "**/api/department/members/*/focuses",
              "Alice’s position focuses",
            ],
          ]) {
            let release!: () => void;
            const held = new Promise<void>((resolve) => {
              release = resolve;
            });
            await page.route(apiPath!, async (route) => {
              await held;
              await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ error: "Read unavailable." }),
              });
            });
            try {
              await page.goto(url!);
              await expect(page.getByRole("status")).toContainText("Loading");
              release();
              await expect(page.getByRole("alert")).toContainText(
                "Read unavailable.",
              );
              await page.unroute(apiPath!);
              await page.getByRole("button", { name: "Try again" }).click();
              await expect(
                page.getByRole("heading", { name: heading!, exact: true }),
              ).toBeVisible();
              await expect(page.getByRole("alert")).toHaveCount(0);
            } finally {
              release();
              await page.unroute(apiPath!);
            }
          }
        },
      );
      await t.test(
        "failed session revalidation hides private data and retry recovers",
        async () => {
          await page.goto(
            `${origin}/?page=department&member=${alice}&memberFocus=${focus.id}`,
          );
          await expect(
            page.getByText("Publish a guide by June", { exact: true }),
          ).toBeVisible();
          await page.route("**/api/session", (route) =>
            route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({ error: "Session unavailable." }),
            }),
          );
          await page.evaluate("window.dispatchEvent(new Event('focus'))");
          await expect(page.getByRole("alert")).toContainText(
            "Session unavailable.",
          );
          await expect(
            page.getByText("Publish a guide by June", { exact: true }),
          ).toHaveCount(0);
          await page.unroute("**/api/session");
          await page.getByRole("button", { name: "Try again" }).click();
          await expect(
            page.getByText("Publish a guide by June", { exact: true }),
          ).toBeVisible();
        },
      );
      await t.test(
        "delayed member reads cannot restore content after an account switch",
        async () => {
          let release!: () => void, captured!: () => void;
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          const ready = new Promise<void>((resolve) => {
            captured = resolve;
          });
          await page.route(
            "**/api/department/members/*/focuses/*",
            async (route) => {
              const response = await route.fetch();
              captured();
              await held;
              await route.fulfill({ response });
            },
            { times: 1 },
          );
          try {
            await page.reload();
            await ready;
            await context.addCookies([
              { name: "lantern-session", value: bob, url: origin },
            ]);
            await page.evaluate("window.dispatchEvent(new Event('focus'))");
            await expect(page.locator(".aside-foot")).toContainText("Bob");
            const response = page.waitForResponse(
              "**/api/department/members/*/focuses/*",
            );
            release();
            await (await response).finished();
            await page.evaluate(
              "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
            );
            await expect(
              page.getByText("Publish a guide by June", { exact: true }),
            ).toHaveCount(0);
            await expect(
              page.getByRole("button", {
                name: "Department users",
                exact: true,
              }),
            ).toHaveCount(0);
          } finally {
            release();
            await page.unroute("**/api/department/members/*/focuses/*");
          }
        },
      );
      await t.test(
        "browser history and reload preserve Guide and Account destinations",
        async () => {
          await context.addCookies([
            { name: "lantern-session", value: lead, url: origin },
          ]);
          await page.goto(origin);
          for (const destination of ["Guide", "Account"]) {
            await page
              .getByRole("button", { name: destination, exact: true })
              .click();
            await page
              .getByRole("button", { name: "Department users", exact: true })
              .click();
            await expect(
              page.getByRole("heading", {
                name: "Department users",
                exact: true,
              }),
            ).toBeVisible();
            await page.goBack();
            await expect(
              page.getByRole("button", { name: destination, exact: true }),
            ).toHaveAttribute("aria-current", "page");
            await page.reload();
            await expect(
              page.getByRole("button", { name: destination, exact: true }),
            ).toHaveAttribute("aria-current", "page");
            await page.goForward();
            await expect(
              page.getByRole("heading", {
                name: "Department users",
                exact: true,
              }),
            ).toBeVisible();
          }
        },
      );
    } finally {
      await browser.close();
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
