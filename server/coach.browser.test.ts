import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer as createViteServer } from "vite";
import { coachingFixture } from "./coach-test-support.js";
import { createCoachProvider } from "./coach-provider.js";
import { createServer } from "node:http";

test("member coaches, edits the date, saves, requests review; lead replies and confirms in a separate view", async () => {
  const upstream = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const call = JSON.parse(raw),
      { stage } = JSON.parse(call.messages[0].content);
    const value =
      stage === "clarify" || stage === "objective"
        ? {
            ready: true,
            objective: "Help engineers diagnose failed builds",
            title: "Build confidence",
            initiativeIds: [],
          }
        : stage === "actions"
          ? {
              actions: [
                "Review three failed builds with engineers",
                "Try a clearer error message",
              ],
              suggestedDate: "2026-11-30",
            }
          : {
              goal: "By 15 December 2026, review three failed builds with engineers and record what helps diagnosis.",
            };
    setTimeout(
      () =>
        res.end(
          JSON.stringify({
            content: [{ type: "text", text: JSON.stringify(value) }],
          }),
        ),
      250,
    );
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const a = upstream.address();
  assert.ok(a && typeof a !== "string");
  const url = `http://127.0.0.1:${a.port}`;
  const provider = createCoachProvider(
    {
      primary: { url, key: "x", model: "coding" },
      fallback: { url, key: "y", model: "gemini" },
      timeoutMs: 1000,
      cooldownMs: 1000,
    },
    () => {},
  );
  const f = await coachingFixture(provider),
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch({ headless: true });
  try {
    const member = await browser.newContext();
    await member.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await member.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const saved = await (
      await f.request("member", "/api/focuses", "POST", {
        title: "Build confidence",
        start: "2026-10-01",
        end: "2027-03-31",
        sections: [],
      })
    ).json();
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .getByRole("button", { name: "Add objective", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await page
      .getByLabel("Your work", { exact: true })
      .fill("I work on build failures for other engineers.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Finding the next useful question" })
      .waitFor();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await expect(page.getByLabel("Objective", { exact: true })).toHaveValue(
      "Help engineers diagnose failed builds",
    );
    await page.getByRole("checkbox", { name: "Other — none of these apply" }).check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Add SMART goal", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    // The member can choose the date before an action without that choice being reset.
    await page.getByLabel("Target date", { exact: true }).fill("2026-12-15");
    await page
      .getByLabel("Review three failed builds with engineers", { exact: true })
      .check();
    await expect(page.getByLabel("Target date", { exact: true })).toHaveValue(
      "2026-12-15",
    );
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const editedGoal =
      "By 15 December 2026, review build failures and record engineers' feedback.";
    await page.getByLabel("SMART goal", { exact: true }).fill(editedGoal);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByLabel("SMART goal", { exact: true })).toHaveValue(
      editedGoal,
    );
    await page
      .getByRole("button", { name: "Add to objective", exact: true })
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check objective", exact: true }),
    ).toBeVisible();
    const unchanged = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(unchanged.version, saved.version);
    assert.deepEqual(unchanged.sections, []);
    await page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Build confidence", exact: true }),
    ).toBeVisible();
    const complete = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(complete.version, saved.version + 1);
    assert.equal(complete.sections.length, 1);
    assert.deepEqual(complete.sections[0].goals, [editedGoal]);
    await page
      .getByRole("button", { name: "Review & discussion", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Request review", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      page.getByText("Review requested · Draft " + complete.version, {
        exact: true,
      }),
    ).toBeVisible();
    const lead = await browser.newContext();
    await lead.addCookies([
      { name: "lantern-session", value: "lead", url: f.origin },
    ]);
    const leadPage = await lead.newPage();
    await leadPage.goto(f.origin + "/?page=reviews");
    await leadPage
      .getByRole("button", { name: "Review focus", exact: true })
      .click();
    await leadPage
      .getByRole("button", { name: "+ Add note", exact: true })
      .click();
    await leadPage
      .getByLabel("Add a note", { exact: true })
      .fill("This looks useful.");
    await leadPage
      .getByRole("button", { name: "Add note", exact: true })
      .click();
    await leadPage.getByText("This looks useful.", { exact: true }).waitFor();
    await leadPage
      .getByLabel("We have discussed and agreed this focus.")
      .check();
    await leadPage
      .getByRole("button", { name: "Confirm focus", exact: true })
      .click();
    await leadPage
      .getByText("Requested version " + complete.version, { exact: true })
      .first()
      .waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
    upstream.closeAllConnections();
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});

test("guiding one objective preserves every other objective and goal after reload", async () => {
  const f = await coachingFixture({
      async suggest() {
        throw new Error(
          "Editing existing goals must not require new suggestions",
        );
      },
    }),
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const original = {
      title: "Whole focus",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [
        {
          kind: "normal",
          objective: "First contribution",
          goals: ["First goal", "Keep this second goal"],
        },
        {
          kind: "personal-development",
          objective: "Learn interviewing",
          goals: ["Practise with a colleague"],
        },
        {
          kind: "leadership",
          objective: "Support the team",
          goals: ["Facilitate a retrospective"],
        },
      ],
    };
    const saved = await (
      await f.request("member", "/api/focuses", "POST", original)
    ).json();
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .locator(".read-section")
      .first()
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await expect(
      page.getByText("First contribution", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("What would you like to improve about this objective?"),
    ).toHaveValue("");
    await expect(page.getByLabel("Your work", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("checkbox", { name: "Other — none of these apply" }).check();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByLabel("SMART goal 1", { exact: true })
      .fill("Revised first goal");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Whole focus", exact: true }),
    ).toBeVisible();
    await page
      .locator(".read-section")
      .nth(1)
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page
      .getByLabel("SMART goal", { exact: true })
      .fill("Practise two interviews");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.reload();
    await page
      .locator(".read-section")
      .nth(1)
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("SMART goal", { exact: true }).inputValue(),
      "Practise two interviews",
    );
    const result = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(result.sections.length, 3);
    assert.deepEqual(result.sections[0].goals, [
      "Revised first goal",
      "Keep this second goal",
    ]);
    assert.equal(result.sections[1].kind, "personal-development");
    assert.deepEqual(result.sections[2], original.sections[2]);
    await f.request("member", "/api/focuses/" + saved.id, "PUT", {
      title: result.title,
      start: result.start,
      end: result.end,
      sections: result.sections,
      version: result.version,
    });
    await page
      .getByLabel("SMART goal", { exact: true })
      .fill("Keep my unsaved wording");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "changed in another window",
    );
    await expect(page.getByLabel("SMART goal", { exact: true })).toHaveValue(
      "Keep my unsaved wording",
    );
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("clearing then explicitly removing a goal preserves its siblings on later saves and after reopening", async () => {
  const f = await coachingFixture(),
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", {
        title: "Keep sibling goals",
        start: "2026-10-01",
        end: "2027-03-31",
        sections: [
          {
            kind: "normal",
            objective: "Help engineers investigate failures",
            goals: [
              "Remove this goal",
              "Keep the second goal",
              "Keep the third goal",
            ],
          },
        ],
      })
    ).json();
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .locator(".read-goal")
      .first()
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page.getByLabel("SMART goal", { exact: true }).fill("");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .locator(".read-goal")
      .first()
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const readGoals = async () =>
      (await (await f.request("member", "/api/focuses/" + saved.id)).json())
        .sections[0].goals;
    assert.deepEqual(await readGoals(), [
      "Keep the second goal",
      "Keep the third goal",
    ]);
    await page.getByRole("button", { name: "Edit title & dates" }).click();
    await page.getByLabel("Document title").fill("Only change the title");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(await readGoals(), [
      "Keep the second goal",
      "Keep the third goal",
    ]);
    await page.reload();
    await page
      .getByRole("button", { name: "+ Add SMART goal", exact: true })
      .click();
    await expect(page.getByLabel("SMART goal", { exact: true })).toHaveValue(
      "",
    );
    await page
      .getByLabel("SMART goal", { exact: true })
      .fill("A new goal after reopening");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.deepEqual(await readGoals(), [
      "Keep the second goal",
      "Keep the third goal",
      "A new goal after reopening",
    ]);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("loading overlay retains input; cancellation and both-provider failure never discard it", async () => {
  const pending: import("node:http").ServerResponse[] = [];
  let failing = false;
  const failedProviders: string[] = [];
  const upstream = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    if (failing) {
      failedProviders.push(req.url!);
      res.writeHead(503).end();
    } else pending.push(res);
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const a = upstream.address();
  assert.ok(a && typeof a !== "string");
  const url = `http://127.0.0.1:${a.port}`;
  const f = await coachingFixture(
    createCoachProvider(
      {
        primary: { url, key: "x", model: "coding" },
        fallback: { url, key: "y", model: "gemini" },
        timeoutMs: 3000,
        cooldownMs: 1000,
      },
      () => {},
    ),
  );
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const saved = await (
      await f.request("member", "/api/focuses", "POST", {
        title: "Failure handling",
        start: "2026-10-01",
        end: "2027-03-31",
        sections: [],
      })
    ).json();
    await page.goto(f.origin + "/?focus=" + saved.id);
    await page
      .getByRole("button", { name: "Add objective", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    const input = page.getByLabel("Your work", { exact: true });
    await input.fill("Private investigation of build failures.");
    const before = await input.boundingBox();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    assert.deepEqual(await input.boundingBox(), before);
    await expect(input).toBeDisabled();
    await expect.poll(() => pending.length).toBe(1);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue("Private investigation of build failures.");
    for (const response of pending)
      response.end(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: '{"ready":false,"question":"Abandoned question"}',
            },
          ],
        }),
      );
    failing = true;
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("could not reply");
    await expect(input).toHaveValue("Private investigation of build failures.");
    assert.deepEqual(failedProviders, ["/v1/messages", "/chat/completions"]);
    await expect(
      page.getByText("Abandoned question", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await expect(page.getByLabel("Objective", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await expect(input).toHaveValue("Private investigation of build failures.");
    await page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await page
      .getByLabel("Objective", { exact: true })
      .fill("Investigate build failures manually");
    await page.getByRole("checkbox", { name: "Other — none of these apply" }).check();
    await page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Failure handling", exact: true }),
    ).toBeVisible();
    const result = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(result.version, saved.version + 1);
    assert.equal(
      result.sections[0].objective,
      "Investigate build failures manually",
    );
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
    upstream.closeAllConnections();
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});

test("a note being composed stays bound to the request the lead actually read", async () => {
  const { draft } = await import("./coach-test-support.js");
  const f = await coachingFixture(),
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const focus = await (
        await f.request("member", "/api/focuses", "POST", draft)
      ).json(),
      path = "/api/coach/focuses/" + focus.id;
    await f.request("member", path + "/request", "POST", { version: 1 });
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "lead", url: f.origin },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(f.origin + "/?page=reviews");
    await page
      .getByRole("button", { name: "Review focus", exact: true })
      .click();
    await page.getByRole("button", { name: "+ Add note", exact: true }).click();
    await page
      .getByLabel("Add a note", { exact: true })
      .fill("About the first draft");
    await page.getByLabel("We have discussed and agreed this focus.").check();
    const updated = await f.request(
      "member",
      "/api/focuses/" + focus.id,
      "PUT",
      {
        ...draft,
        title: "New version",
        version: 1,
      },
    );
    assert.equal(updated.status, 200);
    assert.equal(
      (await f.request("member", path + "/request", "POST", { version: 2 }))
        .status,
      200,
    );
    await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await page
      .getByText("Draft 2", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Confirm focus", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("review changed");
    await expect(page.getByLabel("Add a note", { exact: true })).toHaveValue(
      "About the first draft",
    );
    assert.equal(
      (await (await f.request("lead", path)).json()).notes.length,
      0,
    );
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
