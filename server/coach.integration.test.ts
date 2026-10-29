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
      checkpoint: r.checkpoint,
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
    for (const role of ["member", "lead"]) {
      assert.equal((await f.request(role, path + "/notes", "POST", { version: 2, body: "Late note" })).status, 409);
      const ownNote = confirmed.notes.find((note: any) => note.authorId === f.ids[role as "member" | "lead"] && !note.deletedAt);
      assert.ok(ownNote);
      assert.equal((await f.request(role, path + "/notes/" + ownNote.id, "DELETE")).status, 409);
    }
    assert.equal((await f.request("outsider", path + "/notes", "POST", { version: 2, body: "Intrusion" })).status, 404);
    const after = await (await f.request("member", path)).json();
    assert.deepEqual(after.notes, confirmed.notes);
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
          checkpoint: { ...r.checkpoint, work: "Reject this save" },
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

test("empty suggested actions are unusable and trigger OpenRouter fallback", async () => {
  const { createCoachProvider } = await import("./coach-provider.js");
  let fallbackCalls = 0;
  const upstream = createServer((req, res) => {
    if (req.url === "/v1/messages")
      res.end(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                actions: ["", " "],
                suggestedDate: "2026-11-30",
              }),
            },
          ],
        }),
      );
    else {
      fallbackCalls++;
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  actions: [
                    "Review logs with engineers",
                    "Try clearer error messages",
                  ],
                  suggestedDate: "2026-11-30",
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
  const f = await coachingFixture(
    createCoachProvider(
      {
        primary: { url, key: "x", model: "coding" },
        fallback: { url, key: "y", model: "gemini" },
        timeoutMs: 1000,
        cooldownMs: 1000,
      },
      () => {},
    ),
  );
  try {
    const response = await f.request("member", "/api/coach/suggest", "POST", {
      stage: "actions",
      context: checkpoint,
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).actions, [
      "Review logs with engineers",
      "Try clearer error messages",
    ]);
    assert.equal(fallbackCalls, 1);
  } finally {
    await f.close();
    upstream.closeAllConnections();
    await new Promise<void>((r) => upstream.close(() => r()));
  }
});

test("private assistance progress preserves the draft, survives manual edits, and enforces owner/version/revision checks", async () => {
  const f = await coachingFixture();
  try {
    const saved = await (
      await f.request("member", "/api/focuses", "POST", draft)
    ).json();
    const path = "/api/coach/focuses/" + saved.id + "/progress";
    const body = {
      version: saved.version,
      checkpointRevision: 0,
      checkpoint: {
        ...checkpoint,
        entry: "objective",
        kind: "normal",
        adding: false,
      },
    };
    assert.equal((await f.request("member", path, "PUT", body)).status, 200);
    let r = await (
      await f.request("member", "/api/coach/focuses/" + saved.id)
    ).json();
    assert.deepEqual(r.focus, saved);
    assert.equal(r.checkpoint.entry, "objective");
    assert.equal(typeof r.checkpoint.revision, "string");
    const progressRevision = r.checkpoint.revision;
    assert.equal((await f.request("member", path, "PUT", body)).status, 409);
    for (const role of ["peer", "lead", "outsider"])
      assert.equal(
        (await f.request(role, path, "PUT", { ...body, checkpointRevision: progressRevision }))
          .status,
        404,
      );
    assert.equal(
      (await f.request("lead", "/api/coach/focuses/" + saved.id)).status,
      200,
    );
    assert.equal(
      (await (await f.request("lead", "/api/coach/focuses/" + saved.id)).json())
        .checkpoint,
      null,
    );
    assert.equal(
      (
        await f.request("member", path, "PUT", {
          ...body,
          checkpointRevision: progressRevision,
          checkpoint: { ...body.checkpoint, kind: "admin" },
        })
      ).status,
      400,
    );
    await f.request("member", "/api/focuses/" + saved.id, "PUT", {
      ...draft,
      title: "Updated elsewhere",
      version: saved.version,
    });
    r = await (
      await f.request("member", "/api/coach/focuses/" + saved.id)
    ).json();
    assert.equal(r.checkpoint.objective, checkpoint.objective);
    assert.equal(r.checkpoint.sourceVersion, saved.version);
    assert.equal(
      (
        await f.request("member", path, "PUT", {
          ...body,
          checkpointRevision: progressRevision,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request("member", path, "DELETE", {
          version: r.focus.version,
          checkpointRevision: 0,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request("member", path, "DELETE", {
          version: r.focus.version,
          checkpointRevision: progressRevision,
        })
      ).status,
      200,
    );
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

test('deleted and recreated progress rejects the original session token', async()=>{
 const f=await coachingFixture();try{
  const focus=await(await f.request('member','/api/focuses','POST',draft)).json(),path='/api/coach/focuses/'+focus.id+'/progress';
  const payload={version:focus.version,checkpointRevision:0,checkpoint:{...checkpoint,entry:'objective'}};
  const first=await(await f.request('member',path,'PUT',payload)).json();
  assert.equal((await f.request('member',path,'DELETE',{version:focus.version,checkpointRevision:first.checkpoint.revision})).status,200);
  const second=await(await f.request('member',path,'PUT',{...payload,checkpoint:{...payload.checkpoint,work:'New working session'}})).json();
  assert.equal((await f.request('member',path,'PUT',{...payload,checkpointRevision:first.checkpoint.revision})).status,409);
  assert.equal((await f.request('member',path,'DELETE',{version:focus.version,checkpointRevision:first.checkpoint.revision})).status,409);
  const current=await(await f.request('member','/api/coach/focuses/'+focus.id)).json();assert.deepEqual(current.checkpoint,second.checkpoint);
 }finally{await f.close();}
});

test("legacy coached saves reject newer private progress and retain both document and checkpoint", async () => {
  const f = await coachingFixture();
  try {
    const initial = await (await f.request("member", "/api/coach/save", "POST", {
      draft, checkpoint,
    })).json();
    const path = "/api/coach/focuses/" + initial.focus.id;
    const progressResponse = await f.request("member", path + "/progress", "PUT", {
      version: initial.focus.version,
      checkpointRevision: initial.checkpoint.revision ?? 0,
      checkpoint: { ...initial.checkpoint, entry: "objective", work: "New private answers" },
    });
    assert.equal(progressResponse.status, 200);
    const progress = await progressResponse.json();
    for (const staleCheckpoint of [initial.checkpoint, checkpoint]) {
      const stale = await f.request("member", "/api/coach/save", "POST", {
        id: initial.focus.id,
        version: initial.focus.version,
        draft: { ...draft, title: "Must not replace the document" },
        checkpoint: staleCheckpoint,
      });
      assert.equal(stale.status, 409);
      assert.deepEqual(await (await f.request("member", path)).json(), progress);
    }
    const accepted = await f.request("member", "/api/coach/save", "POST", {
      id: initial.focus.id,
      version: initial.focus.version,
      draft: { ...draft, title: "Explicit replacement" },
      checkpoint: { ...progress.checkpoint, work: "Accepted private answers" },
    });
    assert.equal(accepted.status, 200);
    const saved = await accepted.json();
    assert.equal(saved.focus.title, "Explicit replacement");
    assert.equal(saved.checkpoint.work, "Accepted private answers");
    assert.notEqual(saved.checkpoint.revision, progress.checkpoint.revision);
    assert.equal((await f.request("member", path + "/progress", "DELETE", {
      version: saved.focus.version,
      checkpointRevision: progress.checkpoint.revision,
    })).status, 409);
  } finally {
    await f.close();
  }
});

test("legacy checkpoint creation and revision-less stored progress upgrade to fresh tokens", async () => {
  const f = await coachingFixture();
  try {
    const createdResponse = await f.request("member", "/api/coach/save", "POST", {
      draft, checkpoint,
    });
    assert.equal(createdResponse.status, 200);
    const created = await createdResponse.json();
    assert.match(created.checkpoint.revision, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const path = "/api/coach/focuses/" + created.focus.id;
    const replacedResponse = await f.request("member", "/api/coach/save", "POST", {
      id: created.focus.id,
      version: created.focus.version,
      draft,
      checkpoint: created.checkpoint,
    });
    assert.equal(replacedResponse.status, 200);
    const replaced = await replacedResponse.json();
    assert.notEqual(replaced.checkpoint.revision, created.checkpoint.revision);

    // Seed the persisted format from before checkpoint revisions existed.
    const legacyFocus = await (await f.request("member", "/api/focuses", "POST", draft)).json();
    await f.migration.query(
      "INSERT INTO coach_checkpoints(focus_id,document) VALUES($1,$2)",
      [legacyFocus.id, JSON.stringify({ ...checkpoint, sourceVersion: legacyFocus.version })],
    );
    const legacyPath = "/api/coach/focuses/" + legacyFocus.id;
    const legacy = await (await f.request("member", legacyPath)).json();
    assert.equal(legacy.checkpoint.revision, undefined);
    const upgradedResponse = await f.request("member", "/api/coach/save", "POST", {
      id: legacyFocus.id, version: legacyFocus.version, draft,
      checkpoint: legacy.checkpoint,
    });
    assert.equal(upgradedResponse.status, 200);
    const upgraded = await upgradedResponse.json();
    assert.equal(typeof upgraded.checkpoint.revision, "string");
    assert.notEqual(upgraded.checkpoint.revision, replaced.checkpoint.revision);
    assert.equal(upgraded.checkpoint.sourceVersion, upgraded.focus.version);
    assert.equal((await f.request("member", legacyPath + "/progress", "DELETE", {
      version: upgraded.focus.version, checkpointRevision: 0,
    })).status, 409);

    // Deletion must not let an old token recreate a consumed checkpoint.
    assert.equal((await f.request("member", path + "/progress", "DELETE", {
      version: replaced.focus.version, checkpointRevision: replaced.checkpoint.revision,
    })).status, 200);
    assert.equal((await f.request("member", "/api/coach/save", "POST", {
      id: replaced.focus.id, version: replaced.focus.version, draft,
      checkpoint: replaced.checkpoint,
    })).status, 409);
    const intact = await (await f.request("member", path)).json();
    assert.deepEqual(intact.focus, replaced.focus);
    assert.equal(intact.checkpoint, null);
  } finally {
    await f.close();
  }
});
