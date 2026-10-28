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
      server: { middlewareMode: true },
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
    const goalAction = page.locator(".read-goal").first().getByRole("button", { name: "Edit", exact: true });
    await expect(goalAction).toBeVisible();
    assert.ok((await goalAction.boundingBox())!.height < 30, "Goal actions stay on one line on desktop");
    await page
      .getByRole("button", { name: "Edit objective", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("radio", { name: "Leadership", exact: true }),
    ).toBeVisible({ timeout: 2000 });
    await page.getByRole("radio", { name: "Leadership", exact: true }).check();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
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

test("scoped goal coaching returns to the same editor, preserves the document, and whole-focus review shows every type", async () => {
  const stages: string[] = [];
  const f = await coachingFixture({
    async suggest(_system, raw, validate) {
      const { stage, context } = JSON.parse(raw);
      stages.push(stage);
      assert.equal(context.objective, original.sections[0]!.objective);
      assert.equal(context.kind, "normal");
      return validate(
        stage === "actions"
          ? {
              actions: ["Review build failures", "Try clearer errors"],
              suggestedDate: "2026-11-30",
            }
          : {
              goal: "By 15 December 2026, review failures and record findings.",
            },
      );
    },
  });
  const vite = await createServer({
    server: { middlewareMode: true },
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
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("button", { name: "Goal coach", exact: true }),
    ).toHaveCount(0, { timeout: 2000 });
    await page
      .locator(".read-goal")
      .nth(1)
      .getByRole("button", { name: "Coach", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "What could you do next?" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Suggest actions", exact: true })
      .click();
    await page.getByLabel("Review build failures", { exact: true }).check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Aim for", { exact: true }).fill("2026-12-15");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Use suggestion", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Edit SMART goal", exact: true }),
    ).toBeVisible();
    const before = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.deepEqual(before, saved);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const result = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.deepEqual(result.sections, [
      {
        ...original.sections[0],
        goals: [
          "Review failures",
          "By 15 December 2026, review failures and record findings.",
        ],
      },
      ...original.sections.slice(1),
    ]);
    assert.deepEqual(stages, ["actions", "goal"]);
    await page
      .getByRole("button", { name: "Review whole focus", exact: true })
      .click();
    for (const name of ["Contribution", "Personal development", "Leadership"])
      await expect(
        page.locator(".cp-document").getByText(name, { exact: true }),
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

test("getting started saves private progress, resumes after reload, and only adds the member-confirmed objective on Save", async () => {
  const f = await coachingFixture({
      async suggest(_s, _raw, validate) {
        return validate({
          ready: true,
          objective: "Help new facilitators lead useful discussions",
          recommendedKind: "leadership",
          initiativeIds: [],
        });
      },
    }),
    vite = await createServer({
      server: { middlewareMode: true },
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
      .getByRole("button", { name: "Help me get started", exact: true })
      .click();
    await page
      .getByLabel("Your project work")
      .fill("I help colleagues facilitate discussions.");
    await page.getByRole("button", { name: "Save progress & close" }).click();
    await expect(
      page.getByRole("button", { name: "Resume coaching", exact: true }),
    ).toBeVisible();
    assert.deepEqual(
      await (await f.request("member", "/api/focuses/" + saved.id)).json(),
      saved,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Resume coaching", exact: true })
      .click();
    await expect(page.getByLabel("Your project work")).toHaveValue(
      "I help colleagues facilitate discussions.",
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
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
    await page.getByRole("radio", { name: "Leadership", exact: true }).check();
    await page.getByRole("button", { name: "Use suggestion" }).click();
    assert.deepEqual(
      await (await f.request("member", "/api/focuses/" + saved.id)).json(),
      saved,
    );
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const result = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.deepEqual(result.sections.slice(0, 3), original.sections);
    assert.equal(result.sections[3].kind, "leadership");
    assert.equal(
      result.sections[3].objective,
      "Help new facilitators lead useful discussions",
    );
    await expect(
      page.getByRole("button", { name: "Resume coaching", exact: true }),
    ).toHaveCount(0, { timeout: 2000 });
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("saved coaching survives unrelated manual edits and stale progress requires an explicit current target", async () => {
  const f = await coachingFixture(),
    vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const { checkpoint } = await import("./coach-test-support.js");
    const saved = await (
      await f.request("member", "/api/coach/save", "POST", {
        draft: original,
        checkpoint: {
          ...checkpoint,
          objective: original.sections[0]!.objective,
          goal: original.sections[0]!.goals[0],
          sectionIndex: 0,
          goalIndex: 0,
        },
      })
    ).json();
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?focus=" + saved.focus.id);
    await page.getByRole("button", { name: "Edit title & dates" }).click();
    await page.getByLabel("Document title").fill("Title changed");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Resume coaching", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("focus changed");
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page
      .locator(".read-goal")
      .nth(1)
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    page.once("dialog", (d) => void d.accept());
    await page
      .getByRole("button", { name: "Resume saved help here", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Optional coaching" }),
    ).toBeVisible();
    await expect(
      page.getByText("Coaching is unavailable.", { exact: false }),
    ).toBeVisible();
    assert.equal(
      (
        await (
          await f.request("member", "/api/focuses/" + saved.focus.id)
        ).json()
      ).sections[0].goals[1],
      "Try clearer messages",
    );
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
