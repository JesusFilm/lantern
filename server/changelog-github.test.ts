import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { changelogGitHub } from './changelog-github.js';

const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const config = { appId: '12', installationId: '34', privateKey };
test('the hosted app verifies merges and discovers authored and commit-contributed default-branch work', async () => {
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(init?.redirect, 'error');
    if (url.pathname === '/app/installations/34/access_tokens') {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        permissions: { pull_requests: 'read', metadata: 'read' },
      });
      return Response.json({
        token: 'installation',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
    }
    assert.equal(
      new Headers(init?.headers).get('authorization'),
      'Bearer installation',
    );
    if (url.pathname === '/search/issues') {
      assert.match(
        url.searchParams.get('q')!,
        /org:JesusFilm.*merged:2026-11-22\.\.2026-11-30/,
      );
      const items = [1, 2, 3, 4, 5, 6, 7].map((number) => ({
        repository_url: 'https://api.github.com/repos/JesusFilm/video',
        number,
      }));
      return Response.json({
        items,
        total_count: items.length,
        incomplete_results: false,
      });
    }
    if (url.pathname.endsWith('/commits'))
      return Response.json([
        {
          author: { login: url.pathname.includes('/7/') ? 'member' : 'peer' },
          committer: {
            login: url.pathname.includes('/2/') ? 'MEMBER' : 'peer',
          },
        },
      ]);
    const number = Number(url.pathname.split('/').pop());
    if (number === 6) return new Response(null, { status: 403 });
    return Response.json({
      title: 'Change ' + number,
      merged: true,
      merged_at: number === 4 ? '2026-11-29T12:00:00Z' : '2026-11-22T12:00:00Z',
      user: { login: [1, 3, 4].includes(number) ? 'member' : 'peer' },
      commits: 1,
      base: {
        ref: number === 3 ? 'release' : 'main',
        repo: { default_branch: 'main' },
      },
    });
  };
  const app = changelogGitHub(config, transport);
  assert.deepEqual(await app.pullRequest('video', '4'), {
    title: 'Change 4',
    merged: true,
    base: 'main',
    defaultBranch: 'main',
  });
  assert.deepEqual(
    await app.discoverPullRequests('member', '2026-11-23', 'Pacific/Auckland'),
    {
      status: 'partial',
      links: [1, 2, 7].map((n) => ({
        title: 'Change ' + n,
        url: 'https://github.com/JesusFilm/video/pull/' + n,
      })),
    },
  );
});

test('retry renews a rejected installation token and reports a complete empty week', async () => {
  let issued = 0;
  const reader = changelogGitHub(config, async (url, init) => {
    if (String(url).endsWith('/access_tokens')) {
      issued++;
      return Response.json({ token: 'token-' + issued, expires_at: new Date(Date.now() + 3600000).toISOString() });
    }
    if (new Headers(init?.headers).get('authorization') === 'Bearer token-1')
      return new Response(null, { status: 401 });
    return Response.json({ items: [], total_count: 0, incomplete_results: false });
  });
  const search = () => reader.discoverPullRequests('member', '2026-11-23', 'UTC');
  assert.deepEqual(await search(), { status: 'unavailable', links: [] });
  assert.deepEqual(await search(), { status: 'complete', links: [] });
});
