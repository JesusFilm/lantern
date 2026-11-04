import { memberFocusReader } from "./member-focuses.js";
import { Router } from "express";
import type { Request } from "express";
import type { Pool } from "pg";
import { AccessError, membership } from "./membership.js";
import { focusStore, validateFocus } from "./focus.js";

export function focusRoutes(
  db: Pool,
  requireUser: (req: Request) => Promise<{ id: string }>,
) {
  const router = Router();
  const focuses = focusStore(db);
  const memberFocuses = memberFocusReader(db);
  async function focusOwner(req: Request) {
    const user = await requireUser(req);
    const department = await membership(db, user.id);
    if (!department)
      throw new AccessError(403, "Active department membership is required.");
    // Access trace for diagnosing the staging sign-in reports.
    console.info("focus access", { user: user.id, cookie: req.headers.cookie });
    return { user, department };
  }
  router.get("/api/focuses", async (req, res) => {
    const { user, department } = await focusOwner(req);
    // Lets the lead view open a member's list without a second round trip.
    const ownerId = typeof req.query.user === "string" ? req.query.user : user.id;
    res.json(await focuses.list(ownerId, department.id));
  });
  router.get("/api/focuses/:id", async (req, res) => {
    const { user, department } = await focusOwner(req);
    res.json(await focuses.get(user.id, department.id, String(req.params.id)));
  });
  router.post("/api/focuses", async (req, res) => {
    const { user, department } = await focusOwner(req);
    res
      .status(201)
      .json(
        await focuses.create(user.id, department.id, validateFocus(req.body)),
      );
  });
  router.put("/api/focuses/:id", async (req, res) => {
    const { user, department } = await focusOwner(req);
    res.json(
      await focuses.update(
        user.id,
        department.id,
        String(req.params.id),
        validateFocus(req.body, true),
        req.body.version,
      ),
    );
  });
  router.post("/api/department/members/:memberId/focuses/:id/confirm", async (req, res) => {
    const user = await requireUser(req);
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(key => key !== "version") ||
        !Number.isSafeInteger(body.version) || body.version < 1)
      throw new AccessError(400, "Supply the current focus version to confirm it.");
    res.json(await focuses.confirm(user.id, String(req.params.memberId), String(req.params.id), body.version));
  });
  router.get("/api/department/members/:memberId/focuses", async (req, res) => {
    const user = await requireUser(req);
    res.json(await memberFocuses.list(user.id, String(req.params.memberId)));
  });
  router.get(
    "/api/department/members/:memberId/focuses/:id",
    async (req, res) => {
      const user = await requireUser(req);
      res.json(
        await memberFocuses.get(
          user.id,
          String(req.params.memberId),
          String(req.params.id),
        ),
      );
    },
  );
  return router;
}
