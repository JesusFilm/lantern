import { weekOf } from './week-date.js';
import type { ChangelogView, EntryDraft } from '../shared/changelog.js';
import { verifyPullRequests, type PullRequestLookup } from './changelog-pr.js';
import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { membership, membershipWrite, AccessError } from './membership.js';

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
          'revision',e.revision,'author',u.name,'productId',p.id,'product',p.name)
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

function staleRevision() {
  return new AccessError(409, 'A newer version was saved. Copy your changes, then cancel and reopen the entry to apply them.');
}

async function findPublication(
  connection: Pool | PoolClient,
  scope: string,
  user: string,
  publicationKey: string,
  publicationHash: string,
) {
  const result = await connection.query<{ id: string; publication_hash: string }>(
    `SELECT e.id, e.publication_hash FROM changelog_entries e
     JOIN memberships m ON m.department_id=e.department_id AND m.user_id=e.author_id
     JOIN departments d ON d.id=m.department_id
     WHERE e.department_id=$1 AND e.author_id=$2 AND e.publication_key=$3
       AND m.deleted_at IS NULL AND d.deleted_at IS NULL`,
    [scope, user, publicationKey],
  );
  const prior = result.rows[0];
  if (!prior) return undefined;
  if (prior.publication_hash !== publicationHash)
    throw new AccessError(409, 'This draft was already published with different content. Open the published entry to edit it.');
  return { id: prior.id };
}

export type EntryOperation = { publicationKey: string } | { id: string; revision: number };

export async function saveEntry(
  db: Pool,
  user: string,
  body: EntryDraft,
  operation: EntryOperation,
  lookup?: PullRequestLookup,
) {
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
  const scope = await department(db, user);
  // Hash the original draft so a replay remains identifiable after later edits.
  const publicationHash = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
  if ('id' in operation) {
    const current = await db.query<{ revision: number }>(
      'SELECT revision FROM changelog_entries WHERE id=$1 AND department_id=$2 AND author_id=$3',
      [operation.id, scope, user],
    );
    if (!current.rows[0]) throw new AccessError(404, 'Entry not found.');
    if (current.rows[0].revision !== operation.revision) throw staleRevision();
  } else {
    const prior = await findPublication(db, scope, user, operation.publicationKey, publicationHash);
    if (prior) return prior;
  }
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
      'id' in operation ? operation.id : randomUUID(),
      scope,
      user,
      draft.week,
      draft.productId,
      draft.title,
      draft.changed,
      draft.benefit,
      JSON.stringify(links),
    ];
    if ('id' in operation) {
      const saved = await client.query(
        `UPDATE changelog_entries SET week=$4,product_id=$5,title=$6,changed=$7,
           benefit=$8,links=$9,revision=revision+1
         WHERE id=$1 AND department_id=$2 AND author_id=$3 AND revision=$10 RETURNING id`,
        [...values, operation.revision],
      );
      if (!saved.rowCount) throw staleRevision();
      return saved.rows[0];
    }
    const saved = await client.query(
      `INSERT INTO changelog_entries
         (id,department_id,author_id,week,product_id,title,changed,benefit,links,publication_key,publication_hash)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (department_id,author_id,publication_key) DO NOTHING RETURNING id`,
      [...values, operation.publicationKey, publicationHash],
    );
    if (saved.rowCount) return saved.rows[0];
    const prior = await findPublication(client, scope, user, operation.publicationKey, publicationHash);
    if (!prior) throw new Error('Committed publication could not be read.');
    return prior;
  });
}
