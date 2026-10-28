import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { CoachRecord, CoachCheckpoint } from "../shared/coach.js";
import { AccessError, membership, membershipWrite } from "./membership.js";
import { readOwnedFocus } from "./focus.js";

export function coachStore(db: Pool) {
  async function access(
    client: Pool | PoolClient,
    actor: string,
    id: string,
    ownerOnly = false,
  ) {
    const dept = await membership(client, actor);
    if (!dept)
      throw new AccessError(403, "Active department membership is required.");
    const row = (
      await client.query(
        `SELECT f.user_id AS owner,u.name FROM position_focuses f JOIN users u ON u.id=f.user_id
      WHERE f.id::text=$1 AND f.department_id=$2 AND (f.user_id=$3 OR ($4 AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=f.user_id AND m.department_id=$2 AND m.deleted_at IS NULL)))`,
        [id, dept.id, actor, !ownerOnly && dept.role === "career-lead"],
      )
    ).rows[0];
    if (!row) throw new AccessError(404, "Position focus not found.");
    return { ...row, dept };
  }
  async function record(actor: string, id: string): Promise<CoachRecord> {
    // One transaction holds authority and the document/notes snapshot together.
    return membershipWrite(db, async (client) => {
      const a = await access(client, actor, id);
      const focus = await readOwnedFocus(client, a.owner, a.dept.id, id);
      const checkpoint =
        a.owner === actor
          ? ((
              await client.query(
                "SELECT document FROM coach_checkpoints WHERE focus_id::text=$1",
                [id],
              )
            ).rows[0]?.document as CoachCheckpoint)
          : undefined;
      const requests = (
        await client.query(
          `SELECT id,created_at AS at,document FROM focus_review_requests WHERE focus_id::text=$1 ORDER BY version`,
          [id],
        )
      ).rows;
      const notes = (
        await client.query(
          `SELECT n.id,n.author_id AS "authorId",u.name AS "authorName",CASE WHEN n.deleted_at IS NULL THEN n.body ELSE '' END AS body,
        n.created_at AS "createdAt",n.deleted_at AS "deletedAt",r.version AS "requestVersion"
        FROM focus_review_notes n JOIN focus_review_requests r ON r.id=n.request_id JOIN users u ON u.id=n.author_id WHERE r.focus_id::text=$1 ORDER BY n.created_at,n.id`,
          [id],
        )
      ).rows;
      const readIds = (
        await client.query(
          `SELECT x.note_id AS id FROM focus_note_reads x JOIN focus_review_notes n ON n.id=x.note_id JOIN focus_review_requests r ON r.id=n.request_id WHERE r.focus_id::text=$1 AND x.user_id=$2`,
          [id, actor],
        )
      ).rows.map((r) => r.id);
      return {
        focus,
        memberName: a.name,
        checkpoint: checkpoint ?? null,
        requests,
        notes,
        readIds,
      };
    });
  }
  async function change(
    actor: string,
    id: string,
    work: (
      client: PoolClient,
      a: Awaited<ReturnType<typeof access>>,
    ) => Promise<void>,
    ownerOnly = false,
  ) {
    await membershipWrite(db, async (client) => {
      const a = await access(client, actor, id, ownerOnly);
      await client.query(
        "SELECT id FROM position_focuses WHERE id::text=$1 FOR UPDATE",
        [id],
      );
      await work(client, a);
    });
    return record(actor, id);
  }
  async function latest(client: PoolClient, id: string, version: number) {
    const row = (
      await client.query(
        "SELECT id,version FROM focus_review_requests WHERE focus_id::text=$1 ORDER BY version DESC LIMIT 1",
        [id],
      )
    ).rows[0];
    if (!row || row.version !== version)
      throw new AccessError(
        409,
        "The review changed. Reopen it before adding your note.",
      );
    return row;
  }
  return {
    record,
    access,
    request(actor: string, id: string, version: number, note?: string) {
      return change(
        actor,
        id,
        async (client, a) => {
          const focus = await readOwnedFocus(client, actor, a.dept.id, id);
          if (focus.status !== "draft" || focus.version !== version)
            throw new AccessError(
              409,
              "Save and reopen your latest draft before requesting review.",
            );
          if (
            !focus.sections.some((s) => s.kind === "normal" && s.goals.length)
          )
            throw new AccessError(
              400,
              "Add an objective and goal before requesting review.",
            );
          const inserted = await client.query(
            `INSERT INTO focus_review_requests(id,focus_id,version,document) VALUES($1,$2,$3,$4) ON CONFLICT(focus_id,version) DO NOTHING RETURNING id`,
            [randomUUID(), id, version, JSON.stringify(focus)],
          );
          // Replaying the request cannot create duplicate notes.
          if (note && inserted.rowCount)
            await client.query(
              "INSERT INTO focus_review_notes(id,request_id,author_id,body) VALUES($1,$2,$3,$4)",
              [randomUUID(), inserted.rows[0].id, actor, note],
            );
        },
        true,
      );
    },
    addNote(actor: string, id: string, version: number, body: string) {
      return change(actor, id, async (client) => {
        const request = await latest(client, id, version);
        await client.query(
          "INSERT INTO focus_review_notes(id,request_id,author_id,body) VALUES($1,$2,$3,$4)",
          [randomUUID(), request.id, actor, body],
        );
      });
    },
    removeNote(actor: string, id: string, noteId: string) {
      return change(actor, id, async (client) => {
        const result = await client.query(
          `UPDATE focus_review_notes n SET deleted_at=COALESCE(n.deleted_at,now()) FROM focus_review_requests r
        WHERE n.id::text=$1 AND n.author_id=$2 AND n.request_id=r.id AND r.focus_id::text=$3 RETURNING n.id`,
          [noteId, actor, id],
        );
        if (!result.rowCount)
          throw new AccessError(403, "You can remove only your own notes.");
      });
    },
    markRead(actor: string, id: string, noteIds: string[]) {
      return change(actor, id, async (client) => {
        await client.query(
          `INSERT INTO focus_note_reads(note_id,user_id)
        SELECT n.id,$1 FROM focus_review_notes n JOIN focus_review_requests r ON r.id=n.request_id WHERE r.focus_id::text=$2 AND n.id::text=ANY($3::text[])
        ON CONFLICT DO NOTHING`,
          [actor, id, noteIds],
        );
      });
    },
    async list(actor: string, lead = false) {
      const dept = await membership(db, actor);
      if (!dept)
        throw new AccessError(403, "Active department membership is required.");
      if (lead && dept.role !== "career-lead")
        throw new AccessError(
          403,
          "Only the career lead can open review requests.",
        );
      const rows = (
        await db.query(
          `SELECT f.id FROM position_focuses f WHERE f.department_id=$1 AND
      (CASE WHEN $3 THEN EXISTS(SELECT 1 FROM focus_review_requests r WHERE r.focus_id=f.id) AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=f.user_id AND m.department_id=$1 AND m.deleted_at IS NULL)
      ELSE f.user_id=$2 END) ORDER BY f.updated_at DESC`,
          [dept.id, actor, lead],
        )
      ).rows;
      const records = [];
      for (const row of rows) records.push(await record(actor, row.id));
      return records;
    },
  };
}
