import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";

import { coachingFixture, checkpoint, draft } from "./coach-test-support.js";
test("coached save is atomic, versioned, owner-only, and survives reopening", async () => {
  const f = await coachingFixture();
  try {
    const saved = await f.request("member", "/api/coach/save", "POST", {
      draft,
      checkpoint,
    });
    assert.equal(saved.status, 200);
    const r = await saved.json();
    assert.equal(r.checkpoint.work, checkpoint.work);
    const reopened = await (
      await f.request("member", "/api/coach/focuses/" + r.focus.id)
    ).json();
    assert.equal(reopened.checkpoint.sourceVersion, 1);
    const lead = await (
      await f.request("lead", "/api/coach/focuses/" + r.focus.id)
    ).json();
    assert.equal(lead.checkpoint, null);
    assert.doesNotMatch(JSON.stringify(lead), /Private project/);
    assert.equal(
      (await f.request("peer", "/api/coach/focuses/" + r.focus.id)).status,
      404,
    );
    const invalid = await f.request("member", "/api/coach/save", "POST", {
      id: r.focus.id,
      version: 1,
      draft: { ...draft, title: "Must not save" },
      checkpoint: { ...checkpoint, step: 99 },
    });
    assert.equal(invalid.status, 400);
    assert.equal(
      (await (await f.request("member", "/api/focuses/" + r.focus.id)).json())
        .title,
      draft.title,
    );
    assert.equal(
      (
        await f.request("member", "/api/coach/save", "POST", {
          id: r.focus.id,
          version: 99,
          draft,
          checkpoint,
        })
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

test("review requests freeze a version; notes are append-only, private to participants, and acknowledged explicitly", async () => {
  const f = await coachingFixture();
  try {
    const r = await (
        await f.request("member", "/api/coach/save", "POST", {
          draft,
          checkpoint,
        })
      ).json(),
      path = "/api/coach/focuses/" + r.focus.id;
    assert.equal(
      (await f.request("lead", path + "/request", "POST", { version: 1 }))
        .status,
      404,
    );
    const sent = await f.request("member", path + "/request", "POST", {
      version: 1,
      note: "Please review this first step.",
    });
    assert.equal(sent.status, 200);
    assert.equal((await sent.json()).requests[0].document.version, 1);
    const reply = await f.request("lead", path + "/notes", "POST", {
      version: 1,
      body: "Name who will review the logs.",
    });
    assert.equal(reply.status, 200);
    const n = (await reply.json()).notes.at(-1);
    assert.equal(
      (await f.request("member", path + "/notes/" + n.id, "DELETE")).status,
      403,
    );
    assert.equal(
      (
        await f.request("lead", path + "/notes/" + n.id, "PATCH", {
          body: "Edited",
        })
      ).status,
      404,
    );
    assert.equal((await f.request("outsider", path)).status, 404);
    assert.equal(
      (
        await f.request("peer", path + "/notes", "POST", {
          version: 1,
          body: "Intrusion",
        })
      ).status,
      404,
    );
    await f.request("member", path + "/read", "POST", { noteIds: [n.id] });
    const seen = await (await f.request("member", path)).json();
    assert.ok(seen.readIds.includes(n.id));
    const newer = await (
      await f.request("lead", path + "/notes", "POST", {
        version: 1,
        body: "Another thought",
      })
    ).json();
    assert.ok(!newer.readIds.includes(newer.notes.at(-1).id));
    await f.request("lead", path + "/notes/" + n.id, "DELETE");
    const removed = await (await f.request("member", path)).json();
    assert.equal(removed.notes.find((x: any) => x.id === n.id).body, "");
    assert.ok(removed.notes.find((x: any) => x.id === n.id).deletedAt);
    await f.request("member", "/api/coach/save", "POST", {
      id: r.focus.id,
      version: 1,
      draft: { ...draft, title: "Revised" },
      checkpoint,
    });
    const pending = await (await f.request("lead", path)).json();
    assert.equal(pending.requests[0].document.title, draft.title);
    assert.equal(pending.focus.title, "Revised");
    assert.equal(
      (
        await f.request(
          "lead",
          `/api/department/members/${f.ids.member}/focuses/${r.focus.id}/confirm`,
          "POST",
          { version: 2 },
        )
      ).status,
      409,
    );
    await f.request("member", path + "/request", "POST", { version: 2 });
    assert.equal(
      (await f.request("lead", path + "/confirm", "POST", { version: 2 }))
        .status,
      200,
    );
    const confirmed = await (await f.request("member", path)).json();
    assert.equal(confirmed.focus.status, "confirmed");
    assert.equal(confirmed.checkpoint, null);
    assert.equal(confirmed.requests.length, 2);
    assert.equal(
      (
        await f.request("member", "/api/coach/save", "POST", {
          id: r.focus.id,
          version: 3,
          draft,
          checkpoint,
        })
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

test("authenticated coaching validates input and provider output, uses fallback, and never exposes credentials", async () => {
  const { createCoachProvider } = await import("./coach-provider.js");
  let primaryCalls = 0,
    fallbackCalls = 0;
  const upstream = createServer((req, res) => {
    if (req.url === "/v1/messages") {
      primaryCalls++;
      res.writeHead(503).end("sensitive diagnostic");
    } else {
      fallbackCalls++;
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  objective: "Help engineers investigate failures",
                  title: "Useful logs",
                  initiativeIds: [],
                }),
              },
            },
          ],
        }),
      );
    }
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  const a = upstream.address();
  assert.ok(a && typeof a !== "string");
  const url = `http://127.0.0.1:${a.port}`;
  const coach = createCoachProvider(
    {
      primary: { url, key: "private-primary", model: "coding" },
      fallback: { url, key: "private-fallback", model: "gemini" },
      timeoutMs: 500,
      cooldownMs: 1000,
    },
    () => {},
  );
  const f = await coachingFixture(coach);
  try {
    assert.equal(
      (
        await f.request("anonymous", "/api/coach/suggest", "POST", {
          stage: "objective",
          context: checkpoint,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await f.request("member", "/api/coach/suggest", "POST", {
          stage: "hack",
          context: checkpoint,
        })
      ).status,
      400,
    );
    assert.equal(primaryCalls, 0);
    const result = await f.request("member", "/api/coach/suggest", "POST", {
      stage: "objective",
      context: checkpoint,
    });
    assert.equal(result.status, 200);
    assert.equal(
      (await result.json()).objective,
      "Help engineers investigate failures",
    );
    assert.equal(primaryCalls, 1);
    assert.equal(fallbackCalls, 1);
    const session = await (await f.request("member", "/api/session")).json();
    assert.equal(session.coachAvailable, true);
    assert.doesNotMatch(
      JSON.stringify(session),
      /private-primary|private-fallback/,
    );
    await f.admin.query(
      "UPDATE memberships SET deleted_at=now() WHERE user_id=$1",
      [f.ids.member],
    );
    assert.equal(
      (
        await f.request("member", "/api/coach/suggest", "POST", {
          stage: "objective",
          context: checkpoint,
        })
      ).status,
      403,
    );
  } finally {
    await f.close();
    upstream.closeAllConnections();
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});

test("database failure rolls back both focus and checkpoint; confirmation cannot bypass an outdated request during rollout", async () => {
  const f = await coachingFixture();
  try {
    const r = await (
        await f.request("member", "/api/coach/save", "POST", {
          draft,
          checkpoint,
        })
      ).json(),
      path = "/api/coach/focuses/" + r.focus.id;
    await f.migration.query(
      "ALTER TABLE coach_checkpoints ADD CONSTRAINT synthetic_checkpoint_failure CHECK(document->>'work'<>'Reject this save')",
    );
    assert.equal(
      (
        await f.request("member", "/api/coach/save", "POST", {
          id: r.focus.id,
          version: 1,
          draft: { ...draft, title: "Should roll back" },
          checkpoint: { ...checkpoint, work: "Reject this save" },
        })
      ).status,
      503,
    );
    const intact = await (await f.request("member", path)).json();
    assert.equal(intact.focus.title, draft.title);
    assert.equal(intact.focus.version, 1);
    assert.equal(intact.checkpoint.work, checkpoint.work);
    await f.request("member", path + "/request", "POST", { version: 1 });
    await f.request("member", "/api/focuses/" + r.focus.id, "PUT", {
      ...draft,
      title: "New saved version",
      version: 1,
    });
    // The old release's confirmation SQL must also be rejected while replacing instances.
    await assert.rejects(
      f.runtime.query(
        "UPDATE position_focuses SET status='confirmed',confirmed_at=now(),confirmed_by=$2,version=version+1 WHERE id=$1",
        [r.focus.id, f.ids.lead],
      ),
      { code: "P0409" },
    );
  } finally {
    await f.close();
  }
});

test("a checkpoint cannot point outside the focus being saved", async () => {
  const f = await coachingFixture();
  try {
    const result = await f.request("member", "/api/coach/save", "POST", {
      draft,
      checkpoint: { ...checkpoint, sectionIndex: 5 },
    });
    assert.equal(result.status, 400);
    assert.equal(
      (await (await f.request("member", "/api/focuses")).json()).length,
      0,
    );
  } finally {
    await f.close();
  }
});
