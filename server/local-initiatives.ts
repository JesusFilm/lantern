import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { StrategicInitiative } from "../shared/direction.js";
import { membershipWrite } from "./membership.js";

// Engineering's current staging identities. These are defaults for synthetic
// local walkthroughs; ordinary startup never changes hosted team direction.
export const initiativeDefaults: Array<Pick<StrategicInitiative, "name" | "appearance" | "description">> = [
  { name: "Love What We Build", description: "Understand who our work serves, why it matters to the mission, and whether it helps. This initiative connects meaningful ownership with access to the people and evidence needed to shape solutions. It includes understanding user needs, clarifying decisions we own, and using feedback after delivery to improve what we build and guide what happens next.", appearance: { icon: "heart", color: "#c74998" } },
  { name: "Rethink How We Build", description: "Improve how we move from an identified need to a validated outcome as AI changes the way we work. This includes stronger problem framing, effective use of agents, quality and validation throughout development, and shared tools and practices that help the whole team. Human judgment and responsibility remain central as we experiment, evaluate results and share useful capabilities.", appearance: { icon: "lightbulb", color: "#3276b0" } },
  { name: "Role Clarity And Growth", description: "Connect the team’s strategy to each person’s contribution, desired results and personal development. This initiative helps people understand their responsibilities, how their strengths complement others, and the capabilities they need to develop. Position Focus makes that connection practical over roughly six months, with support from the Career Leader and relevant managers, adapting as priorities change.", appearance: { icon: "sprout", color: "#267c65" } },
  { name: "Team Connectedness", description: "Build a team where people know one another, understand what others are working on, and can find help and offer support. This includes sharing work and learning through Show and Tell, making space for relationships beyond delivery, and giving people regular opportunities to raise feedback. Visible responses and follow-through help that feedback improve our experience of working together.", appearance: { icon: "users", color: "#e4bf24" } },
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
    for (const preset of initiativeDefaults) {
      const matches = initiatives.filter(item => item.name.trim().toLowerCase() === preset.name.toLowerCase());
      if (matches.length) {
        for (const item of matches) {
          if (!item.appearance) {
            item.appearance = preset.appearance;
            changed = true;
          }
          if (item.description === undefined) {
            item.description = preset.description;
            changed = true;
          }
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
