import { weekOf } from './week-date.js';
import type { ChangelogView, EntryDraft } from '../shared/changelog.js';
import { verifyPullRequests, type PullRequestLookup } from './changelog-pr.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { membership, membershipWrite, AccessError } from './membership.js';

function uuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  );
}
function required(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim())
    throw new AccessError(400, 'Enter ' + field + '.');
  return value.trim();
}
async function department(db: Pool | PoolClient, user: string) {
  const current = await membership(db, user);
  if (!current)
    throw new AccessError(403, 'Active department membership required.');
  return current.id;
}

export function addProduct(db: Pool, user: string, name: unknown) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
    throw new AccessError(400, 'Enter a product name of up to 100 characters.');
  const productName = name.trim();
  return membershipWrite(db, async (client) => {
    const scope = await department(client, user);
    await client.query(
      'INSERT INTO changelog_products(id,department_id,name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [randomUUID(), scope, productName],
    );
    const result = await client.query(
      'SELECT id,name FROM changelog_products WHERE department_id=$1 AND lower(name)=lower($2)',
      [scope, productName],
    );
    return result.rows[0];
  });
}

export async function readChangelog(
  db: Pool,
  user: string,
  week: unknown,
  mine: boolean,
): Promise<ChangelogView> {
  // Resolve access and both collections against the same membership snapshot.
  const result = await db.query<ChangelogView>(
    `SELECT
      ARRAY(SELECT json_build_object('id',p.id,'name',p.name)
        FROM changelog_products p WHERE p.department_id=d.id ORDER BY lower(p.name)) AS products,
      ARRAY(SELECT json_build_object('id',e.id,'week',e.week,'title',e.title,
          'changed',e.changed,'benefit',e.benefit,'links',e.links,'authorId',u.id,
          'author',u.name,'productId',p.id,'product',p.name)
        FROM changelog_entries e JOIN users u ON u.id=e.author_id
        JOIN changelog_products p ON p.id=e.product_id
        WHERE e.department_id=d.id AND e.week=$2 AND (NOT $3 OR e.author_id=$1)
        ORDER BY e.created_at DESC,e.id) AS entries
      FROM memberships m JOIN departments d ON d.id=m.department_id
      WHERE m.user_id=$1 AND m.deleted_at IS NULL AND d.deleted_at IS NULL`,
    [user, weekOf(week), mine],
  );
  const view = result.rows[0];
  if (!view)
    throw new AccessError(403, 'Active department membership required.');
  return view;
}

export async function saveEntry(
  db: Pool,
  user: string,
  body: EntryDraft,
  lookup?: PullRequestLookup,
  id?: string,
) {
  if (!uuid(body.productId))
    throw new AccessError(400, 'Choose a department product.');
  if (
    !Array.isArray(body.links) ||
    !body.links.length ||
    body.links.some((v: unknown) => typeof v !== 'string')
  )
    throw new AccessError(400, 'Add at least one pull request URL.');
  const draft: EntryDraft = {
    week: weekOf(body.week),
    productId: body.productId,
    links: body.links,
    title: required(body.title, 'a title'),
    changed: required(body.changed, 'what changed'),
    benefit: required(body.benefit, 'why it helps'),
  };
  if (id !== undefined && !uuid(id))
    throw new AccessError(404, 'Entry not found.');
  const scope = await department(db, user);
  if (
    id &&
    !(
      await db.query(
        'SELECT id FROM changelog_entries WHERE id=$1 AND department_id=$2 AND author_id=$3',
        [id, scope, user],
      )
    ).rowCount
  )
    throw new AccessError(404, 'Entry not found.');
  const links = await verifyPullRequests(draft.links, lookup);
  return membershipWrite(db, async (client) => {
    if ((await department(client, user)) !== scope)
      throw new AccessError(403, 'Department membership changed.');
    if (
      !(
        await client.query(
          'SELECT id FROM changelog_products WHERE department_id=$1 AND id=$2',
          [scope, draft.productId],
        )
      ).rowCount
    )
      throw new AccessError(400, 'Choose a department product.');
    const values = [
      id ?? randomUUID(),
      scope,
      user,
      draft.week,
      draft.productId,
      draft.title,
      draft.changed,
      draft.benefit,
      JSON.stringify(links),
    ];
    const result = await client.query(
      id
        ? 'UPDATE changelog_entries SET week=$4,product_id=$5,title=$6,changed=$7,benefit=$8,links=$9 WHERE id=$1 AND department_id=$2 AND author_id=$3 RETURNING id'
        : 'INSERT INTO changelog_entries(id,department_id,author_id,week,product_id,title,changed,benefit,links) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      values,
    );
    if (!result.rowCount) throw new AccessError(404, 'Entry not found.');
    return result.rows[0];
  });
}
