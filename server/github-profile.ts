import type { Pool } from 'pg';
import { AccessError, membership, membershipWrite } from './membership.js';

export function githubProfileStore(db: Pool) {
  return {
    async get(userId: string) {
      const result = await db.query<{ username: string | null }>('SELECT github_username AS username FROM users WHERE id=$1', [userId]);
      return { username: result.rows[0]?.username ?? '' };
    },
    async save(userId: string, username: string) {
      if (username && (username.includes('--') || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username)))
        throw new AccessError(400, 'Enter a GitHub username of up to 39 letters, numbers or hyphens.');
      return membershipWrite(db, async client => {
        if (!await membership(client, userId)) throw new AccessError(403, 'Active department membership is required.');
        await client.query('UPDATE users SET github_username=$1 WHERE id=$2', [username || null, userId]);
        return { username };
      });
    },
  };
}
