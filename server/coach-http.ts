import { Router } from "express";
import type { Request } from "express";
import type { Pool } from "pg";
import { AccessError, membership } from "./membership.js";
import { focusStore, validateFocus } from "./focus.js";
import { coachStore } from "./coach-store.js";
import { coachPrompt } from "./coach-prompt.js";
import { readDirection } from "./direction.js";
import { CoachUnavailable, type CoachProvider } from "./coach-provider.js";
import {
  validateSuggestion,
  type CoachStage,
  validateCheckpoint,
} from "./coach-contract.js";

export function coachRoutes(
  db: Pool,
  requireUser: (req: Request) => Promise<{ id: string }>,
  provider?: CoachProvider,
) {
  const router = Router(),
    store = coachStore(db);
  router.get("/api/coach/focuses", async (req, res) =>
    res.json(
      await store.list((await requireUser(req)).id, req.query.view === "lead"),
    ),
  );
  router.get("/api/coach/focuses/:id", async (req, res) =>
    res.json(
      await store.record((await requireUser(req)).id, String(req.params.id)),
    ),
  );
  router.post("/api/coach/save", async (req, res) => {
    const actor = (await requireUser(req)).id,
      dept = await membership(db, actor);
    if (!dept)
      throw new AccessError(403, "Active department membership is required.");
    const body = req.body;
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (k) => !["id", "version", "draft", "checkpoint"].includes(k),
      ) ||
      (body.id !== undefined &&
        (typeof body.id !== "string" ||
          !Number.isSafeInteger(body.version) ||
          body.version < 1))
    )
      throw new AccessError(400, "Supply the saved draft version.");
    const draft = validateFocus(body.draft),
      checkpoint = validateCheckpoint(body.checkpoint);
    const sectionIndex = checkpoint.sectionIndex ?? 0,
      goalIndex = checkpoint.goalIndex ?? 0;
    if (
      sectionIndex > draft.sections.length ||
      goalIndex > (draft.sections[sectionIndex]?.goals.length ?? 0)
    )
      throw new AccessError(400, "Choose an objective and goal in this draft.");
    const focus = body.id
      ? await focusStore(db).update(
          actor,
          dept.id,
          body.id,
          draft,
          body.version,
          checkpoint,
        )
      : await focusStore(db).create(actor, dept.id, draft, checkpoint);
    const saved = await store.record(actor, focus.id);
    if (saved.focus.version !== focus.version)
      throw new AccessError(
        409,
        "Your draft was saved, but changed in another window. Reopen it before editing again.",
      );
    res.json(saved);
  });
  const versionBody = (body: any, allowed: string[]) => {
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => !allowed.includes(k)) ||
      !Number.isSafeInteger(body.version) ||
      body.version < 1
    )
      throw new AccessError(400, "Supply the current version.");
  };
  const noteText = (text: unknown) => {
    if (typeof text !== "string" || !text.trim() || text.length > 4000)
      throw new AccessError(400, "Write a note of 1–4000 characters.");
    return text.trim();
  };
  router.post("/api/coach/focuses/:id/request", async (req, res) => {
    const actor = (await requireUser(req)).id;
    versionBody(req.body, ["version", "note"]);
    const note =
      req.body.note === undefined || req.body.note === ""
        ? undefined
        : noteText(req.body.note);
    res.json(
      await store.request(actor, String(req.params.id), req.body.version, note),
    );
  });
  router.post("/api/coach/focuses/:id/notes", async (req, res) => {
    const actor = (await requireUser(req)).id;
    versionBody(req.body, ["version", "body"]);
    res.json(
      await store.addNote(
        actor,
        String(req.params.id),
        req.body.version,
        noteText(req.body.body),
      ),
    );
  });
  router.delete("/api/coach/focuses/:id/notes/:note", async (req, res) =>
    res.json(
      await store.removeNote(
        (await requireUser(req)).id,
        String(req.params.id),
        String(req.params.note),
      ),
    ),
  );
  router.post("/api/coach/focuses/:id/read", async (req, res) => {
    const actor = (await requireUser(req)).id;
    if (
      !req.body ||
      Object.keys(req.body).some((k) => k !== "noteIds") ||
      !Array.isArray(req.body.noteIds) ||
      req.body.noteIds.length > 500 ||
      req.body.noteIds.some(
        (id: unknown) => typeof id !== "string" || id.length > 36,
      )
    )
      throw new AccessError(400, "Supply the displayed notes.");
    res.json(
      await store.markRead(actor, String(req.params.id), req.body.noteIds),
    );
  });
  router.post("/api/coach/focuses/:id/confirm", async (req, res) => {
    const actor = (await requireUser(req)).id,
      id = String(req.params.id);
    versionBody(req.body, ["version"]);
    const access = await store.access(db, actor, id);
    await focusStore(db).confirm(actor, access.owner, id, req.body.version);
    res.json(await store.record(actor, id));
  });
  const active = new Set<string>(),
    usage = new Map<string, { at: number; count: number }>();
  router.post("/api/coach/suggest", async (req, res) => {
    const actor = (await requireUser(req)).id,
      department = await membership(db, actor);
    if (!department)
      throw new AccessError(403, "Active department membership is required.");
    if (!provider)
      throw new AccessError(
        503,
        "Coaching is unavailable. You can continue writing manually.",
      );
    const body = req.body;
    if (
      !body ||
      Object.keys(body).some(
        (k) => !["stage", "context", "focusId", "version"].includes(k),
      ) ||
      !["clarify", "objective", "actions", "goal"].includes(body.stage)
    )
      throw new AccessError(400, "Choose a valid coaching step.");
    const context = validateCheckpoint(body.context),
      stage = body.stage as CoachStage;
    if (body.focusId !== undefined) {
      if (
        typeof body.focusId !== "string" ||
        !Number.isSafeInteger(body.version)
      )
        throw new AccessError(400, "Supply the draft version.");
      const current = await focusStore(db).get(
        actor,
        department.id,
        body.focusId,
      );
      if (current.status !== "draft" || current.version !== body.version)
        throw new AccessError(
          409,
          "This focus changed. Reopen your saved draft before coaching.",
        );
    }
    const now = Date.now();
    for (const [id, bucket] of usage)
      if (now - bucket.at >= 60000) usage.delete(id);
    const bucket = usage.get(actor) ?? { at: now, count: 0 };
    if (active.has(actor) || active.size >= 4 || bucket.count >= 20)
      throw new AccessError(429, "The coach is busy. Try again shortly.");
    bucket.count++;
    usage.set(actor, bucket);
    active.add(actor);
    const abort = new AbortController(),
      closed = () => {
        if (!res.writableEnded) abort.abort();
      };
    res.on("close", closed);
    try {
      const direction = await readDirection(db, actor);
      const suggestion = await provider.suggest(
        coachPrompt(direction),
        JSON.stringify({ stage, context }),
        (v) =>
          validateSuggestion(
            stage,
            v,
            direction.initiatives.filter((i) => !i.archived).map((i) => i.id),
          ),
        abort.signal,
      );
      // Revoked sessions, membership removal and concurrent edits invalidate results.
      await requireUser(req);
      if ((await membership(db, actor))?.id !== department.id)
        throw new AccessError(403, "Active department membership is required.");
      if (body.focusId) {
        const current = await focusStore(db).get(
          actor,
          department.id,
          body.focusId,
        );
        if (current.version !== body.version || current.status !== "draft")
          throw new AccessError(
            409,
            "This focus changed. Reopen your saved draft before coaching.",
          );
      }
      res.json(suggestion);
    } catch (error) {
      if (abort.signal.aborted) return;
      if (error instanceof AccessError) throw error;
      throw new AccessError(503, new CoachUnavailable().message);
    } finally {
      active.delete(actor);
      res.off("close", closed);
    }
  });
  return router;
}
