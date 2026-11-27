import type { Pool } from 'pg';
import { AccessError } from './membership.js';

interface DepartmentSummary {
  id: string;
  name: string;
}

export interface OwnerPrincipal {
  email: string;
  listDepartments(): Promise<{ departments: DepartmentSummary[] }>;
}

/** Resolve a verified JFP One subject to owner authority through its linked Lantern account. */
export async function linkedOwner(db: Pool, ownerEmails: ReadonlySet<string>, subject: string): Promise<OwnerPrincipal> {
  const { rows: [account] } = await db.query<{ email: string }>(
    `SELECT lower(btrim(linked.email)) AS email FROM users linked
     WHERE linked.google_sub=$1
       AND NOT EXISTS (
         SELECT 1 FROM users other
         WHERE other.id<>linked.id AND lower(btrim(other.email))=lower(btrim(linked.email))
       )
       AND NOT EXISTS (
         SELECT 1 FROM auth_identity_candidates candidate
         WHERE candidate.subject<>linked.google_sub AND candidate.email=lower(btrim(linked.email))
           AND candidate.verified_at>now()-interval '1 day'
       )`,
    ['jesusfilm:' + subject],
  );
  if (!account || !ownerEmails.has(account.email)) {
    throw new AccessError(403, 'Lantern owner access is required.');
  }
  return {
    email: account.email,
    async listDepartments() {
      const { rows } = await db.query<DepartmentSummary>(
        'SELECT id, name FROM departments WHERE deleted_at IS NULL ORDER BY lower(name), id',
      );
      return { departments: rows };
    },
  };
}
