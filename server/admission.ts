import type { Pool, PoolClient } from 'pg';

type Database = Pool | PoolClient;
export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@*]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(normalized)) {
    throw new Error('Supply an exact email address.');
  }
  return normalized;
}
export async function approveEmail(db: Database, email: string) {
  await db.query('INSERT INTO approved_emails(email) VALUES($1) ON CONFLICT DO NOTHING', [normalizeEmail(email)]);
}
export async function revokeEmail(db: Database, email: string) {
  await db.query('DELETE FROM approved_emails WHERE email=$1', [normalizeEmail(email)]);
}
export async function approvedEmails(db: Database): Promise<string[]> {
  const result = await db.query('SELECT email FROM approved_emails ORDER BY email');
  return result.rows.map(row => row.email as string);
}

export type AdmissionPolicy = 'local' | 'stage' | 'production';
export function admissionPolicy(environment: string | undefined): AdmissionPolicy {
  if (environment === undefined) return 'production';
  if (environment === 'local' || environment === 'stage' || environment === 'production') return environment;
  throw new Error('LANTERN_ENV must be local, stage or production.');
}

// Null means Google supplied no hosted-domain claim. A claimed work domain must
// always be approved; an email suffix is never a substitute for that claim.
export async function isAdmitted(db: Database, identity: { email: string; hostedDomain: string | null }, policy: AdmissionPolicy = 'production') {
  const result = await db.query(`SELECT 1 FROM approved_emails WHERE email=$1 AND (
    ($2::text IS NULL AND $3::boolean) OR EXISTS (SELECT 1 FROM allowed_domains WHERE domain=$2)
  )`, [normalizeEmail(identity.email), identity.hostedDomain, policy === 'local' || policy === 'stage']);
  return result.rowCount === 1;
}
