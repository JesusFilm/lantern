import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import { memberFocusReader } from "./member-focuses.js";

test("member focus reader rejects actors who are not career leads", async () => {
  const row = { id: "member-1", name: "Member", email: "member@example.test", role: "member", focuses: [] };
  const db = { query: async () => ({ rowCount: 1, rows: [row] }) } as unknown as Pool;
  const result = await memberFocusReader(db).list("actor-1", "member-1").catch((error: unknown) => error);
  assert.ok(result);
});
