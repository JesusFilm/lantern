import assert from "node:assert/strict";
import { expect } from "@playwright/test";

// Ordinary authenticated routes; the enclosing fixture owns synthetic cleanup.
export async function runCoachingJourney({ context, origin, runId, enabled, redesigned = false }) {
  const page = await context.newPage();
  let modelTurns = 0;
  // Bound every POST, including retries started by ordinary editor controls.
  await page.route("**/api/coach/suggest", async route => {
    if (route.request().method() === "POST" && ++modelTurns > 10) {
      await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Acceptance coaching turn limit reached." }) });
    } else await route.continue();
  });
  const title = `Synthetic coaching ${runId}`;
  await page.goto(origin + "/");
  await page
    .getByRole("button", { name: "New position focus", exact: true })
    .click();
  await page.getByLabel("Document title").fill(title);
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Period starts").fill(today);
  await page.getByLabel("Period ends").fill(end);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  assert.equal(typeof enabled, "boolean");
  const focusId = new URL(page.url()).searchParams.get("focus");
  assert.ok(focusId);
  async function modelTurn(button) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/coach/suggest" &&
          response.request().method() === "POST",
        { timeout: 60000 },
      ),
      button.click(),
    ]);
    assert.equal(response.status(), 200);
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 60000 });
  }
  async function answerFollowups() {
    const answer = page.getByLabel("Your answer", { exact: true });
    while (await answer.isVisible()) {
      await answer.fill("I maintain the synthetic build diagnostics tool. I can review three failed builds with engineers and record which troubleshooting steps help them find causes sooner.");
      await modelTurn(page.getByRole("button", { name: "Next", exact: true }));
    }
  }
  await page
    .getByRole("button", { name: "Add objective", exact: true })
    .click();
  if (enabled) {
    await page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    if (redesigned) await page.getByRole("radio", { name: "Contribution", exact: true }).check();
    await page
      .getByLabel("Your work", { exact: true })
      .fill(
        "I maintain a synthetic build diagnostics tool for engineers. I can review three failed builds with them and record which troubleshooting steps help.",
      );
    const next = page.getByRole("button", { name: "Next", exact: true });
    await modelTurn(next);
    const objectiveField = page.getByLabel("Objective", { exact: true }),
      answer = page.getByLabel("Your answer", { exact: true });
    if (redesigned) await answerFollowups();
    else for (let turn = 0; turn < 3; turn++) {
      await expect(objectiveField.or(answer)).toBeVisible();
      if (await objectiveField.isVisible()) break;
      await answer.fill(
        "Engineers benefit by finding failed build causes sooner. I own the messages and can review three failures with them, recording useful next steps.",
      );
      await modelTurn(next);
    }
    assert.ok((await objectiveField.inputValue()).trim());
    await page
      .getByRole("radio", { name: "Contribution", exact: true })
      .check();
  } else {
    const response = await context.request.post(origin + "/api/coach/suggest", {
      headers: { Origin: origin },
      data: {},
      timeout: 10000,
    });
    assert.equal(response.status(), 503);
    await page
      .getByLabel("Objective", { exact: true })
      .fill("Help engineers diagnose synthetic build failures.");
  }
  await expect(
    page.getByRole("checkbox", {
      name: "Other — none of these apply",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Other — none of these apply", exact: true }).check();
  const objective = await page
    .getByLabel("Objective", { exact: true })
    .inputValue();
  let goal;
  if (enabled) {
    const next = page.getByRole("button", { name: "Next", exact: true });
    const addGoal = page.getByRole("button", { name: "Add SMART goal", exact: true });
    const feedback = page.getByRole("region", { name: "AI coach feedback" });
    // This journey checks the workflow, not model quality. When the coach answers with
    // feedback instead of goal ideas or goal wording, the synthetic member continues as a
    // member can, with Write myself, and the run notes it.
    async function writeGoalMyself(step, planned) {
      await expect(feedback).toBeVisible();
      console.log(`Coaching journey: the coach gave feedback instead of ${step}; the synthetic member wrote the goal with Write myself.`);
      await page.getByRole("button", { name: "Switch to Write myself", exact: true }).click();
      if (!planned) {
        await addGoal.click();
        await page.getByLabel("SMART goal 1", { exact: true }).fill("Review three synthetic build failures and record useful diagnostic steps.");
      }
      return page.getByLabel("SMART goal 1", { exact: true }).inputValue();
    }
    let ideas = true;
    if (redesigned) {
      await modelTurn(next);
      await answerFollowups();
      const possibleGoals = page.getByRole("heading", { name: "Possible goals", exact: true });
      await expect(possibleGoals.or(feedback).first()).toBeVisible();
      if (await possibleGoals.isVisible()) await addGoal.click();
      else {
        // Without ideas, Add SMART goal asks the coach once more.
        await modelTurn(addGoal);
        await answerFollowups();
        const targetField = page.getByLabel("Target date", { exact: true });
        await expect(targetField.or(feedback).first()).toBeVisible();
        if (!(await targetField.isVisible())) {
          ideas = false;
          goal = await writeGoalMyself("goal ideas", false);
        }
      }
    } else {
      await next.click();
      await modelTurn(addGoal);
    }
    if (ideas) {
      const targetDate = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .slice(0, 10);
      await page.getByLabel("Target date", { exact: true }).fill(targetDate);
      await page.getByRole("radio").first().check();
      await expect(page.getByLabel("Target date", { exact: true })).toHaveValue(
        targetDate,
      );
      await modelTurn(page.getByRole("button", { name: "Next", exact: true }));
      if (redesigned) await answerFollowups();
      const goalField = page.getByLabel("SMART goal", { exact: true });
      if (redesigned) await expect(goalField.or(feedback).first()).toBeVisible();
      if (redesigned && !(await goalField.isVisible())) {
        // Write myself keeps the planned action and date as an editable goal.
        goal = await writeGoalMyself("goal wording", true);
      } else {
        goal = await goalField.inputValue();
        await page
          .getByRole("button", { name: "Add to objective", exact: true })
          .click();
        await next.click();
        await expect(
          page.getByRole("heading", { name: "Check objective", exact: true }),
        ).toBeVisible();
      }
    }
    assert.ok(goal.trim());
  } else {
    await page
      .getByRole("button", { name: "Add SMART goal", exact: true })
      .click();
    goal =
      "Review three synthetic build failures and record useful diagnostic steps.";
    await page.getByLabel("SMART goal 1", { exact: true }).fill(goal);
  }
  const beforeSave = await context.request.get(
    origin + "/api/focuses/" + focusId,
    { timeout: 10000 },
  );
  assert.equal(beforeSave.status(), 200);
  assert.deepEqual((await beforeSave.json()).sections, []);
  await page
    .getByRole("button", { name: "Save objective", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText(objective, { exact: true })).toBeVisible();
  await expect(page.getByText(goal, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Review & discussion", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Request review", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect
    .poll(async () => {
      const response = await context.request.get(
        origin + "/api/coach/focuses/" + focusId,
        { timeout: 10000 },
      );
      assert.equal(response.status(), 200);
      const record = await response.json();
      assert.equal(record.focus.title, title);
      assert.equal(record.focus.version, 2);
      assert.equal(record.focus.sections.length, 1);
      assert.equal(record.focus.sections[0].objective, objective);
      assert.deepEqual(record.focus.sections[0].goals, [goal]);
      return record.requests.at(-1)?.document.sections[0]?.goals[0];
    })
    .toBe(goal);
  await page.close();
}
