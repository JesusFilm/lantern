import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { isAdmitted, normalizeEmail } from './admission.js';
import type { Identity } from './identity.js';

// Provider-verified identity is the only account input. Approval creates neither
// membership nor authority. Roll back the profile too if session persistence fails.
export async function registerSession(db: Pool, identity: Identity, tokenHash: string, oldTokenHash: string | undefined) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Share the access-write lock with enrollment and administrative recovery.
    await client.query('SELECT pg_advisory_xact_lock(603106)');
    if (!await isAdmitted(client, identity)) {
      await client.query('ROLLBACK');
      return false;
    }
    const collision = await client.query(`SELECT 1 FROM users
      WHERE lower(btrim(email))=$1 AND google_sub<>$2 LIMIT 1`,
    [normalizeEmail(identity.email), identity.sub]);
    if (collision.rowCount) {
      // Preserve a short-lived, server-verified identity receipt for an explicit
      // administrative recovery. It creates no account, session or authority.
      await client.query("DELETE FROM auth_identity_candidates WHERE verified_at<=now()-interval '1 day'");
      if (identity.sub.startsWith('jesusfilm:')) await client.query(`INSERT INTO auth_identity_candidates(subject,email,verified_at)
        VALUES($1,$2,now()) ON CONFLICT(subject) DO UPDATE SET email=EXCLUDED.email,verified_at=EXCLUDED.verified_at`,
      [identity.sub, normalizeEmail(identity.email)]);
      await client.query('COMMIT');
      return false;
    }
    const user = await client.query(`INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)
      ON CONFLICT(google_sub) DO UPDATE SET email=EXCLUDED.email RETURNING id`,
    [randomUUID(), identity.sub, normalizeEmail(identity.email), identity.name]);
    await client.query("DELETE FROM auth_identity_candidates WHERE subject=$1 OR verified_at<=now()-interval '1 day'", [identity.sub]);
    if (oldTokenHash) await client.query('DELETE FROM sessions WHERE token_hash=$1', [oldTokenHash]);
    await client.query('DELETE FROM sessions WHERE expires_at<=now()');
    await client.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [tokenHash, user.rows[0].id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
