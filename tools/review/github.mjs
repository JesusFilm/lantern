export async function api(fetch, token, method, path, { body, accept = 'application/vnd.github+json' } = {}) {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
}

export async function listAll(fetch, token, path) {
  const items = [];
  for (let page = 1; page <= 10; page++) {
    const response = await api(fetch, token, 'GET', `${path}?per_page=100&page=${page}`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const batch = await response.json();
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}
