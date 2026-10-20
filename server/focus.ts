import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { AccessError, membership, membershipWrite } from "./membership.js";
import type { FocusDraft, PositionFocus } from "../shared/focus.js";
import { resolveAlignment } from "./direction.js";

const columns = `id,title,to_char(period_start,'YYYY-MM-DD') AS start,to_char(period_end,'YYYY-MM-DD') AS end,sections,version,updated_at AS "updatedAt",status,confirmed_at AS "confirmedAt",
  (SELECT jsonb_build_object('id',u.id,'name',u.name) FROM users u WHERE u.id=confirmed_by) AS "confirmedBy"`;
// A focus is saved atomically as one versioned document. Ownership never comes from its payload.
export function focusStore(db: Pool) {
  return {
    async list(userId: string, departmentId: string): Promise<PositionFocus[]> {
      return (
        await db.query(
          `SELECT ${columns} FROM position_focuses WHERE user_id=$1 AND department_id=$2 ORDER BY period_start DESC,updated_at DESC`,
          [userId, departmentId],
        )
      ).rows;
    },
    async get(
      userId: string,
      departmentId: string,
      id: string,
    ): Promise<PositionFocus> {
      const result = await db.query(
        `SELECT ${columns} FROM position_focuses WHERE user_id=$1 AND department_id=$2 AND id::text=$3`,
        [userId, departmentId, id],
      );
      if (!result.rowCount)
        throw new AccessError(404, "Position focus not found.");
      return result.rows[0];
    },
    async create(
      userId: string,
      departmentId: string,
      draft: FocusDraft,
    ): Promise<PositionFocus> {
      return membershipWrite(db, async (client) => {
        if ((await membership(client, userId))?.id !== departmentId)
          throw new AccessError(403, "Active department membership is required.");
        const sections = await resolveAlignment(client, userId, draft.sections);
        return (
          await client.query(
            `INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end,sections) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`,
            [
              randomUUID(),
              userId,
              departmentId,
              draft.title,
              draft.start,
              draft.end,
              JSON.stringify(sections),
            ],
          )
        ).rows[0];
      });
    },
    async confirm(
      actorId: string,
      memberId: string,
      id: string,
      version: number,
    ): Promise<PositionFocus> {
      return membershipWrite(db, async (client) => {
        const department = await membership(client, actorId);
        if (department?.role !== "career-lead")
          throw new AccessError(403, "Only the career lead can confirm a focus.");
        const target = await client.query(
          `SELECT ${columns} FROM position_focuses
           WHERE id::text=$1 AND user_id::text=$2 AND department_id=$3
             AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=position_focuses.user_id
               AND m.department_id=$3 AND m.deleted_at IS NULL)
           FOR UPDATE`,
          [id, memberId, department.id],
        );
        if (!target.rowCount)
          throw new AccessError(404, "Member or position focus unavailable.");
        const focus = target.rows[0] as PositionFocus;
        if (focus.version !== version)
          throw new AccessError(
            409,
            "This focus changed. Close this dialog and reopen the focus before confirming.",
          );
        if (focus.status === "confirmed") return focus;
        validateFocus({
          title: focus.title,
          start: focus.start,
          end: focus.end,
          sections: focus.sections,
        });
        if (!focus.sections.some(
          section => section.kind === "normal" && section.goals.length > 0,
        ))
          throw new AccessError(400, "Add a Normal objective with at least one SMART goal before confirming.");
        const result = await client.query(
          `UPDATE position_focuses SET status='confirmed',confirmed_at=now(),confirmed_by=$2,
           version=version+1,updated_at=now() WHERE id::text=$1 RETURNING ${columns}`,
          [id, actorId],
        );
        return result.rows[0];
      });
    },
    async update(
      userId: string,
      departmentId: string,
      id: string,
      draft: FocusDraft,
      version: number,
    ): Promise<PositionFocus> {
      return membershipWrite(db, async (client) => {
        if ((await membership(client, userId))?.id !== departmentId)
          throw new AccessError(403, "Active department membership is required.");
        const currentResult = await client.query(
          `SELECT ${columns} FROM position_focuses WHERE user_id=$1 AND department_id=$2 AND id::text=$3 FOR UPDATE`,
          [userId, departmentId, id],
        );
        if (!currentResult.rowCount) throw new AccessError(404, "Position focus not found.");
        const current = currentResult.rows[0] as PositionFocus;
        if (current.status === "confirmed")
          throw new AccessError(409, "This focus is confirmed and read-only. Your unsaved text is still here; copy it before closing this dialog.");
        if (current.version !== version)
          throw new AccessError(409, "This focus changed in another window. Close this dialog and reopen the focus before editing.");
        const sections = await resolveAlignment(client, userId, draft.sections, current.sections);
        const result = await client.query(
          `UPDATE position_focuses SET title=$4,period_start=$5,period_end=$6,sections=$7,version=version+1,updated_at=now() WHERE user_id=$1 AND department_id=$2 AND id::text=$3 AND version=$8 AND status='draft' RETURNING ${columns}`,
          [
            userId,
            departmentId,
            id,
            draft.title,
            draft.start,
            draft.end,
            JSON.stringify(sections),
            version,
          ],
        );
        return result.rows[0];
      });
    },
  };
}

export function validateFocus(
  value: unknown,
  updating = false,
): FocusDraft & { version?: number } {
  const fail = (): never => {
    throw new AccessError(
      400,
      "Enter a title, valid date range, and non-empty objectives and goals.",
    );
  };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data).some(
      (k) =>
        ![
          "title",
          "start",
          "end",
          "sections",
          ...(updating ? ["version"] : []),
        ].includes(k),
    )
  )
    return fail();
  const text = (v: unknown, max: number): v is string =>
    typeof v === "string" && !!v.trim() && v.length <= max;
  const date = (v: unknown): v is string =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    v >= "1900-01-01" &&
    v <= "9999-12-31" &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  if (
    !text(data.title, 200) ||
    !date(data.start) ||
    !date(data.end) ||
    data.start > data.end ||
    !Array.isArray(data.sections) ||
    data.sections.length > 100
  )
    return fail();
  for (const section of data.sections) {
    if (
      !section ||
      typeof section !== "object" ||
      Object.keys(section).some(
        (k) => !["kind", "objective", "goals", "alignment"].includes(k),
      ) ||
      !["normal", "personal-development", "leadership"].includes(
        section.kind,
      ) ||
      !text(section.objective, 10000) ||
      !Array.isArray(section.goals) ||
      section.goals.length > 100 ||
      !section.goals.every((g: unknown) => text(g, 10000))
    )
      return fail();
    if (section.alignment !== undefined) {
      const alignment = section.alignment;
      if (!alignment || typeof alignment !== "object" || Array.isArray(alignment) ||
          Object.keys(alignment).some(k => !["initiatives", "other"].includes(k)) ||
          typeof alignment.other !== "boolean" || !Array.isArray(alignment.initiatives) ||
          alignment.initiatives.length > 100 || (alignment.other && alignment.initiatives.length))
        return fail();
      const ids = new Set<string>();
      for (const item of alignment.initiatives) {
        if (!item || typeof item !== "object" || Array.isArray(item) ||
            Object.keys(item).some(k => !["id", "name"].includes(k)) ||
            typeof item.id !== "string" || !/^[a-f0-9-]{36}$/.test(item.id) ||
            !text(item.name, 120) || ids.has(item.id)) return fail();
        ids.add(item.id);
      }
    }
  }
  if (
    updating &&
    (!Number.isSafeInteger(data.version) || Number(data.version) < 1)
  )
    return fail();
  return { ...data, title: data.title.trim() } as unknown as FocusDraft & {
    version?: number;
  };
}
