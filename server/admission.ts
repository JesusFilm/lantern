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

export async function isAdmitted(db: Database, identity: { email: string }) {
  const result = await db.query('SELECT 1 FROM approved_emails WHERE email=$1', [normalizeEmail(identity.email)]);
  return result.rowCount === 1;
}
