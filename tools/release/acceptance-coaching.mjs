import assert from "node:assert/strict";
import { expect } from "@playwright/test";

// Ordinary authenticated routes; the enclosing fixture owns synthetic cleanup.
export async function runCoachingJourney({ context, origin, runId, enabled }) {
  const page = await context.newPage();
  const title = `Synthetic coaching ${runId}`;
  await page.goto(origin + "/");
  await page
    .getByRole("button", { name: "New position focus", exact: true })
    .click();
  await page.getByLabel("Document title").fill(title);
  await page.getByLabel("Period starts").fill("2026-10-01");
  await page.getByLabel("Period ends").fill("2027-03-31");
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
  await page
    .getByRole("button", { name: "Add objective", exact: true })
    .click();
  if (enabled) {
    await page
      .getByRole("button", { name: "Guide with AI", exact: true })
      .click();
    await page
      .getByLabel("Your work", { exact: true })
      .fill(
        "I maintain a synthetic build diagnostics tool for engineers. I can review three failed builds with them and record which troubleshooting steps help.",
      );
    const next = page.getByRole("button", { name: "Next", exact: true });
    await modelTurn(next);
    const objectiveField = page.getByLabel("Objective", { exact: true }),
      answer = page.getByLabel("Your answer", { exact: true });
    for (let turn = 0; turn < 3; turn++) {
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
  const objective = await page
    .getByLabel("Objective", { exact: true })
    .inputValue();
  let goal;
  if (enabled) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await modelTurn(
      page.getByRole("button", { name: "Add SMART goal", exact: true }),
    );
    const targetDate = new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    await page.getByLabel("Target date", { exact: true }).fill(targetDate);
    await page.getByRole("radio").first().check();
    await expect(page.getByLabel("Target date", { exact: true })).toHaveValue(
      targetDate,
    );
    await modelTurn(page.getByRole("button", { name: "Next", exact: true }));
    goal = await page.getByLabel("SMART goal", { exact: true }).inputValue();
    assert.ok(goal.trim());
    await page
      .getByRole("button", { name: "Add to objective", exact: true })
      .click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Check objective", exact: true }),
    ).toBeVisible();
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
    .getByRole("button", { name: "Review position focus", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review position focus", exact: true }),
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
