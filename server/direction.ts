import { normalizeMissionImage } from "./mission-image.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { maxInitiativeDescriptionLength } from "../shared/direction.js";
import type { DepartmentDirection, DirectionDraft } from "../shared/direction.js";
import { AccessError, membership, membershipWrite } from "./membership.js";
import { isPresetAppearance, validateInitiativeAppearance } from "../shared/initiative-appearance.js";

export async function readDirection(db: Pool | PoolClient, actorId: string): Promise<DepartmentDirection> {
  const result = await db.query(`SELECT COALESCE(c.mission,'') AS mission,
    CASE WHEN c.department_id IS NULL THEN '/mission-jesus-geometric.png' ELSE c.mission_image END AS "missionImage",
    COALESCE(c.initiatives,'[]'::jsonb) AS initiatives, COALESCE(c.version,0) AS version
    FROM memberships m JOIN departments d ON d.id=m.department_id AND d.deleted_at IS NULL
    LEFT JOIN department_direction c ON c.department_id=d.id
    WHERE m.user_id=$1 AND m.deleted_at IS NULL`, [actorId]);
  if (!result.rowCount) throw new AccessError(403, "Active department membership is required.");
  return result.rows[0];
}

export function validateDirection(value: unknown): DirectionDraft {
  const fail = (): never => { throw new AccessError(400, "Enter a mission of up to 1,000 characters and uniquely named initiatives of 1–120 characters."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const data = value as DirectionDraft;
  if (Object.keys(data).some(k => !["mission", "missionImage", "initiatives", "version"].includes(k)) ||
      (data.missionImage !== undefined && data.missionImage !== null && typeof data.missionImage !== "string") ||
      typeof data.mission !== "string" || data.mission.length > 1000 ||
      !Number.isSafeInteger(data.version) || data.version < 0 ||
      !Array.isArray(data.initiatives) || data.initiatives.length > 100) return fail();
  const ids = new Set<string>(), names = new Set<string>();
  for (const item of data.initiatives) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).some(k => !["id", "name", "description", "archived", "appearance"].includes(k)) ||
        typeof item.name !== "string" || !item.name.trim() || item.name.length > 120 ||
        typeof item.archived !== "boolean" ||
        (item.id !== undefined && (typeof item.id !== "string" || !/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id)))) return fail();
    if (item.description !== undefined && (typeof item.description !== "string" || item.description.length > maxInitiativeDescriptionLength))
      throw new AccessError(400, `Enter a description of up to ${maxInitiativeDescriptionLength} characters.`);
    if (item.id) ids.add(item.id);
    if (!item.archived) {
      const name = item.name.trim().toLowerCase();
      if (names.has(name)) return fail();
      names.add(name);
    }
  }
  try {
    return { mission: data.mission.trim(), version: data.version,
      ...(data.missionImage !== undefined ? { missionImage: data.missionImage } : {}),
      initiatives: data.initiatives.map(item => ({ ...item, name: item.name.trim(),
        ...(item.description !== undefined ? { description: item.description.trim() } : {}),
        ...(item.appearance !== undefined ? { appearance: validateInitiativeAppearance(item.appearance) } : {}) })) };
  } catch (error) { throw new AccessError(400, (error as Error).message); }
}

export async function saveDirection(db: Pool, actorId: string, draft: DirectionDraft): Promise<DepartmentDirection> {
  return membershipWrite(db, async client => {
    const department = await membership(client, actorId);
    if (department?.role !== "career-lead") throw new AccessError(403, "Only the career lead can change the mission and initiatives.");
    const previous = await readDirection(client, actorId);
    if (draft.version !== previous.version) throw new AccessError(409, "Team direction changed in another window. Your edits are still here; reload saved settings before editing again.");
    const existing = new Set(previous.initiatives.map(item => item.id));
    const supplied = new Set(draft.initiatives.map(item => item.id));
    if (draft.initiatives.some(item => item.id && !existing.has(item.id)) ||
        previous.initiatives.some(item => !supplied.has(item.id)))
      throw new AccessError(400, "Preserve existing initiatives; archive them when they are no longer in use.");
    for (const item of draft.initiatives) {
      if (!item.appearance || isPresetAppearance(item.appearance)) continue;
      const original = previous.initiatives.find(existing => existing.id === item.id)?.appearance;
      // Legacy identities can be retained while editing names, mission or status,
      // but callers cannot introduce or modify custom SVGs/colors.
      if (!original || JSON.stringify(validateInitiativeAppearance(original)) !== JSON.stringify(item.appearance))
        throw new AccessError(400, "Choose an icon and color from the initiative presets.");
    }
    const missionImage = draft.missionImage === undefined || draft.missionImage === previous.missionImage
      ? previous.missionImage : await normalizeMissionImage(draft.missionImage);
    const initiatives = draft.initiatives.map(item => ({ ...item, id: item.id ?? randomUUID() }));
    const result = await client.query(`INSERT INTO department_direction(department_id,mission,initiatives,version,mission_image)
      VALUES($1,$2,$3,1,$4) ON CONFLICT(department_id) DO UPDATE
      SET mission=EXCLUDED.mission,mission_image=EXCLUDED.mission_image,initiatives=EXCLUDED.initiatives,version=department_direction.version+1
      RETURNING mission,initiatives,version,mission_image AS "missionImage"`, [department.id, draft.mission, JSON.stringify(initiatives), missionImage]);
    return result.rows[0];
  });
}
