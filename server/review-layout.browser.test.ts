import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, expect, type Page } from "@playwright/test";
import { createServer } from "vite";
import type { PositionFocus } from "../shared/focus.js";
import { coachingFixture } from "./coach-test-support.js";

test("member and lead read the same objective hierarchy while requested versions stay read-only", async () => {
  const f = await coachingFixture({
    async suggest() {
      throw new Error("Reading a focus must not request AI suggestions");
    },
  });
  const vite = await createServer({
    server: { middlewareMode: { server: f.server }, hmr: { server: f.server } },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const created = await f.request("member", "/api/focuses", "POST", {
      title: "A clearly structured focus",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [
        {
          kind: "normal",
          objective: "Help engineers diagnose failed builds",
          goals: [
            "Review three failed builds",
            "Try clearer messages with two engineers",
          ],
          alignment: { initiatives: [], other: true },
        },
        {
          kind: "personal-development",
          objective: "Build confidence in interviews",
          goals: ["Practise two interviews"],
        },
        {
          kind: "leadership",
          objective: "Support new facilitators",
          goals: [],
        },
      ],
    });
    assert.equal(created.status, 201);
    const source = (await created.json()) as PositionFocus;
    const memberContext = await browser.newContext();
    await memberContext.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const member = await memberContext.newPage();
    member.setDefaultTimeout(5000);

    async function assertDocument(page: Page, editable: boolean) {
      const first = page.getByRole("region", {
        name: "Objective 1",
        exact: true,
      });
      const second = page.getByRole("region", {
        name: "Objective 2",
        exact: true,
      });
      const third = page.getByRole("region", {
        name: "Objective 3",
        exact: true,
      });
      await expect(
        first.getByRole("heading", {
          name: "Objective 1",
          level: 2,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        first.getByText("Contribution", { exact: true }),
      ).toBeVisible();
      await expect(first).toContainText(
        "Help engineers diagnose failed builds",
      );
      await expect(first).toContainText("Other — none of these apply");
      await expect(
        first
          .getByRole("list", { name: "SMART goals", exact: true })
          .getByRole("listitem"),
      ).toContainText([
        "Review three failed builds",
        "Try clearer messages with two engineers",
      ]);
      await expect(
        second.getByText("Personal development", { exact: true }),
      ).toBeVisible();
      await expect(
        second
          .getByRole("list", { name: "SMART goals", exact: true })
          .getByRole("listitem"),
      ).toContainText("Practise two interviews");
      await expect(
        third.getByText("Leadership", { exact: true }),
      ).toBeVisible();
      await expect(
        third.getByText("No goals yet.", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByText("1 Oct 2026 – 31 Mar 2027", { exact: true })
          .filter({ visible: true }),
      ).toHaveCount(1);
      await expect(
        first.getByRole("button", { name: "Edit objective", exact: true }),
      ).toHaveCount(editable ? 1 : 0);
      await expect(
        first.getByRole("button", { name: "Guide with AI", exact: true }),
      ).toHaveCount(editable ? 1 : 0);
      await expect(
        first
          .getByRole("list", { name: "SMART goals", exact: true })
          .getByRole("button", { name: /AI|Coach/ }),
      ).toHaveCount(0);
      await expect(
        first.getByRole("button", { name: "+ Add SMART goal", exact: true }),
      ).toHaveCount(editable ? 1 : 0);
    }

    await member.goto(f.origin + "/?focus=" + source.id);
    await assertDocument(member, true);
    await member
      .getByRole("button", { name: "Review & discussion", exact: true })
      .click();
    await assertDocument(member, true);
    await member
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(
      member.getByText("Review requested · Draft 1", { exact: true }),
    ).toBeVisible();
    await assertDocument(member, true);

    const leadContext = await browser.newContext();
    await leadContext.addCookies([
      { name: "lantern-session", value: "lead", url: f.origin },
    ]);
    const lead = await leadContext.newPage();
    lead.setDefaultTimeout(5000);
    await lead.goto(
      f.origin +
        "/?page=department&member=" +
        f.ids.member +
        "&memberFocus=" +
        source.id,
    );
    await assertDocument(lead, false);
    await lead.goto(f.origin + "/?page=reviews");
    await lead
      .getByRole("button", { name: "Review focus", exact: true })
      .click();
    await assertDocument(lead, false);

    const changed = await f.request(
      "member",
      "/api/focuses/" + source.id,
      "PUT",
      {
        title: source.title,
        start: source.start,
        end: source.end,
        version: source.version,
        sections: [
          { ...source.sections[0], objective: "Unsent objective changes" },
          ...source.sections.slice(1),
        ],
      },
    );
    assert.equal(changed.status, 200);
    await lead.evaluate("window.dispatchEvent(new Event('focus'))");
    await expect(
      lead.getByText("Newer saved changes have not been sent", { exact: true }),
    ).toBeVisible();
    await assertDocument(lead, false);
    await lead
      .getByRole("checkbox", {
        name: "We have discussed and agreed this focus.",
        exact: true,
      })
      .check();
    await expect(
      lead.getByRole("button", { name: "Confirm focus", exact: true }),
    ).toBeDisabled();
    const record = await (
      await f.request("lead", "/api/coach/focuses/" + source.id)
    ).json();
    assert.deepEqual(record.requests[0].document.sections, source.sections);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});

test("review shows the document title and only compares versions with content changes", async () => {
  const f = await coachingFixture();
  const vite = await createServer({
    server: { middlewareMode: { server: f.server }, hmr: { server: f.server } },
    appType: "spa",
  });
  f.app.use(vite.middlewares);
  const browser = await chromium.launch();
  try {
    const draft = {
      title: "A named focus for discussion",
      start: "2026-10-01",
      end: "2027-03-31",
      sections: [
        {
          kind: "normal",
          objective: "Improve build diagnostics",
          goals: ["Review three failed builds"],
        },
      ],
    };
    const created = await f.request("member", "/api/focuses", "POST", draft);
    assert.equal(created.status, 201);
    const source = await created.json();
    const path = "/api/coach/focuses/" + source.id;
    assert.equal(
      (await f.request("member", path + "/request", "POST", { version: 1 }))
        .status,
      200,
    );
    assert.equal(
      (
        await f.request("member", "/api/focuses/" + source.id, "PUT", {
          ...draft,
          version: 1,
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request("member", path + "/request", "POST", { version: 2 }))
        .status,
      200,
    );
    const memberContext = await browser.newContext();
    await memberContext.addCookies([
      { name: "lantern-session", value: "member", url: f.origin },
    ]);
    const member = await memberContext.newPage();
    member.setDefaultTimeout(5000);
    await member.goto(f.origin + "/?focus=" + source.id);
    await member
      .getByRole("button", { name: "Review & discussion", exact: true })
      .click();
    await expect(
      member.getByRole("heading", {
        name: "Request review",
        exact: true,
      }),
    ).toBeVisible();
    await expect(member.getByText(draft.title, { exact: true })).toBeVisible();
    await expect(
      member.getByRole("heading", {
        name: "Changes since previous request",
        exact: true,
      }),
    ).toHaveCount(0);
    const leadContext = await browser.newContext();
    await leadContext.addCookies([
      { name: "lantern-session", value: "lead", url: f.origin },
    ]);
    const lead = await leadContext.newPage();
    lead.setDefaultTimeout(5000);
    await lead.goto(f.origin + "/?page=reviews");
    await lead
      .getByRole("button", { name: "Review focus", exact: true })
      .click();
    await expect(
      lead.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    await expect(
      lead.getByRole("heading", {
        name: "Changes since previous request",
        exact: true,
      }),
    ).toHaveCount(0);
    assert.equal(
      (
        await f.request("member", "/api/focuses/" + source.id, "PUT", {
          ...draft,
          title: "An unsent new title",
          version: 2,
        })
      ).status,
      200,
    );
    await lead.evaluate("window.dispatchEvent(new Event('focus'))");
    await expect(
      lead.getByText("Newer saved changes have not been sent", { exact: true }),
    ).toBeVisible();
    await expect(
      lead.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    await member.evaluate("window.dispatchEvent(new Event('focus'))");
    await expect(
      member.getByRole("heading", {
        name: "Changes since previous request",
        exact: true,
      }),
    ).toBeVisible();
    await expect(member.getByRole("alert")).toContainText("This focus has changed");
    await expect(member.getByRole("button", { name: "Send changes for review" })).toBeDisabled();
    await member
      .getByRole("button", { name: "Review discussion", exact: true })
      .click();
    await expect(
      member.getByRole("heading", { name: draft.title, exact: true }),
    ).toBeVisible();
    await expect(
      member.getByRole("heading", { name: "An unsent new title", exact: true }),
    ).toHaveCount(0);
  } finally {
    await browser.close();
    await vite.close();
    await f.close();
  }
});
