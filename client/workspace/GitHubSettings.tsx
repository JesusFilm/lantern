import { useEffect, useRef, useState } from 'react';
import type { GitHubConnectionStatus } from '../../shared/github.js';
import { api } from './api.js';

export function GitHubSettings() {
  const [status, setStatus] = useState<GitHubConnectionStatus>();
  const [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const popup = useRef<Window | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    void api<GitHubConnectionStatus>('/api/integrations/github', 'GET', undefined, controller.signal)
      .then(setStatus).catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!connecting) return;
    let stopped = false;
    const revision = status?.revision;
    const update = () => {
      void api<GitHubConnectionStatus>('/api/integrations/github').then(next => {
        if (stopped) return;
        setStatus(next);
        if (next.connected && next.revision !== revision) setConnecting(false);
      }).catch(e => { if (!stopped) setError((e as Error).message); });
    };
    const message = (event: MessageEvent) => {
      if (event.origin === location.origin && event.source === popup.current && event.data?.type === 'lantern-github-connected') update();
    };
    const timer = window.setInterval(() => {
      update();
      if (popup.current?.closed) setConnecting(false);
    }, 2500);
    const expiry = window.setTimeout(() => setConnecting(false), 20 * 60000);
    window.addEventListener('message', message);
    return () => { stopped = true; window.clearInterval(timer); window.clearTimeout(expiry); window.removeEventListener('message', message); };
  }, [connecting]);
  function connect() {
    setError('');
    popup.current = window.open('/auth/github/connect', 'lantern-github-connect', 'popup,width=900,height=780');
    if (popup.current) setConnecting(true);
    else setError('Allow a pop-up window to connect GitHub.');
  }
  return <section>
    <h2>GitHub connection</h2>
    <p>Choose which GitHub repositories and projects are available for your department’s weekly goals.</p>
    {error && <p role="alert">{error} <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
    {!status && !error && <p role="status">Loading GitHub connection…</p>}
    {status && <>
      <p>{status.connected ? `Connected to ${status.account ?? 'GitHub'}.` : 'GitHub is not connected.'}</p>
      {status.available ? <button type="button" onClick={connect}>{connecting ? 'Continue GitHub setup' : status.connected ? 'Manage connection' : 'Connect GitHub'}</button>
        : <p>Ask your Lantern administrator to set up the shared GitHub App.</p>}
    </>}
  </section>;
}
