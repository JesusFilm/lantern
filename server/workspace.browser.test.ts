import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import { migrate } from "./schema.js";
import { createApp } from "./app.js";

test(
  "position focus workspace through browser and real database",
  { timeout: 90000 },
  async (t) => {
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const schema = `workspace_${randomUUID().replaceAll("-", "")}`;
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
      const user = randomUUID(),
        dept = randomUUID();
      await db.query(
        "INSERT INTO users VALUES($1,'workspace-user','user@example.test','Jordan Davis','example.test')",
        [user],
      );
      await db.query(
        "INSERT INTO departments(id,name) VALUES($1,'Engineering')",
        [dept],
      );
      await db.query("INSERT INTO memberships VALUES($1,$2,'member',NULL)", [
        user,
        dept,
      ]);
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      const addr = server.address();
      assert.ok(addr && typeof addr !== "string");
      const origin = `http://127.0.0.1:${addr.port}`;
      const app = createApp(db, { origin, localUserId: user });
      vite = await createViteServer({
        server: { middlewareMode: { server }, hmr: { server } },
        appType: "spa",
      });
      app.use(vite.middlewares);
      server.on("request", app);
      browser = await chromium.launch();
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await t.test(
        "empty app creates a dated document that survives reload",
        async () => {
          await page.goto(origin);
          await expect(
            page.getByRole("heading", {
              name: "Position focuses",
              exact: true,
            }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "New position focus" })
            .click();
          await page.getByLabel("Document title").fill("Annual focus");
          await page.getByLabel("Period starts").fill("2026-01-01");
          await page.getByLabel("Period ends").fill("2026-12-31");
          await page.getByRole("button", { name: "Save changes" }).click();
          await expect(
            page.getByRole("heading", { name: "Annual focus" }),
          ).toBeVisible();
          await page.reload();
          await expect(
            page.getByRole("heading", { name: "Annual focus" }),
          ).toBeVisible();
        },
      );

      await t.test(
        "objective types reset to normal; editing, cancel and goal removal persist",
        async () => {
          await page
            .getByRole("button", { name: "Add objective", exact: true })
            .click();
          await expect(
            page.getByRole("radio", { name: "Normal Objectives", exact: true }),
          ).toBeChecked();
          await page
            .getByRole("radio", { name: "Leadership Objectives", exact: true })
            .check();
          await page
            .getByLabel("Objective", { exact: true })
            .fill("Support a new facilitator.");
          await page.getByRole("button", { name: "Save changes" }).click();
          await expect(page.locator(".read-section")).toContainText(
            "Leadership",
          );
          await page
            .getByRole("button", { name: "+ Add objective", exact: true })
            .click();
          await expect(
            page.getByRole("radio", { name: "Normal Objectives", exact: true }),
          ).toBeChecked();
          await page
            .getByRole("radio", {
              name: "Personal Development Objectives",
              exact: true,
            })
            .check();
          await page
            .getByLabel("Objective", { exact: true })
            .fill("Improve my communication.");
          await page.getByRole("button", { name: "Save changes" }).click();
          await page
            .getByRole("button", { name: "+ Add objective", exact: true })
            .click();
          await page
            .getByLabel("Objective", { exact: true })
            .fill("Help new team members.");
          await page.getByRole("button", { name: "Save changes" }).click();
          await page
            .locator(".read-section")
            .first()
            .getByRole("button", { name: "+ Add SMART goal" })
            .click();
          await page
            .getByLabel("SMART goal", { exact: true })
            .fill("Run two practice sessions by June.");
          await page.getByRole("button", { name: "Save changes" }).click();
          await page
            .locator(".read-goal")
            .getByRole("button", { name: "Edit", exact: true })
            .click();
          await page
            .getByLabel("SMART goal", { exact: true })
            .fill("Discard this");
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
          await expect(page.locator(".read-goal")).not.toContainText(
            "Discard this",
          );
          await page
            .locator(".read-goal")
            .getByRole("button", { name: "Edit", exact: true })
            .click();
          // Exercise the save/reload boundary with a genuinely pending HTTP write.
          await page.route("**/api/focuses/*", async (route) => {
            if (route.request().method() === "PUT" &&
                route.request().postData()?.includes("Run three practice sessions by July.")) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
            await route.continue().catch(() => {});
          });
          await page
            .getByLabel("SMART goal", { exact: true })
            .fill("Run three practice sessions by July.");
          await page.getByRole("button", { name: "Save changes" }).click();
          await expect(page.getByRole("dialog")).toBeHidden();
          await page.unroute("**/api/focuses/*");
          await page.reload();
          await expect(page.locator(".read-goal")).toContainText(
            "three practice",
          );
          await expect(page.locator(".read-section")).toHaveCount(3);
          await page
            .locator(".read-section")
            .first()
            .getByRole("button", { name: "Edit objective" })
            .click();
          await page
            .getByLabel("Objective", { exact: true })
            .fill("Support two new facilitators.");
          await page.getByRole("button", { name: "Save changes" }).click();
          await expect(page.locator(".read-section").first()).toContainText(
            "two new facilitators",
          );
          await page
            .locator(".read-goal")
            .getByRole("button", { name: "Remove", exact: true })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Remove", exact: true })
            .click();
          await expect(page.locator(".read-goal")).toHaveCount(0);
          await page
            .locator(".read-section")
            .last()
            .getByRole("button", { name: "Remove", exact: true })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Remove", exact: true })
            .click();
          await page.reload();
          await expect(page.locator(".read-section")).toHaveCount(2);
          await page
            .getByRole("button", { name: "Edit title & dates" })
            .click();
          await page.getByLabel("Document title").fill("Revised annual focus");
          await page.getByRole("button", { name: "Save changes" }).click();
          await page
            .getByRole("button", { name: "← Position focuses" })
            .click();
          await expect(
            page.getByRole("button", {
              name: "Revised annual focus",
              exact: true,
            }),
          ).toBeVisible();
        },
      );

      await t.test(
        "guided lessons retain the side menu, example is concise, profile saves and cancels",
        async () => {
          await page
            .getByRole("button", { name: "Guide", exact: true })
            .click();
          await expect(
            page.getByRole("heading", {
              name: "What makes a useful objective?",
            }),
          ).toBeVisible();
          for (let i = 0; i < 2; i++)
            await page
              .getByRole("button", { name: "Next →", exact: true })
              .click();
          await page
            .getByRole("button", { name: "Continue to SMART goals →" })
            .click();
          for (const title of [
            "Specific",
            "Measurable",
            "Achievable",
            "Relevant",
            "Time-bound",
          ]) {
            await expect(page.locator(".lesson-card h2")).toHaveText(title);
            if (title !== "Time-bound")
              await page
                .getByRole("button", { name: "Next →", exact: true })
                .click();
          }
          await page
            .getByRole("button", { name: "See the full example →" })
            .click();
          await expect(page.locator(".guide-layout .read-goal")).toHaveCount(2);
          const nav = await page.locator(".guide-navigation").boundingBox(),
            body = await page.locator(".lesson-body").boundingBox();
          assert.ok(nav && body && body.x > nav.x + nav.width);
          await page
            .getByRole("button", { name: "Objectives", exact: true })
            .click();
          await expect(page.locator(".explanation")).toContainText(
            "Why it works",
          );
          await page
            .getByRole("button", { name: "Account", exact: true })
            .click();
          await page.getByRole("button", { name: "Edit name" }).click();
          await page
            .getByLabel("Display name", { exact: true })
            .fill("Discard");
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
          await expect(page.locator("dd").first()).toHaveText("Jordan Davis");
          await page.getByRole("button", { name: "Edit name" }).click();
          await page
            .getByLabel("Display name", { exact: true })
            .fill("Jordan Updated");
          await page.getByRole("button", { name: "Save changes" }).click();
          await expect(page.getByRole("dialog")).toBeHidden();
          await page.reload();
          await page
            .getByRole("button", { name: "Account", exact: true })
            .click();
          await expect(page.locator("dd").first()).toHaveText("Jordan Updated");
          await page.setViewportSize({ width: 390, height: 844 });
          await page
            .getByRole("button", { name: "Guide", exact: true })
            .click();
          assert.ok(
            await page.evaluate(
              "document.documentElement.scrollWidth<=innerWidth",
            ),
          );
          await page
            .getByRole("button", { name: "SMART goals", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Next →", exact: true })
            .click();
          await expect(page.locator(".lesson-card h2")).toHaveText(
            "Measurable",
          );
          await expect(
            page.getByText("Reset demo", { exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByText("Prototype state", { exact: true }),
          ).toHaveCount(0);
        },
      );

      await t.test(
        "failed saves keep dialog text, Escape cancels, and stale saves show recovery instructions",
        async () => {
          await page.setViewportSize({ width: 1440, height: 1000 });
          await page
            .getByRole("button", { name: "Position focuses", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Revised annual focus", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Edit objective", exact: true })
            .first()
            .click();
          await page
            .getByLabel("Objective", { exact: true })
            .fill("Preserve this unsaved text");
          await page.route("**/api/focuses/*", (route) =>
            route.request().method() === "PUT"
              ? route.fulfill({
                  status: 503,
                  contentType: "application/json",
                  body: JSON.stringify({ error: "Temporarily unavailable." }),
                })
              : route.continue(),
          );
          await page.getByRole("button", { name: "Save changes" }).click();
          await expect(page.getByRole("alert")).toHaveText(
            "Temporarily unavailable.",
          );
          await expect(
            page.getByLabel("Objective", { exact: true }),
          ).toHaveValue("Preserve this unsaved text");
          await page.unroute("**/api/focuses/*");
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
          const otherPage = await browser!.newPage();
          await otherPage.goto(page.url());
          await otherPage
            .getByRole("button", { name: "Edit objective", exact: true })
            .first()
            .click();
          await otherPage
            .getByLabel("Objective", { exact: true })
            .fill("Saved by another window");
          await otherPage.getByRole("button", { name: "Save changes" }).click();
          await page
            .getByRole("button", { name: "Edit objective", exact: true })
            .first()
            .click();
          await page
            .getByLabel("Objective", { exact: true })
            .fill("Stale write");
          await page.getByRole("button", { name: "Save changes" }).click();
          await expect(page.getByRole("alert")).toContainText(
            "changed in another window",
          );
          await page
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
          await page
            .getByRole("button", { name: "← Position focuses", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Revised annual focus", exact: true })
            .click();
          await expect(page.locator(".read-section").first()).toContainText(
            "Saved by another window",
          );
          await otherPage.close();
        },
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser?.close();
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
