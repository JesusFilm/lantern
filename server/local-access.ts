import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { membershipWrite } from "./membership.js";

// Deliberately isolated from real identity. Never reseed documents, overwrite profile edits,
// or reactivate a membership that an operator has removed.
export async function prepareLocalAccount(db: Pool) {
  return membershipWrite(db, async (client) => {
    const existing = await client.query(
      "SELECT id FROM users WHERE google_sub='local:lantern-workspace'",
    );
    if (existing.rowCount) return existing.rows[0].id as string;
    const id = randomUUID(),
      department = randomUUID();
    await client.query(
      "INSERT INTO users(id,google_sub,email,name) VALUES($1,'local:lantern-workspace','local@lantern.test','Local user')",
      [id],
    );
    await client.query(
      "INSERT INTO departments(id,name) VALUES($1,'Engineering')",
      [department],
    );
    await client.query(
      "INSERT INTO memberships(user_id,department_id,role) VALUES($1,$2,'member')",
      [id, department],
    );
    return id;
  });
}

export async function localAccount(db: Pool) {
  const result = await db.query("SELECT id FROM users WHERE google_sub='local:lantern-workspace'");
  if (result.rowCount !== 1) throw new Error('Prepare the synthetic local account with the local-account admin command before startup.');
  return result.rows[0].id as string;
}
