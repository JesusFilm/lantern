import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// All membership writes share this transaction lock, including backend operations.
export async function membershipWrite<T>(db: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(603106)');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function membership(db: Pool | PoolClient, userId: string) {
  const { rows } = await db.query(`SELECT d.id, d.name, m.role FROM memberships m
    JOIN departments d ON d.id = m.department_id
    WHERE m.user_id = $1 AND m.deleted_at IS NULL AND d.deleted_at IS NULL`, [userId]);
  return rows[0] as { id: string; name: string; role: 'member' | 'career-lead' } | undefined;
}

export async function addMember(db: Pool, actorId: string, userId: string) {
  return membershipWrite(db, async (client) => {
    const department = await membership(client, actorId);
    if (department?.role !== 'career-lead') throw new AccessError(403, 'Only the career lead can add users.');
    const target = await client.query('SELECT id FROM users WHERE id::text = $1', [userId]);
    if (!target.rowCount) throw new AccessError(400, 'Select a registered user.');
    const existing = await client.query('SELECT department_id, deleted_at FROM memberships WHERE user_id = $1', [userId]);
    if (existing.rowCount) {
      const row = existing.rows[0];
      if (row.department_id === department.id && !row.deleted_at) return;
      throw new AccessError(409, row.department_id === department.id
        ? 'Rejoining is not yet supported.' : 'This user belongs to another department.');
    }
    await client.query("INSERT INTO memberships(user_id, department_id, role) VALUES ($1, $2, 'member')", [userId, department.id]);
  });
}

export async function configureDomains(db: Pool, domains: string[]) {
  const normalized = [...new Set(domains.map((value) => value.trim().toLowerCase()))];
  if (!normalized.length || normalized.some((value) => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(value))) {
    throw new Error('Supply at least one valid work domain.');
  }
  await membershipWrite(db, async (client) => {
    const leads = await client.query(`SELECT u.hosted_domain FROM memberships m JOIN users u ON u.id=m.user_id
      WHERE m.role='career-lead' AND m.deleted_at IS NULL`);
    if (leads.rows.some((row) => !normalized.includes(row.hosted_domain))) throw new Error('Preserve the career lead’s approved domain.');
    await client.query('DELETE FROM allowed_domains');
    await client.query('INSERT INTO allowed_domains SELECT unnest($1::text[])', [normalized]);
  });
}

export async function setupDepartment(db: Pool, name: string, leadEmail: string) {
  if (!name.trim() || !leadEmail.trim()) throw new Error('Department name and registered career-lead email are required.');
  await membershipWrite(db, async (client) => {
    const users = await client.query(`SELECT u.id FROM users u JOIN allowed_domains a ON a.domain=u.hosted_domain
      WHERE lower(u.email)=lower($1)`, [leadEmail.trim()]);
    if (users.rowCount !== 1) throw new Error('Career lead must first register with an approved Google work account; email must identify one account.');
    const leadId = users.rows[0].id;
    const departments = await client.query('SELECT id, name, deleted_at FROM departments');
    if (departments.rowCount) {
      const lead = await membership(client, leadId);
      if (departments.rowCount === 1 && lead?.role === 'career-lead' && lead.name === name.trim()) return;
      throw new Error('Setup already exists. Additional departments, lead transfer and restoration are not supported.');
    }
    const id = randomUUID();
    await client.query('INSERT INTO departments(id,name) VALUES($1,$2)', [id, name.trim()]);
    await client.query("INSERT INTO memberships(user_id,department_id,role) VALUES($1,$2,'career-lead')", [leadId, id]);
  });
}

export async function removeMember(db: Pool, userId: string) {
  await membershipWrite(db, async (client) => {
    const result = await client.query('SELECT role FROM memberships WHERE user_id::text=$1', [userId]);
    if (!result.rowCount) throw new Error('Membership not found.');
    if (result.rows[0].role === 'career-lead') throw new Error('Cannot remove the single career lead.');
    await client.query('UPDATE memberships SET deleted_at=COALESCE(deleted_at,now()) WHERE user_id::text=$1', [userId]);
  });
}
