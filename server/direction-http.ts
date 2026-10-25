import { Router, type Request } from "express";
import type { Pool } from "pg";
import { readDirection, saveDirection, validateDirection } from "./direction.js";

export function directionRoutes(db: Pool, requireUser: (req: Request) => Promise<{ id: string }>) {
  const router = Router();
  router.get("/api/department/direction", async (req, res) => {
    const user = await requireUser(req);
    res.json(await readDirection(db, user.id));
  });
  router.put("/api/department/direction", async (req, res) => {
    const user = await requireUser(req);
    res.json(await saveDirection(db, user.id, validateDirection(req.body)));
  });
  return router;
}
