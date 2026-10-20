import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { DepartmentDirection, DirectionDraft, ObjectiveAlignment } from "../shared/direction.js";
import { AccessError, membership, membershipWrite } from "./membership.js";
import type { FocusSection } from "../shared/focus.js";
import { isPresetAppearance, validateInitiativeAppearance } from "../shared/initiative-appearance.js";

export async function readDirection(db: Pool | PoolClient, actorId: string): Promise<DepartmentDirection> {
  const result = await db.query(`SELECT COALESCE(c.mission,'') AS mission,
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
  if (Object.keys(data).some(k => !["mission", "initiatives", "version"].includes(k)) ||
      typeof data.mission !== "string" || data.mission.length > 1000 ||
      !Number.isSafeInteger(data.version) || data.version < 0 ||
      !Array.isArray(data.initiatives) || data.initiatives.length > 100) return fail();
  const ids = new Set<string>(), names = new Set<string>();
  for (const item of data.initiatives) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).some(k => !["id", "name", "archived", "appearance"].includes(k)) ||
        typeof item.name !== "string" || !item.name.trim() || item.name.length > 120 ||
        typeof item.archived !== "boolean" ||
        (item.id !== undefined && (typeof item.id !== "string" || !/^[a-f0-9-]{36}$/.test(item.id) || ids.has(item.id)))) return fail();
    if (item.id) ids.add(item.id);
    if (!item.archived) {
      const name = item.name.trim().toLowerCase();
      if (names.has(name)) return fail();
      names.add(name);
    }
  }
  try {
    return { mission: data.mission.trim(), version: data.version,
      initiatives: data.initiatives.map(item => ({ ...item, name: item.name.trim(),
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
    const initiatives = draft.initiatives.map(item => ({ ...item, id: item.id ?? randomUUID() }));
    const result = await client.query(`INSERT INTO department_direction(department_id,mission,initiatives,version)
      VALUES($1,$2,$3,1) ON CONFLICT(department_id) DO UPDATE
      SET mission=EXCLUDED.mission,initiatives=EXCLUDED.initiatives,version=department_direction.version+1
      RETURNING mission,initiatives,version`, [department.id, draft.mission, JSON.stringify(initiatives)]);
    return result.rows[0];
  });
}

// Run under the same membership-write transaction as the focus save. Snapshot names
// and appearance from trusted configuration so edits cannot rewrite a confirmed baseline.
export async function resolveAlignment(client: PoolClient, actorId: string, sections: FocusSection[], previous: FocusSection[] = []): Promise<FocusSection[]> {
  const direction = await readDirection(client, actorId);
  const retained = new Map<string, ObjectiveAlignment["initiatives"]>();
  for (const section of previous) for (const item of section.alignment?.initiatives ?? []) {
    const names = retained.get(item.id) ?? [];
    names.push(item);
    retained.set(item.id, names);
  }
  return sections.map(section => {
    if (!section.alignment) return section;
    return { ...section, alignment: {
      other: section.alignment.other,
      initiatives: section.alignment.initiatives.map(choice => {
        const initiative = direction.initiatives.find(item => item.id === choice.id);
        const retainedNames = retained.get(choice.id);
        if (!initiative || (initiative.archived && !retainedNames?.length))
          throw new AccessError(400, "An initiative is no longer available. Reopen the objective and choose an active initiative or Other.");
        if (initiative.archived) return retainedNames!.shift()!;
        return { id: initiative.id, name: initiative.name,
          ...(initiative.appearance ? { appearance: initiative.appearance } : {}) };
      }),
    } };
  });
}
