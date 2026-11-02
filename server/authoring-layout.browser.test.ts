import assert from "node:assert/strict";
import { test } from "node:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, draft } from "./coach-test-support.js";

test("Save and Cancel stay reachable while long objectives scroll without obscuring the last goal", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    cacheDir: join(tmpdir(), "lantern-layout-" + f.ids.member),
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", {
        ...draft,
        sections: [
          {
            ...draft.sections[0],
            goals: Array.from(
              { length: 8 },
              (_, i) =>
                `Goal ${i + 1}: review progress with the team by December.`,
            ),
          },
        ],
      })
    ).json();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .getByRole("button", { name: "Edit objective", exact: true })
      .click();
    for (const width of [390, 320, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate("window.scrollTo(0, 0)");
      await expect(
        page.getByRole("button", { name: "Save objective", exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeInViewport();
      await page
        .getByLabel("SMART goal 8", { exact: true })
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
      const field = (await page
        .getByLabel("SMART goal 8", { exact: true })
        .boundingBox())!;
      const actions = (await page.locator(".authoring-actions").boundingBox())!;
      assert.ok(
        field.y + field.height <= actions.y,
        "The last goal remains readable above the action bar",
      );
      assert.equal(
        await page.evaluate(
          "document.documentElement.scrollWidth > innerWidth",
        ),
        false,
      );
    }
  } finally {
    await browser.close();
    await vite.close();
    await rm(vite.config.cacheDir, { recursive: true, force: true });
    await f.close();
  }
});

test("manual and guided authoring use the same type and initiative control geometry", async () => {
  const f = await coachingFixture({
    async suggest(_system, _raw, validate) {
      return validate({
        ready: true,
        objective: "Help engineers",
        recommendedKind: "normal",
        initiativeIds: [],
      });
    },
  });
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    cacheDir: join(tmpdir(), "lantern-layout-" + f.ids.member),
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    assert.equal(
      (
        await f.request("lead", "/api/department/direction", "PUT", {
          version: 0,
          mission: "",
          initiatives: [{ name: "Reliable delivery", archived: false }],
        })
      ).status,
      200,
    );
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + saved.id);
    const geometry = async () => {
      await expect(
        page.getByRole("radio", { name: "Contribution", exact: true }),
      ).toBeVisible();
      return page
        .locator(".objective-editor")
        .locator(".type-choice, .initiative-option")
        .evaluateAll((elements) =>
          elements.map((el) => {
            const s = el.ownerDocument.defaultView!.getComputedStyle(el),
              input = el.querySelector("input")!.getBoundingClientRect();
            const text = el.querySelector("span")!.getBoundingClientRect();
            return {
              font: s.fontSize,
              weight: s.fontWeight,
              line: s.lineHeight,
              padding: s.padding,
              height: Math.round(el.getBoundingClientRect().height),
              gap: Math.round(text.left - input.right),
            };
          }),
        );
    };
    await page
      .getByRole("button", { name: "Edit objective", exact: true })
      .first()
      .click();
    const manual = await geometry();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "+ Add objective", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await page
      .getByLabel("Your work", { exact: true })
      .fill("Help engineers diagnose failed builds.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator(".cp-coach-wait")).toBeHidden();
    const guided = await geometry();
    assert.deepEqual(
      guided,
      manual,
      "The same type and initiative choices must not change spacing or typography between methods",
    );
    assert.ok(
      guided.every((row) => row.gap >= 8),
      "Every radio and checkbox stays visibly separated from its label",
    );
  } finally {
    await browser.close();
    await vite.close();
    await rm(vite.config.cacheDir, { recursive: true, force: true });
    await f.close();
  }
});

test("initiative choices stay in the author's single reading flow on desktop and phone", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    cacheDir: join(tmpdir(), "lantern-layout-" + f.ids.member),
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const direction = await f.request(
      "lead",
      "/api/department/direction",
      "PUT",
      {
        version: 0,
        mission: "",
        initiatives: Array.from({ length: 8 }, (_, i) => ({
          name: `Initiative ${i + 1} for our team`,
          archived: false,
        })),
      },
    );
    assert.equal(direction.status, 200);
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .getByRole("button", { name: "Edit objective", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Other — none of these apply" }),
    ).toBeAttached();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const list = page.locator(".objective-editor .initiative-options");
      assert.equal(
        await list.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
        false,
        `Initiative options must not create a second vertical scroll area at ${width}px`,
      );
      assert.equal(
        await page.evaluate(
          "document.documentElement.scrollWidth > innerWidth",
        ),
        false,
        `Authoring must reflow without horizontal scrolling at ${width}px`,
      );
      await page
        .getByRole("checkbox", {
          name: "Initiative 8 for our team",
          exact: true,
        })
        .check();
      await expect(
        page.getByRole("checkbox", {
          name: "Initiative 8 for our team",
          exact: true,
        }),
      ).toBeChecked();
    }
  } finally {
    await browser.close();
    await vite.close();
    await rm(vite.config.cacheDir, { recursive: true, force: true });
    await f.close();
  }
});
