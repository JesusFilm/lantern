import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { isAdmitted, normalizeEmail, type AdmissionPolicy } from './admission.js';
import type { Identity } from './google.js';

// Provider-verified identity is the only account input. Approval creates neither
// membership nor authority. Roll back the profile too if session persistence fails.
export async function registerSession(db: Pool, identity: Identity, tokenHash: string, oldTokenHash: string | undefined, policy?: AdmissionPolicy) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    if (!await isAdmitted(client, identity, policy)) {
      await client.query('ROLLBACK');
      return false;
    }
    const user = await client.query(`INSERT INTO users(id,google_sub,email,name,hosted_domain) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(google_sub) DO UPDATE SET email=EXCLUDED.email,hosted_domain=EXCLUDED.hosted_domain RETURNING id`,
    [randomUUID(), identity.sub, normalizeEmail(identity.email), identity.name, identity.hostedDomain]);
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
