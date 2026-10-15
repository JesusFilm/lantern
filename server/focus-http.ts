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
  async function focusOwner(req: Request) {
    const user = await requireUser(req);
    const department = await membership(db, user.id);
    if (!department)
      throw new AccessError(403, "Active department membership is required.");
    return { user, department };
  }
  router.get("/api/focuses", async (req, res) => {
    const { user, department } = await focusOwner(req);
    res.json(await focuses.list(user.id, department.id));
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
  return router;
}
