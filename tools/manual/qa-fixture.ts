import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

const qaDepartmentId = "e2a42cf2-e1ba-4e71-992d-61c080d1e8d0";
/** Reset a QA-only department inside a transaction. Participants are matched by
 * exact approved email; ambiguous, unapproved and foreign memberships fail closed. */
export async function resetQaDepartment(db: Pool, options: { participants: string[]; lead?: string }) {
  const names = options.participants.map((name) => name.trim());
  if (names.length !== 3 || names.some((name) => !name) || new Set(names.map((name) => name.toLowerCase())).size !== 3)
    throw new Error("Exactly three distinct participant names are required.");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(603106)");
    const users = (await client.query(
      "SELECT u.id,u.name,lower(btrim(u.email)) AS email,EXISTS(SELECT 1 FROM approved_emails a WHERE a.email=lower(btrim(u.email))) AS approved FROM users u WHERE lower(btrim(u.email))=ANY($1::text[]) FOR UPDATE OF u",
      [names.map((name) => name.toLowerCase())],
    )).rows as { id: string; name: string; email: string; approved: boolean }[];
    if (users.some((u) => !u.approved)) throw new Error("A registered QA participant is not approved.");
    for (const name of names) if (users.filter((u) => u.email === name.toLowerCase()).length > 1)
      throw new Error("A participant name is ambiguous.");
    if (users.length < 2) throw new Error("At least two approved QA participants must register before provisioning.");
    const departments = (await client.query("SELECT id,name,deleted_at FROM departments WHERE name=$1 OR id=$2 FOR UPDATE", ["Lantern QA", qaDepartmentId])).rows as { id: string; name: string; deleted_at: Date | null }[];
    if (departments.length > 1 || departments.some((row) => row.id !== qaDepartmentId || row.name !== "Lantern QA" || row.deleted_at))
      throw new Error("QA department ownership conflicts with an unrelated department.");
    const id = qaDepartmentId;
    if (!departments.length) await client.query("INSERT INTO departments(id,name) VALUES($1,$2)", [id, "Lantern QA"]);
    const memberships = (await client.query("SELECT user_id,department_id,role,deleted_at FROM memberships WHERE user_id=ANY($1::uuid[]) OR department_id=$2 FOR UPDATE", [users.map((u) => u.id), id])).rows;
    if (memberships.some((row) => row.deleted_at || !users.some((u) => u.id === row.user_id) || (row.department_id !== id && row.role !== "member")))
      throw new Error("A participant or QA department has an unexpected membership.");
    const current = memberships.find((row) => row.role === "career-lead");
    const lead = options.lead ? users.find((u) => u.email === options.lead!.trim().toLowerCase()) : users.find((u) => u.id === current?.user_id);
    if (!lead) throw new Error("Select a registered QA career lead.");
    // Lock all focus roots before checking the graph so new foreign references
    // cannot attach between the ownership checks and the cascading deletes.
    await client.query("SELECT id FROM position_focuses WHERE department_id=$1 OR user_id=ANY($2::uuid[]) FOR UPDATE", [id, users.map((u) => u.id)]);
    const unexpected = await client.query("SELECT id FROM position_focuses WHERE (department_id=$1 AND NOT (user_id=ANY($2::uuid[]))) OR (user_id=ANY($2::uuid[]) AND department_id<>$1) FOR UPDATE", [id, users.map((u) => u.id)]);
    if (unexpected.rowCount) throw new Error("Unexpected focus ownership prevents QA reset.");
    const foreignConfirmation = await client.query("SELECT id FROM position_focuses WHERE department_id=$1 AND confirmed_by IS NOT NULL AND NOT (confirmed_by=ANY($2::uuid[])) FOR UPDATE", [id, users.map((u) => u.id)]);
    if (foreignConfirmation.rowCount) throw new Error("Unexpected confirmer prevents QA reset.");
    const foreignNotes = await client.query(`SELECT n.id FROM focus_review_notes n JOIN focus_review_requests r ON r.id=n.request_id JOIN position_focuses f ON f.id=r.focus_id WHERE f.department_id=$1 AND NOT (n.author_id=ANY($2::uuid[])) FOR UPDATE OF n`, [id, users.map((u) => u.id)]);
    if (foreignNotes.rowCount) throw new Error("Unexpected note author prevents QA reset.");
    const foreignReads = await client.query(`SELECT x.user_id FROM focus_note_reads x JOIN focus_review_notes n ON n.id=x.note_id JOIN focus_review_requests r ON r.id=n.request_id JOIN position_focuses f ON f.id=r.focus_id WHERE f.department_id=$1 AND NOT (x.user_id=ANY($2::uuid[])) FOR UPDATE OF x`, [id, users.map((u) => u.id)]);
    if (foreignReads.rowCount) throw new Error("Unexpected note reader prevents QA reset.");
    await client.query("DELETE FROM position_focuses WHERE department_id=$1 AND user_id=ANY($2::uuid[])", [id, users.map((u) => u.id)]);
    await client.query("UPDATE memberships SET role='member' WHERE department_id=$1 AND role='career-lead'", [id]);
    for (const user of users)
      await client.query("INSERT INTO memberships(user_id,department_id,role) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET department_id=EXCLUDED.department_id,role=EXCLUDED.role", [user.id, id, user.id === lead.id ? "career-lead" : "member"]);
    for (const user of users) {
      const sections = [{ kind: "normal", objective: "Improve the team's release process.", goals: ["By 30 November, review three release failures."] }];
      for (const state of user.id === lead.id ? ["draft"] : ["draft", "review", "confirmed"]) {
        const focusId = randomUUID(), requestId = randomUUID();
        const title = state === "draft" ? "Draft example" : state === "review" ? "Ready for review" : "Agreed example";
        await client.query("INSERT INTO position_focuses(id,user_id,department_id,title,period_start,period_end,sections) VALUES($1,$2,$3,$4,$5,$6,$7)", [focusId,user.id,id,title,"2026-07-01","2026-12-31",JSON.stringify(sections)]);
        if (state !== "draft") {
          const snapshot = { id: focusId, title, start: "2026-07-01", end: "2026-12-31", sections, version: 1, updatedAt: new Date().toISOString(), status: "draft", confirmedAt: null, confirmedBy: null };
          await client.query("INSERT INTO focus_review_requests(id,focus_id,version,document) VALUES($1,$2,1,$3)", [requestId,focusId,JSON.stringify(snapshot)]);
          await client.query("INSERT INTO focus_review_notes(id,request_id,author_id,body) VALUES($1,$2,$3,$4)", [randomUUID(),requestId,lead.id,"This is a useful starting point. Let's discuss the measures together."]);
          if (state === "confirmed") await client.query("UPDATE position_focuses SET status='confirmed',confirmed_by=$2,confirmed_at=now(),version=2 WHERE id=$1", [focusId,lead.id]);
        }
      }
    }
    await client.query("COMMIT");
    return { registered: users.length, missing: names.length - users.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
