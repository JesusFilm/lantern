import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture } from "./coach-test-support.js";

const original = {
  title: "Nested focus",
  start: "2026-10-01",
  end: "2027-03-31",
  sections: [
    {
      kind: "normal",
      objective: "Help engineers diagnose builds",
      goals: ["Review failures", "Try clearer messages"],
      alignment: { initiatives: [], other: true },
    },
    {
      kind: "personal-development",
      objective: "Practise interviews",
      goals: ["Ask a colleague for feedback"],
    },
    {
      kind: "leadership",
      objective: "Support facilitators",
      goals: ["Pair on a workshop"],
    },
  ],
};
test("member can change objective type without changing content; type is visible while writing goals and to the lead", async () => {
  const f = await coachingFixture(),
    vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", original)
    ).json();
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + saved.id);
    const goalAction = page
      .locator(".read-goal")
      .first()
      .getByRole("button", { name: "Edit", exact: true });
    await expect(goalAction).toBeVisible();
    assert.ok(
      (await goalAction.boundingBox())!.height <= 48,
      "Goal actions stay on one line on desktop",
    );
    await page
      .getByRole("button", { name: "Edit objective", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("radio", { name: "Leadership", exact: true }),
    ).toBeVisible({ timeout: 2000 });
    await page.getByRole("radio", { name: "Leadership", exact: true }).check();
    await page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const result = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.deepEqual(result.sections, [
      { ...original.sections[0], kind: "leadership" },
      ...original.sections.slice(1),
    ]);
    await page
      .locator(".read-goal")
      .first()
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText("Leadership", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await context.addCookies([
      { name: "lantern-session", value: "lead", url: f.origin },
    ]);
    await page.goto(
      f.origin +
        "/?page=department&member=" +
        f.ids.member +
        "&memberFocus=" +
        saved.id,
    );
    await expect(
      page
        .locator(".member-focus-detail")
        .getByText("Leadership", { exact: true })
        .first(),
    ).toBeVisible();
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("guided editing changes one existing goal without rewriting its parent or siblings", async () => {
  const f = await coachingFixture({
      async suggest() {
        throw new Error("Existing wording must not be regenerated");
      },
    }),
    vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", original)
    ).json();
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .locator(".read-section")
      .first()
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByLabel("SMART goal 2", { exact: true })
      .fill("Try clearer messages with two engineers.");
    assert.deepEqual(
      await (await f.request("member", "/api/focuses/" + saved.id)).json(),
      saved,
    );
    await page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(page.locator(".objective-editor")).toHaveCount(0);
    const result = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.deepEqual(result.sections, [
      {
        ...saved.sections[0],
        goals: ["Review failures", "Try clearer messages with two engineers."],
      },
      ...saved.sections.slice(1),
    ]);
    await page
      .getByRole("button", { name: "Review position focus", exact: true })
      .click();
    for (const label of ["Contribution", "Personal development", "Leadership"])
      await expect(
        page.locator(".focus-document").getByText(label, { exact: true }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      page.getByText("Review requested · Draft " + result.version, {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
test("member confirms the objective type; a failed save retains the complete guided objective for retry", async () => {
  const f = await coachingFixture({
      async suggest(_s, _c, validate) {
        return validate({
          ready: true,
          objective: "Help new facilitators lead useful discussions",
          recommendedKind: "leadership",
          initiativeIds: [],
        });
      },
    }),
    vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", original)
    ).json();
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .getByRole("button", { name: "+ Add objective", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await page
      .getByLabel("Your work", { exact: true })
      .fill("I help colleagues facilitate discussions.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByText("(recommended)", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: "Contribution", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "About Leadership", exact: true })
      .click();
    await expect(
      page.getByText(/Develop leadership through a practical assignment/),
    ).toBeVisible();
    await page
      .getByRole("radio", { name: "Personal development", exact: true })
      .check();
    const fail = async (route: import("@playwright/test").Route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Temporarily unavailable." }),
          })
        : route.continue();
    await page.route("**/api/focuses/*", fail);
    await page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveText(
      "Temporarily unavailable.",
    );
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue(
      "Help new facilitators lead useful discussions",
    );
    await expect(
      page.getByRole("radio", { name: "Personal development", exact: true }),
    ).toBeChecked();
    assert.deepEqual(
      await (await f.request("member", "/api/focuses/" + saved.id)).json(),
      saved,
    );
    await page.unroute("**/api/focuses/*", fail);
    await page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(page.locator(".objective-editor")).toHaveCount(0);
    const record = await (
      await f.request("member", "/api/coach/focuses/" + saved.id)
    ).json();
    assert.deepEqual(record.focus.sections.slice(0, 3), saved.sections);
    assert.equal(record.focus.sections[3].kind, "personal-development");
    assert.deepEqual(record.focus.sections[3].goals, []);
    assert.equal(record.checkpoint, null);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
