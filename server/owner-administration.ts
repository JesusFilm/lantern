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
    'SELECT lower(btrim(email)) AS email FROM users WHERE google_sub=$1',
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
