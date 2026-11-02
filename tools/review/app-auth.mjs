import { createSign } from 'node:crypto';

const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

export function appJwt({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: String(appId), iat: now - 60, exp: now + 540 })}`;
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url')}`;
}

async function github(fetch, jwt, method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GitHub App request ${method} ${path} failed with status ${response.status}`);
  return response.json();
}

export async function installationToken({ fetch, appId, privateKey, repository }) {
  const jwt = appJwt({ appId, privateKey });
  const [, name] = repository.split('/');
  const installation = await github(fetch, jwt, 'GET', `/repos/${repository}/installation`);
  const { token } = await github(fetch, jwt, 'POST', `/app/installations/${installation.id}/access_tokens`, {
    repositories: [name],
    permissions: { checks: 'write', pull_requests: 'write', contents: 'read' },
  });
  if (!token) throw new Error('GitHub App installation token missing from response');
  return token;
}
