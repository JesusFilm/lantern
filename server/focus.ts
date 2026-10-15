import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { AccessError } from "./membership.js";
import type { FocusDraft, PositionFocus } from "../shared/focus.js";

const columns = `id,title,to_char(period_start,'YYYY-MM-DD') AS start,to_char(period_end,'YYYY-MM-DD') AS end,sections,version,updated_at AS "updatedAt"`;
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
      return (
        await db.query(
          `INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end,sections) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`,
          [
            randomUUID(),
            userId,
            departmentId,
            draft.title,
            draft.start,
            draft.end,
            JSON.stringify(draft.sections),
          ],
        )
      ).rows[0];
    },
    async update(
      userId: string,
      departmentId: string,
      id: string,
      draft: FocusDraft,
      version: number,
    ): Promise<PositionFocus> {
      const result = await db.query(
        `UPDATE position_focuses SET title=$4,period_start=$5,period_end=$6,sections=$7,version=version+1,updated_at=now() WHERE user_id=$1 AND department_id=$2 AND id::text=$3 AND version=$8 RETURNING ${columns}`,
        [
          userId,
          departmentId,
          id,
          draft.title,
          draft.start,
          draft.end,
          JSON.stringify(draft.sections),
          version,
        ],
      );
      if (!result.rowCount) {
        await this.get(userId, departmentId, id);
        throw new AccessError(
          409,
          "This focus changed in another window. Close this dialog and reopen the focus before editing.",
        );
      }
      return result.rows[0];
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
        (k) => !["kind", "objective", "goals"].includes(k),
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
