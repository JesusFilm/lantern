import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect, type Locator, type Page } from "@playwright/test";
import { createServer } from "vite";
import { coachingFixture, draft } from "./coach-test-support.js";

async function browserFixture() {
  const f = await coachingFixture();
  const vite = await createServer({ server: { middlewareMode: { server: f.server }, hmr: { server: f.server } }, appType: "spa" });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  return {
    ...f,
    async page(actor: "member" | "lead") {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      await context.addCookies([{ name: "lantern-session", value: actor, url: f.origin }]);
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      return page;
    },
    async close() {
      await browser.close();
      await vite.close();
      await f.close();
    },
  };
}

async function openRequest(page: Page, origin: string, id: string) {
  await page.goto(`${origin}/?focus=${id}`);
  await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
  return page.getByRole("region", { name: "Request review", exact: true });
}

async function blocked(form: Locator, reason: string) {
  const button = form.getByRole("button", { name: /Send request|Send changes for review|Review requested/, exact: true });
  await expect(button).toBeDisabled();
  await expect(form.locator("#review-note")).toBeDisabled();
  await expect(button).toHaveAccessibleDescription(reason);
  await expect(form.locator("#review-note")).toHaveAccessibleDescription(reason);
  const hint = form.getByText(reason, { exact: true });
  await expect(hint).toBeVisible();
  await expect(button).toHaveAttribute("title", reason);
  return { button, hint };
}

test("missing Contribution content keeps the request form visible with an adjacent reason on desktop and phones", async () => {
  const f = await browserFixture();
  try {
    for (const actor of ["member", "lead"] as const) {
      const page = await f.page(actor);
      for (const sections of [[], [{ ...draft.sections[0], goals: [] }], [{ ...draft.sections[0], kind: "personal-development" }]]) {
        const created = await f.request(actor, "/api/focuses", "POST", { ...draft, sections });
        assert.equal(created.status, 201);
        const focus = await created.json();
        const form = await openRequest(page, f.origin, focus.id);
        await expect(form.getByLabel(actor === "lead" ? "Review note · optional" : "Note to career lead · optional")).toBeVisible();
        for (const width of [1440, 320, 390]) {
          await page.setViewportSize({ width, height: 900 });
          const { button, hint } = await blocked(form, "Add a Contribution objective with at least one SMART goal before requesting review.");
          const actionBox = await button.boundingBox(), hintBox = await hint.boundingBox();
          assert.ok(actionBox && hintBox);
          if (width === 1440) {
            assert.ok(actionBox.x - hintBox.x - hintBox.width >= 15, "Hint sits left of Send with a 16px gap");
            assert.ok(hintBox.y < actionBox.y + actionBox.height && actionBox.y < hintBox.y + hintBox.height);
          } else {
            assert.ok(actionBox.y - hintBox.y - hintBox.height >= 15, "Phone hint wraps above Send with a 16px gap");
            assert.ok(Math.abs(actionBox.width - hintBox.width) <= 1, "Phone Send fills the hint row width");
          }
          assert.ok(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"));
        }
        assert.equal((await f.request(actor, `/api/coach/focuses/${focus.id}/request`, "POST", { version: focus.version })).status, 400);
        const saved = await (await f.request(actor, `/api/coach/focuses/${focus.id}`)).json();
        assert.deepEqual(saved.requests, []);
        assert.deepEqual(saved.notes, []);
      }
      await page.close();
    }
  } finally {
    await f.close();
  }
});

test("stale, already requested and locked versions disable note entry without erasing an unsent note", async () => {
  const f = await browserFixture();
  try {
    const created = await f.request("member", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const focus = await created.json();
    const path = `/api/coach/focuses/${focus.id}`;
    const stalePage = await f.page("member");
    const staleForm = await openRequest(stalePage, f.origin, focus.id);
    await staleForm.locator("#review-note").fill("Keep my note about the displayed draft");
    assert.equal((await f.request("member", `/api/focuses/${focus.id}`, "PUT", { ...draft, title: "A newer saved focus", version: focus.version })).status, 200);
    await stalePage.evaluate("window.dispatchEvent(new Event('focus'))");
    await blocked(staleForm, "This focus has changed. Return to the focus and reload before requesting review.");
    await expect(staleForm.locator("#review-note")).toHaveValue("Keep my note about the displayed draft");
    const recover = staleForm.getByText("Copy unsent note", { exact: true });
    await recover.focus();
    await stalePage.keyboard.press("Enter");
    await stalePage.keyboard.press("Tab");
    const retained = staleForm.getByLabel("Unsent note · select and copy", { exact: true });
    await expect(retained).toBeFocused();
    await expect(retained).toHaveAttribute("readonly", "");
    assert.equal(await retained.evaluate((el: { value: string; selectionStart: number; selectionEnd: number }) => el.value.slice(el.selectionStart, el.selectionEnd)), "Keep my note about the displayed draft");
    await recover.click();


    const page = await f.page("member");
    const form = await openRequest(page, f.origin, focus.id);
    await form.locator("#review-note").fill("Keep this note if another window sends first");
    assert.equal((await f.request("member", path + "/request", "POST", { version: focus.version + 1 })).status, 200);
    await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await blocked(form, "Review has already been requested for this saved version. You can add a note in Review discussion.");
    await expect(form.locator("#review-note")).toHaveValue("Keep this note if another window sends first");

    assert.equal((await f.request("lead", path + "/confirm", "POST", { version: focus.version + 1 })).status, 200);
    await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await blocked(form, "This focus is confirmed and locked. No further review requests can be sent.");
    await expect(form.locator("#review-note")).toHaveValue("Keep this note if another window sends first");
    const saved = await (await f.request("member", path)).json();
    assert.equal(saved.focus.status, "confirmed");
    assert.equal(saved.requests.length, 1);
    assert.deepEqual(saved.notes, []);
  } finally {
    await f.close();
  }
});

test("sending explains the busy state, a failed request preserves its note, and later saved changes can be sent without a note", async () => {
  const f = await browserFixture();
  let releaseFailure = () => {};
  try {
    for (const actor of ["member", "lead"] as const) {
      const created = await f.request(actor, "/api/focuses", "POST", draft);
      assert.equal(created.status, 201);
      const focus = await created.json();
      const path = `/api/coach/focuses/${focus.id}`;
      const page = await f.page(actor);
      const form = await openRequest(page, f.origin, focus.id);
      const note = form.getByLabel(actor === "lead" ? "Review note · optional" : "Note to career lead · optional");
      const send = form.getByRole("button", { name: "Send request", exact: true });
      await expect(note).toBeEnabled();
      await expect(send).toBeEnabled();
      await note.fill("Please keep this note for retry");
      const failedResponse = new Promise<void>(resolve => { releaseFailure = resolve; });
      // Hold a transport failure at the browser's HTTP boundary; retries use the real server.
      await page.route("**" + path + "/request", async route => {
        await failedResponse;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Review temporarily unavailable." }) });
      });
      await send.click();
      await blocked(form, "Sending your review request. Please wait.");
      await expect(note).toHaveValue("Please keep this note for retry");
      releaseFailure();
      await expect(page.getByRole("alert")).toContainText("Review temporarily unavailable.");
      await expect(note).toBeEnabled();
      await expect(send).toBeEnabled();
      await expect(note).toHaveValue("Please keep this note for retry");
      assert.deepEqual((await (await f.request(actor, path)).json()).requests, []);
      await page.unroute("**" + path + "/request");
      await send.click();
      await expect(page.getByText("Please keep this note for retry", { exact: true })).toBeVisible();

      await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
      await page.getByRole("button", { name: draft.title, exact: true }).click();
      await page.getByRole("button", { name: "Edit title & dates", exact: true }).click();
      await page.getByRole("dialog").getByRole("textbox", { name: "Document title", exact: true }).fill("Ready to resend my saved changes");
      await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
      await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      await expect(note).toBeEnabled();
      await expect(note).toHaveValue("");
      const resend = form.getByRole("button", { name: "Send changes for review", exact: true });
      await expect(resend).toBeEnabled();
      await resend.click();
      await expect(page.getByRole("heading", { name: "Review discussion", exact: true })).toBeVisible();
      const saved = await (await f.request(actor, path)).json();
      assert.deepEqual(saved.requests.map((r: { document: { version: number; title: string } }) => [r.document.version, r.document.title]), [
        [focus.version, draft.title], [focus.version + 1, "Ready to resend my saved changes"],
      ]);
      assert.deepEqual(saved.notes.map((n: { body: string }) => n.body), ["Please keep this note for retry"]);
      for (const other of ["peer", "outsider"]) {
        assert.equal((await f.request(other, path)).status, 404);
        assert.equal((await f.request(other, path + "/request", "POST", { version: focus.version + 1, note: "Not mine" })).status, 404);
      }
      await page.reload();
      await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      await blocked(form, "Review has already been requested for this saved version. You can add a note in Review discussion.");
      await expect(note).toHaveValue("");
      await page.close();
    }
  } finally {
    releaseFailure();
    await f.close();
  }
});


test("saving a Contribution makes a development-only focus ready for review", async () => {
  const f = await browserFixture();
  try {
    for (const actor of ["member", "lead"] as const) {
      const focus = await (await f.request(actor, "/api/focuses", "POST", {
        ...draft, sections: [{ ...draft.sections[0], kind: "personal-development", alignment: { initiatives: [], other: true } }],
      })).json();
      const page = await f.page(actor);
      const form = await openRequest(page, f.origin, focus.id);
      await blocked(form, "Add a Contribution objective with at least one SMART goal before requesting review.");
      await page.getByRole("button", { name: "← Position focuses", exact: true }).click();
      await page.getByRole("button", { name: draft.title, exact: true }).click();
      await page.getByRole("button", { name: "Edit objective", exact: true }).click();
      await page.getByRole("radio", { name: "Contribution", exact: true }).check();
      await page.getByRole("button", { name: "Save objective", exact: true }).click();
      await page.getByRole("button", { name: "Review & discussion", exact: true }).click();
      await expect(form.locator("#review-note")).toBeEnabled();
      await expect(form.locator("#review-note")).toHaveValue("");
      await form.getByRole("button", { name: "Send request", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Review discussion", exact: true })).toBeVisible();
      const saved = await (await f.request(actor, `/api/coach/focuses/${focus.id}`)).json();
      assert.equal(saved.focus.status, "draft");
      assert.equal(saved.requests.length, 1);
      assert.equal(saved.requests[0].document.sections[0].kind, "normal");
      assert.deepEqual(saved.notes, []);
      await page.close();
    }
  } finally { await f.close(); }
});
