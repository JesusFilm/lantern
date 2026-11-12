import type { Pool } from "pg";
import { normalizeEmail, isAdmitted } from "./admission.js";

/** Administrative operation. The operator obtains subject/email from trusted Auth records first. */
export async function linkJesusFilmIdentity(db: Pool, userId: string, subject: string, expectedEmail: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId) ||
    !subject || subject.length > 255 || /\s/.test(subject) || subject.startsWith("jesusfilm:")) throw new Error("Supply an account UUID, raw Auth subject and exact verified email.");
  const email = normalizeEmail(expectedEmail);
  const principal = `jesusfilm:${subject}`;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT id,email,google_sub FROM users WHERE id=$1 FOR UPDATE", [userId]);
    const user = result.rows[0] as { id: string; email: string; google_sub: string } | undefined;
    if (!user || normalizeEmail(user.email) !== email || !await isAdmitted(client, { email })) throw new Error();
    if (user.google_sub !== principal) {
      if (user.google_sub.startsWith("jesusfilm:")) throw new Error();
      await client.query("UPDATE users SET google_sub=$1 WHERE id=$2", [principal, userId]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    throw new Error("Account match refused. Verify the approved account, verified email and unclaimed Auth subject.");
  } finally { client.release(); }
}
