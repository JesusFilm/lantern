import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
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
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(f.origin + "/?page=coach");
    await page
      .getByRole("button", { name: "Create a focus", exact: true })
      .click();
    await page
      .getByRole("textbox")
      .first()
      .fill("I work on build failures for other engineers.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Finding the next useful question" })
      .waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page
      .getByText("Review three failed builds with engineers", { exact: true })
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.locator("input[type=date]").fill("2026-12-15");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const editedGoal =
      "By 15 December 2026, review build failures and record engineers' feedback.";
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByLabel("Goal", { exact: true }).fill(editedGoal);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const { expect } = await import("@playwright/test");
    await expect(page.getByLabel("Goal", { exact: true })).toHaveValue(
      editedGoal,
    );

    await page
      .getByRole("button", { name: "Review draft", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("button", { name: "Saved", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Ask career lead to review", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Send request", exact: true })
      .click();
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
      .getByText(/^Confirmed · Draft/)
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

test("editing one coached goal preserves every other objective and goal after reload", async () => {
  const f = await coachingFixture(),
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
    await page.goto(f.origin + "/?page=coach");
    await page
      .getByRole("button", { name: "Continue draft", exact: true })
      .click();
    await page.getByLabel("Goal", { exact: true }).fill("Revised first goal");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("button", { name: "Saved", exact: true }).waitFor();
    await page.getByLabel("Objective to work on").selectOption("1");
    await page
      .getByLabel("Goal", { exact: true })
      .fill("Practise two interviews");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("button", { name: "Saved", exact: true }).waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "Continue draft", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Goal", { exact: true }).inputValue(),
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
    const { expect } = await import("@playwright/test");
    await f.request("member", "/api/focuses/" + saved.id, "PUT", {
      title: result.title,
      start: result.start,
      end: result.end,
      sections: result.sections,
      version: result.version,
    });
    await page
      .getByLabel("Goal", { exact: true })
      .fill("Keep my unsaved wording");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(
      "changed in another window",
    );
    await expect(page.getByLabel("Goal", { exact: true })).toHaveValue(
      "Keep my unsaved wording",
    );
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("loading overlay retains input; cancellation and both-provider failure never discard it", async () => {
  const pending: import("node:http").ServerResponse[] = [];
  let failing = false;
  const upstream = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    if (failing) res.writeHead(503).end();
    else pending.push(res);
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
    const { expect } = await import("@playwright/test");
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?page=coach");
    await page.getByRole("button", { name: "Create a focus" }).click();
    const input = page.getByLabel("Your project work");
    await input.fill("Private investigation of build failures.");
    const before = await input.boundingBox();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    assert.deepEqual(await input.boundingBox(), before);
    await expect(input).toBeDisabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
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
    await page.getByRole("button", { name: "Continue manually" }).click();
    await expect(page.getByLabel("Objective", { exact: true })).toBeVisible();
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
    upstream.closeAllConnections();
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});

test("a note being composed stays bound to the request the lead actually read", async () => {
  const { checkpoint, draft } = await import("./coach-test-support.js");
  const f = await coachingFixture(),
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const record = await (
        await f.request("member", "/api/coach/save", "POST", {
          draft,
          checkpoint,
        })
      ).json(),
      path = "/api/coach/focuses/" + record.focus.id;
    await f.request("member", path + "/request", "POST", { version: 1 });
    const context = await browser.newContext();
    await context.addCookies([
      { name: "lantern-session", value: "lead", url: f.origin },
    ]);
    const page = await context.newPage();
    await page.goto(f.origin + "/?page=reviews");
    await page
      .getByRole("button", { name: "Review focus", exact: true })
      .click();
    await page.getByRole("button", { name: "+ Add note", exact: true }).click();
    await page
      .getByLabel("Add a note", { exact: true })
      .fill("About the first draft");
    await page.getByLabel("We have discussed and agreed this focus.").check();
    await f.request("member", "/api/coach/save", "POST", {
      id: record.focus.id,
      version: 1,
      draft: { ...draft, title: "New version" },
      checkpoint,
    });
    await f.request("member", path + "/request", "POST", { version: 2 });
    await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await page
      .getByText("Review requested · Draft 2", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Add note", exact: true }).click();
    const { expect } = await import("@playwright/test");
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
