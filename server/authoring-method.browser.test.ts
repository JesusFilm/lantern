import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, draft } from "./coach-test-support.js";

async function browserFixture(coach?: Parameters<typeof coachingFixture>[0]) {
  const f = await coachingFixture(coach),
    vite = await createServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa",
    });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch(),
    context = await browser.newContext();
  await context.addCookies([
    { name: "lantern-session", value: "member", url: f.origin },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  return {
    ...f,
    page,
    async close() {
      await browser.close();
      await vite.close();
      await f.close();
    },
  };
}
test("manual goal editing is a compact form without competing writing or coaching controls", async () => {
  const f = await browserFixture();
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .locator(".read-goal")
      .first()
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await expect(
      f.page.getByRole("button", { name: /writing help/i }),
    ).toHaveCount(0);
    await expect(
      f.page.getByText(
        "What will you do, what evidence will show progress, and by when?",
        { exact: true },
      ),
    ).toHaveCount(0);
    await f.page
      .getByLabel("SMART goal", { exact: true })
      .fill("Review two build failures with engineers.");
    await f.page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(f.page.getByRole("dialog")).toHaveCount(0);
    const actual = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(
      actual.sections[0].goals[0],
      "Review two build failures with engineers.",
    );
    assert.equal(actual.sections[0].objective, draft.sections[0]!.objective);
  } finally {
    await f.close();
  }
});

test("manual objective authoring saves its goals once and preserves the rest of the focus", async () => {
  const f = await browserFixture({
    async suggest() {
      throw new Error("Manual authoring must not call AI");
    },
  });
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .getByRole("button", { name: "+ Add objective", exact: true })
      .click();
    await f.page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await f.page
      .getByLabel("Objective", { exact: true })
      .fill("Build confidence in interviews");
    await f.page
      .getByRole("radio", { name: "Personal development", exact: true })
      .check();
    await f.page
      .getByRole("button", { name: "Add SMART goal", exact: true })
      .click();
    await f.page
      .getByLabel("SMART goal 1", { exact: true })
      .fill("Practise two interviews with a colleague.");
    await f.page
      .getByRole("button", { name: "Add SMART goal", exact: true })
      .click();
    await f.page
      .getByLabel("SMART goal 2", { exact: true })
      .fill("Review feedback after each interview.");
    await f.page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(
      f.page.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    const actual = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(actual.version, saved.version + 1);
    assert.deepEqual(actual.sections[0], saved.sections[0]);
    assert.equal(actual.sections[1].kind, "personal-development");
    assert.deepEqual(actual.sections[1].goals, [
      "Practise two interviews with a colleague.",
      "Review feedback after each interview.",
    ]);
  } finally {
    await f.close();
  }
});

test("AI guides one objective with several goals and saves it once without suggestion or progress states", async () => {
  const calls: string[] = [];
  const f = await browserFixture({
    async suggest(_system, context, validate) {
      const { stage, context: c } = JSON.parse(context);
      calls.push(stage);
      if (stage === "clarify")
        return validate({
          ready: true,
          objective: "Help colleagues diagnose build failures",
          recommendedKind: "normal",
          initiativeIds: [],
        });
      if (stage === "actions")
        return validate({
          actions: ["Review two failed builds", "Test clearer messages"],
          suggestedDate: "2026-11-30",
        });
      if (stage === "goal")
        return validate({
          goal: `By 30 November 2026, ${c.action.toLowerCase()} and record what helped.`,
        });
      throw new Error(stage);
    },
  });
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .getByRole("button", { name: "+ Add objective", exact: true })
      .click();
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await f.page
      .getByLabel("Your work", { exact: true })
      .fill(
        "I maintain build diagnostics and help engineers find failed builds.",
      );
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.page.getByRole("dialog")).toBeHidden();
    await expect(f.page.getByLabel("Objective", { exact: true })).toHaveValue(
      "Help colleagues diagnose build failures",
    );
    await expect(
      f.page.getByText("(recommended)", { exact: true }),
    ).toBeVisible();
    await expect(
      f.page.getByRole("button", {
        name: /Suggest wording|Use suggestion|Save progress|Resume coaching|Discard saved coaching/,
      }),
    ).toHaveCount(0);
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    for (const action of [
      "Review two failed builds",
      "Test clearer messages",
    ]) {
      await f.page
        .getByRole("button", { name: "Add SMART goal", exact: true })
        .click();
      await expect(f.page.getByRole("dialog")).toBeHidden();
      await f.page.getByRole("radio", { name: action, exact: true }).check();
      await f.page
        .getByLabel("Target date", { exact: true })
        .fill("2026-11-30");
      await f.page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(f.page.getByRole("dialog")).toBeHidden();
      await expect(
        f.page.getByLabel("SMART goal", { exact: true }),
      ).toContainText("By 30 November");
      await expect(f.page.locator(".goal-parent")).toContainText(
        "Help colleagues diagnose build failures",
      );
      await expect(f.page.locator(".goal-parent .badge")).toHaveText(
        "Contribution",
      );
      await f.page
        .getByRole("button", { name: "Add to objective", exact: true })
        .click();
    }
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      f.page.getByRole("heading", { name: "Check objective", exact: true }),
    ).toBeVisible();
    assert.equal(
      (await (await f.request("member", "/api/focuses/" + saved.id)).json())
        .version,
      saved.version,
    );
    await f.page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(
      f.page.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    const actual = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(actual.version, saved.version + 1);
    assert.equal(actual.sections[1].goals.length, 2);
    assert.deepEqual(actual.sections[0], saved.sections[0]);
    assert.deepEqual(calls, ["clarify", "actions", "goal", "actions", "goal"]);
    assert.equal(
      (
        await (
          await f.request("member", "/api/coach/focuses/" + saved.id)
        ).json()
      ).checkpoint,
      null,
    );
  } finally {
    await f.close();
  }
});

test("switching between manual and guided keeps existing wording, goals, type and alignment; cancel saves nothing", async () => {
  const calls: string[] = [];
  const f = await browserFixture({
    async suggest(_system, context, validate) {
      const { stage } = JSON.parse(context);
      calls.push(stage);
      return validate({
        actions: ["Ask a colleague for feedback", "Practise an interview"],
        suggestedDate: "2026-12-01",
      });
    },
  });
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", {
        ...draft,
        sections: [
          {
            ...draft.sections[0],
            kind: "leadership",
            alignment: { initiatives: [], other: true },
            goals: ["Pair on two workshops", "Review facilitator feedback"],
          },
        ],
      })
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await expect(
      f.page.getByText(saved.sections[0].objective, { exact: true }),
    ).toBeVisible();
    await f.page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await expect(
      f.page.getByRole("radio", { name: "Leadership", exact: true }),
    ).toBeChecked();
    await expect(
      f.page.getByRole("checkbox", {
        name: "Other — none of these apply",
        exact: true,
      }),
    ).toBeChecked();
    await expect(
      f.page.getByLabel("SMART goal 2", { exact: true }),
    ).toHaveValue("Review facilitator feedback");
    await f.page
      .getByRole("checkbox", {
        name: "Other — none of these apply",
        exact: true,
      })
      .uncheck();
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await expect(
      f.page.getByText("Other — none of these apply", { exact: true }),
    ).toHaveCount(0);
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await f.page
      .getByRole("button", { name: "Add SMART goal", exact: true })
      .click();
    await expect(f.page.getByRole("dialog")).toBeHidden();
    await f.page
      .getByRole("radio", { name: "Ask a colleague for feedback", exact: true })
      .check();
    await f.page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await expect(
      f.page.getByLabel("SMART goal 3", { exact: true }),
    ).toHaveValue(/Ask a colleague for feedback/);
    f.page.once("dialog", (d) => void d.accept());
    await f.page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      f.page.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    assert.deepEqual(
      await (await f.request("member", "/api/focuses/" + saved.id)).json(),
      saved,
    );
    assert.deepEqual(calls, ["actions"]);
  } finally {
    await f.close();
  }
});

test("guided Back and method switching retain an unfinished answer and current step", async () => {
  let requests = 0;
  const f = await browserFixture({
    async suggest(_s, input, validate) {
      requests++;
      const { context } = JSON.parse(input);
      return validate(
        context.answers.length
          ? {
              ready: true,
              objective: "Help engineers understand builds",
              initiativeIds: [],
            }
          : {
              ready: false,
              question: "Who benefits from this work?",
              options: ["Engineers", "Support"],
            },
      );
    },
  });
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .getByRole("button", { name: "+ Add objective", exact: true })
      .click();
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await f.page
      .getByLabel("Your work", { exact: true })
      .fill("I maintain builds");
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.page.getByRole("dialog")).toBeHidden();
    await f.page
      .getByLabel("Your answer", { exact: true })
      .fill("Engineers who encounter failed builds");
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.page.getByLabel("Your answer", { exact: true })).toHaveValue(
      "Engineers who encounter failed builds",
    );
    await f.page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await expect(f.page.getByLabel("Your answer", { exact: true })).toHaveValue(
      "Engineers who encounter failed builds",
    );
    assert.equal(requests, 1);
  } finally {
    await f.close();
  }
});

test("existing objective guidance asks for a focused improvement and preserves its type, alignment and goals", async () => {
  const calls: any[] = [];
  const f = await browserFixture({
    async suggest(_s, input, validate) {
      const data = JSON.parse(input);
      calls.push(data);
      return validate({
        objective: "Help engineers diagnose build failures confidently",
        recommendedKind: "leadership",
        initiativeIds: [],
      });
    },
  });
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", {
        ...draft,
        sections: [
          { ...draft.sections[0], alignment: { other: true, initiatives: [] } },
        ],
      })
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await f.page
      .getByLabel("What would you like to improve about this objective?")
      .fill("Make the benefit to engineers clearer");
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.page.getByLabel("Objective", { exact: true })).toHaveValue(
      "Help engineers diagnose build failures confidently",
    );
    await expect(
      f.page.getByRole("radio", { name: "Contribution", exact: true }),
    ).toBeChecked();
    await expect(
      f.page.getByRole("checkbox", {
        name: "Other — none of these apply",
        exact: true,
      }),
    ).toBeChecked();
    assert.equal(calls[0].stage, "objective");
    assert.equal(
      calls[0].context.concern,
      "Make the benefit to engineers clearer",
    );
    await f.page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(
      f.page.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    const actual = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.deepEqual(actual.sections[0].goals, saved.sections[0].goals);
    assert.deepEqual(actual.sections[0].alignment, saved.sections[0].alignment);
  } finally {
    await f.close();
  }
});

test("changing a plan uses the current action and date, never stale generated wording", async () => {
  const f = await browserFixture({
    async suggest(_s, input, validate) {
      const { stage, context: c } = JSON.parse(input);
      return validate(
        stage === "actions"
          ? {
              actions: ["Review build failures", "Interview engineers"],
              suggestedDate: "2026-11-30",
            }
          : {
              goal: `By ${c.date === "2026-12-15" ? "15 December" : "30 November"} 2026, ${c.action}.`,
            },
      );
    },
  });
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await f.page
      .getByRole("button", { name: "Add SMART goal", exact: true })
      .click();
    await f.page
      .getByRole("radio", { name: "Review build failures", exact: true })
      .check();
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await f.page
      .getByLabel("SMART goal", { exact: true })
      .fill("Review build failures by 30 November 2026, with a colleague.");
    await expect(f.page.getByLabel("Target date", { exact: true })).toHaveCount(
      0,
    );
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page.getByLabel("Target date", { exact: true }).fill("2026-12-15");
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.page.getByLabel("SMART goal", { exact: true })).toHaveValue(
      "By 15 December 2026, Review build failures.",
    );
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page
      .getByLabel("Action", { exact: true })
      .fill("Interview two engineers");
    await f.page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await expect(
      f.page.getByLabel("SMART goal 2", { exact: true }),
    ).toHaveValue("By 15 December 2026, Interview two engineers");
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await expect(
      f.page.getByLabel("SMART goal 2", { exact: true }),
    ).toHaveValue("By 15 December 2026, Interview two engineers");
  } finally {
    await f.close();
  }
});

test("switching after changing a plan explicitly preserves or replaces member-edited goal wording", async () => {
  const f = await browserFixture({
    async suggest(_s, input, validate) {
      const { stage } = JSON.parse(input);
      return validate(
        stage === "actions"
          ? {
              actions: ["Review failed builds", "Interview engineers"],
              suggestedDate: "2026-11-30",
            }
          : { goal: "By 30 November 2026, review failed builds." },
      );
    },
  });
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    await f.page.goto(f.origin + "/?focus=" + saved.id);
    await f.page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await f.page
      .getByRole("button", { name: "Add SMART goal", exact: true })
      .click();
    await expect(f.page.getByRole("dialog")).toBeHidden();
    await f.page
      .getByRole("radio", { name: "Review failed builds", exact: true })
      .check();
    await f.page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(f.page.getByRole("dialog")).toBeHidden();
    const written =
      "Review failed builds with Pat and record our findings by 30 November 2026.";
    await f.page.getByLabel("SMART goal", { exact: true }).fill(written);
    await f.page.getByRole("button", { name: "Back", exact: true }).click();
    await f.page.getByLabel("Target date", { exact: true }).fill("2026-12-15");
    await f.page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    const conflict = f.page.getByRole("dialog", {
      name: "The goal’s plan changed",
      exact: true,
    });
    await expect(conflict).toContainText(written);
    await expect(conflict).toContainText(
      "By 15 December 2026, Review failed builds",
    );
    await conflict.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(f.page.getByLabel("Target date", { exact: true })).toHaveValue(
      "2026-12-15",
    );
    await f.page
      .getByRole("button", { name: "Write myself", exact: true })
      .click();
    await conflict
      .getByRole("button", { name: "Keep my wording", exact: true })
      .click();
    await expect(
      f.page.getByLabel("SMART goal 2", { exact: true }),
    ).toHaveValue(written);
    await f.page
      .getByLabel("SMART goal 2", { exact: true })
      .fill(written.replace("30 November", "15 December"));
    await f.page
      .getByRole("button", { name: "Save objective", exact: true })
      .click();
    await expect(
      f.page.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    const actual = await (
      await f.request("member", "/api/focuses/" + saved.id)
    ).json();
    assert.equal(
      actual.sections[0].goals[1],
      written.replace("30 November", "15 December"),
    );
    assert.equal(actual.sections[0].goals[0], saved.sections[0].goals[0]);
  } finally {
    await f.close();
  }
});
