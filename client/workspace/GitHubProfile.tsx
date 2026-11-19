import { useEffect, useState } from 'react';
import type { GitHubProfile as Profile } from '../../shared/github.js';
import { api } from './api.js';
import { InlineProfileField } from './InlineProfileField.js';

export function GitHubProfile() {
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    void api<Profile>('/api/integrations/github/profile', 'GET', undefined, controller.signal)
      .then(setProfile).catch(error => { if (!controller.signal.aborted) setError((error as Error).message); });
    return () => controller.abort();
  }, [reload]);
  return <div>
    <dt>GitHub</dt>
    <dd>
      {error ? <span role="alert">{error} <button type="button" className="link" onClick={() => setReload(value => value + 1)}>Retry</button></span>
        : !profile ? <span className="muted">Loading…</span>
        : <InlineProfileField value={profile.username} label="GitHub username" maxLength={40} username
            onSave={async username => {
              const saved = await api<Profile>('/api/integrations/github/profile', 'PATCH', { username });
              setProfile(saved);
              return saved.username;
            }} />}
    </dd>
  </div>;
}
