import { useEffect, useState } from 'react';
import type { DiscoveryResults } from '../../shared/changelog.js';
import { api } from './api.js';

function searchMessage(result?: DiscoveryResults) {
  if (!result) return 'Finding pull requests…';
  switch (result.status) {
    case 'missing-username': return 'Save your GitHub username in Account to find your PRs, or paste a link below.';
    case 'unavailable': return 'PR search is unavailable. Paste a link below or retry.';
    case 'partial': return 'Some pull requests could not be checked. Paste a missing link below or retry.';
    case 'complete': return result.links.length ? '' : 'No matching pull requests this week. You can paste a link below.';
  }
}

export function ChangelogPicker({
  week,
  links,
  onAdd,
}: {
  week: string;
  links: string;
  onAdd: (url: string) => void;
}) {
  const [result, setResult] = useState<DiscoveryResults>();
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!week) return;
    const controller = new AbortController();
    void api<DiscoveryResults>(
      '/api/changelog/pull-requests?' +
        new URLSearchParams({
          week,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      'GET',
      undefined,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ status: 'unavailable', links: [] });
      });
    return () => controller.abort();
  }, [week, attempt]);
  if (!week) return null;
  const selected = new Set(links.split(/\s+/));
  return (
    <section aria-label="Find pull requests">
      <h2>Your merged pull requests</h2>
      <p role="status">{searchMessage(result)}</p>
      {result && result.links.length > 0 && (
        <ul>
          {result.links.map((pr) => (
            <li key={pr.url}>
              <a href={pr.url} target="_blank" rel="noreferrer">
                {pr.title}
              </a>{' '}
              <button
                type="button"
                disabled={selected.has(pr.url)}
                aria-label={'Add ' + pr.title}
                onClick={() => onAdd(pr.url)}
              >
                {selected.has(pr.url) ? 'Added' : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {result && result.status !== 'complete' && (
        <button
          type="button"
          onClick={() => {
            setResult(undefined);
            retry((n) => n + 1);
          }}
        >
          Retry PR search
        </button>
      )}
    </section>
  );
}
