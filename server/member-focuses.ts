import type { Pool } from "pg";
import type {
  MemberFocusList,
  MemberFocusDetail,
  PositionFocus,
} from "../shared/focus.js";
import { AccessError, membership } from "./membership.js";

// Read authorization and document scope share one query snapshot. Content edits remain owner-only; the separate confirmation operation locks
// the agreed baseline without editing its content.
export function memberFocusReader(db: Pool) {
  async function read(
    actorId: string,
    memberId: string,
    focusId?: string,
  ): Promise<MemberFocusList> {
    if ((await membership(db, actorId))?.role !== "career-lead") {
      throw new AccessError(
        403,
        "Only the career lead can read member focuses.",
      );
    }
    const result = await db.query(
      `SELECT u.id,u.name,u.email,
      COALESCE((SELECT jsonb_agg(document) FROM (
        SELECT f.id,f.title,to_char(f.period_start,'YYYY-MM-DD') AS start,
          to_char(f.period_end,'YYYY-MM-DD') AS end,f.sections,f.version,f.updated_at AS "updatedAt",
          f.status,f.confirmed_at AS "confirmedAt",
          (SELECT jsonb_build_object('id',lead.id,'name',lead.name) FROM users lead WHERE lead.id=f.confirmed_by) AS "confirmedBy"
        FROM position_focuses f WHERE f.user_id=u.id AND f.department_id=d.id
          AND ($3::text IS NULL OR f.id::text=$3)
        ORDER BY f.period_start DESC,f.updated_at DESC,f.id
      ) document), '[]'::jsonb) AS focuses
      FROM memberships actor JOIN departments d ON d.id=actor.department_id AND d.deleted_at IS NULL
      JOIN memberships target ON target.department_id=d.id AND target.deleted_at IS NULL
      JOIN users u ON u.id=target.user_id
      WHERE actor.user_id=$1 AND actor.role='career-lead' AND actor.deleted_at IS NULL AND u.id::text=$2`,
      [actorId, memberId, focusId ?? null],
    );
    if (!result.rowCount)
      throw new AccessError(404, "Member or position focus unavailable.");
    const { id, name, email, focuses } = result.rows[0];
    return {
      member: { id, name, email },
      focuses: focuses.map((focus: PositionFocus) => ({
        ...focus,
        updatedAt: new Date(focus.updatedAt).toISOString(),
        confirmedAt: focus.confirmedAt ? new Date(focus.confirmedAt).toISOString() : null,
      })),
    };
  }
  return {
    list: (actorId: string, memberId: string) => read(actorId, memberId),
    async get(
      actorId: string,
      memberId: string,
      focusId: string,
    ): Promise<MemberFocusDetail> {
      const result = await read(actorId, memberId, focusId);
      if (!result.focuses.length)
        throw new AccessError(404, "Member or position focus unavailable.");
      return { member: result.member, focus: result.focuses[0]! };
    },
  };
}
