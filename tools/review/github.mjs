export async function api(fetch, token, method, path, { body, accept = 'application/vnd.github+json' } = {}) {
  return fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
}

export const LIST_MAX_PAGES = 30;

// A full last page at the page limit may hide more items, so it is reported as truncated rather than treated as complete.
export async function listAll(fetch, token, path, maxPages = LIST_MAX_PAGES) {
  const items = [];
  for (let page = 1; page <= maxPages; page++) {
    const response = await api(fetch, token, 'GET', `${path}?per_page=100&page=${page}`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    const batch = await response.json();
    items.push(...batch);
    if (batch.length < 100) return { items, truncated: false };
  }
  return { items, truncated: true };
}
