import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { StrategicInitiative } from "../shared/direction.js";
import { membershipWrite } from "./membership.js";

// Engineering's current staging identities. These are defaults for synthetic
// local walkthroughs; ordinary startup never changes hosted team direction.
const defaults: Array<Pick<StrategicInitiative, "name" | "appearance">> = [
  { name: "Love What We Build", appearance: { icon: "heart", color: "#c74998" } },
  { name: "Rethink How We Build", appearance: { icon: "lightbulb", color: "#3276b0" } },
  { name: "Role Clarity And Growth", appearance: { icon: "sprout", color: "#267c65" } },
  { name: "Team Connectedness", appearance: { icon: "users", color: "#e4bf24" } },
];

export async function seedLocalInitiatives(db: Pool, localUserId: string) {
  const connection = new URL(db.options.connectionString!);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(connection.hostname)) {
    throw new Error("Local initiative defaults require a loopback database.");
  }
  await membershipWrite(db, async client => {
    const membership = await client.query(`SELECT m.department_id FROM memberships m
      JOIN users u ON u.id=m.user_id AND u.google_sub='local:lantern-workspace'
      JOIN departments d ON d.id=m.department_id AND d.deleted_at IS NULL
      WHERE m.user_id=$1 AND m.deleted_at IS NULL`, [localUserId]);
    if (!membership.rowCount) return;
    const department = membership.rows[0].department_id as string;
    const saved = await client.query("SELECT initiatives FROM department_direction WHERE department_id=$1 FOR UPDATE", [department]);
    const initiatives: StrategicInitiative[] = saved.rows[0]?.initiatives ?? [];
    let changed = false;
    for (const preset of defaults) {
      const matches = initiatives.filter(item => item.name.trim().toLowerCase() === preset.name.toLowerCase());
      if (matches.length) {
        for (const item of matches) if (!item.appearance) {
          item.appearance = preset.appearance;
          changed = true;
        }
      } else {
        initiatives.push({ ...preset, id: randomUUID(), archived: false });
        changed = true;
      }
    }
    if (!changed) return;
    if (initiatives.length > 100) throw new Error("Local initiative defaults would exceed the limit of 100 initiatives; no changes applied.");
    await client.query(`INSERT INTO department_direction(department_id, initiatives) VALUES($1,$2)
      ON CONFLICT(department_id) DO UPDATE SET initiatives=EXCLUDED.initiatives, version=department_direction.version+1`,
      [department, JSON.stringify(initiatives)]);
  });
}
