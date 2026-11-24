import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, GitBranch, Search } from 'lucide-react';
import type { PositionFocus } from '../../shared/focus.js';
import type { GitHubConnectionStatus, GitHubRepositoryChoice, GitHubWorkItem, GitHubWorkKind, GitHubWorkResults } from '../../shared/github.js';
import type { ExternalWorkKind, WeeklyGoalLinkDraft } from '../../shared/weekly.js';
import { api } from './api.js';
import { formatFocusDate } from './focusDate.js';
import { Dialog } from './Dialog.js';

export function WeeklyLinkDialog({ initial, targetEnabled = false, focuses, focusError, retryFocuses, onLink, onClose }: {
  initial?: WeeklyGoalLinkDraft; targetEnabled?: boolean; focuses?: PositionFocus[]; focusError: string; retryFocuses: () => void;
  onLink: (link: WeeklyGoalLinkDraft) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<'github' | 'focus' | 'url'>(initial && initial.kind !== 'focus' ? 'url' : 'focus');
  const [status, setStatus] = useState<GitHubConnectionStatus>();
  const [connectionError, setConnectionError] = useState(''), [refresh, setRefresh] = useState(0);
  const [kind, setKind] = useState<GitHubWorkKind>('repository'), [query, setQuery] = useState('');
  const [repository, setRepository] = useState(''), [closed, setClosed] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepositoryChoice[]>([]);
  const [repositoryError, setRepositoryError] = useState('');
  const [results, setResults] = useState<GitHubWorkResults>({ items: [] });
  const [selected, setSelected] = useState<GitHubWorkItem>();
  const [loading, setLoading] = useState(false), [searchError, setSearchError] = useState(''), [searchRetry, setSearchRetry] = useState(0);
  const [focusQuery, setFocusQuery] = useState(''), [focusId, setFocusId] = useState(initial?.kind === 'focus' ? initial.focusId : '');
  const [targetChoice, setTargetChoice] = useState(initial?.kind === 'focus' && initial.target ? (initial.target.goal === null ? `objective:${initial.target.section}` : `goal:${initial.target.section}:${initial.target.goal}`) : '');
  const selectedFocus = focuses?.find(focus => focus.id === focusId);
  const [linkKind, setLinkKind] = useState<ExternalWorkKind>(initial && initial.kind !== 'focus' ? initial.kind : 'other');
  const [url, setUrl] = useState(initial && initial.kind !== 'focus' ? initial.url : '');
  const [label, setLabel] = useState(initial && initial.kind !== 'focus' ? initial.label : '');
  const key = JSON.stringify([kind, query, repository, closed, refresh, searchRetry]);
  const activeSearch = useRef(key); activeSearch.current = key;
  useEffect(() => {
    const controller = new AbortController(); setConnectionError('');
    void api<GitHubConnectionStatus>('/api/integrations/github', 'GET', undefined, controller.signal)
      .then(setStatus).catch(error => { if (!controller.signal.aborted) setConnectionError((error as Error).message); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!status?.connected) return;
    const controller = new AbortController(); setRepositoryError('');
    void api<GitHubRepositoryChoice[]>('/api/integrations/github/repositories', 'GET', undefined, controller.signal)
      .then(setRepositories).catch(error => { if (!controller.signal.aborted) setRepositoryError((error as Error).message); });
    return () => controller.abort();
  }, [status?.connected, refresh]);
  function searchPath(cursor = '') {
    return '/api/integrations/github/search?' + new URLSearchParams({ kind, q: query, repository: kind === 'issue' ? repository : '', cursor, closed: String(closed) });
  }
  useEffect(() => {
    if (mode !== 'github' || !status?.connected) return;
    const controller = new AbortController(); setSelected(undefined); setResults({ items: [] }); setSearchError(''); setLoading(true);
    const timer = window.setTimeout(() => {
      void api<GitHubWorkResults>(searchPath(), 'GET', undefined, controller.signal).then(setResults)
        .catch(error => { if (!controller.signal.aborted) setSearchError((error as Error).message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [mode, status?.connected, key]);
  async function more() {
    const current = key; setLoading(true); setSearchError('');
    try {
      const next = await api<GitHubWorkResults>(searchPath(results.next));
      if (activeSearch.current === current) setResults(previous => ({ items: [...previous.items, ...next.items], next: next.next, notice: next.notice ?? previous.notice }));
    } catch (error) { if (activeSearch.current === current) setSearchError((error as Error).message); }
    finally { if (activeSearch.current === current) setLoading(false); }
  }
  async function save() {
    if (mode === 'github') {
      if (!selected) throw new Error('Choose a GitHub item.');
      onLink({ kind: selected.kind, label: selected.label.slice(0, 200), url: selected.url });
    } else if (mode === 'focus') {
      if (!focusId) throw new Error('Choose a position focus.');
      const parts = targetChoice.split(':');
      const target = !targetEnabled && initial?.kind === 'focus' && initial.focusId === focusId ? initial.target : targetEnabled && selectedFocus?.status === 'confirmed' && targetChoice ? {version:selectedFocus.version, section:Number(parts[1]), goal:parts[0] === 'goal' ? Number(parts[2]) : null} : undefined;
      onLink({ kind: 'focus', focusId, ...(target ? {target} : {}) });
    } else {
      let parsed: URL;
      try { parsed = new URL(url); } catch { throw new Error('Enter a valid web address.'); }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Enter a web address without embedded credentials.');
      const name = label.trim() || decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) ?? parsed.hostname).slice(0, 200);
      onLink({ kind: linkKind, label: name, url: parsed.href });
    }
    onClose();
  }
  return createPortal(<Dialog title={initial ? 'Edit linked work' : 'Link work to this goal'} onClose={onClose} onSave={save}
    fullScreen closeLabel="Close link picker"
    saveLabel={initial ? 'Update link' : 'Add link'} saveDisabled={mode === 'github' ? !selected || !status?.connected : mode === 'focus' ? !focusId : !url.trim()}>
    <div className="weekly-link-dialog">
      <div className="weekly-link-controls">
      <div className="weekly-link-sources" role="group" aria-label="Link source">
        <button type="button" aria-pressed={mode === 'focus'} onClick={() => setMode('focus')}>Position focus</button>
        {([['repository', 'Repositories'], ['project', 'Projects'], ['issue', 'Issues']] as const).map(([value, title]) => <button type="button" key={value} aria-pressed={mode === 'github' && kind === value} onClick={() => { setMode('github'); setKind(value); setQuery(''); }}>{title}</button>)}
        <button type="button" aria-pressed={mode === 'url'} onClick={() => setMode('url')}>URL</button>
      </div>
      {mode === 'focus' && <input type="search" autoFocus aria-label="Search position focuses" placeholder="Search your position focuses…" value={focusQuery} onChange={e => setFocusQuery(e.target.value)} />}
      {mode === 'github' && status?.connected && <>
        <p className="weekly-personal-order">{status.username ? `Your work first · @${status.username}` : <>Personalise your results: add your GitHub username in <a href="/?page=account">Account</a>.</>}</p>
        <label className="weekly-github-search"><Search size={17} /><input autoFocus type="search" aria-label="Search GitHub" maxLength={200} value={query} placeholder={`Search ${kind === 'repository' ? 'repositories' : kind === 'project' ? 'projects' : 'issues'}…`} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} /></label>
        <div className="weekly-github-filters">
          {kind === 'issue' && <select aria-label="Filter issues by repository" value={repository} onChange={e => setRepository(e.target.value)}><option value="">All connected repositories</option>{repositories.map(repo => <option value={repo.fullName} key={repo.fullName}>{repo.fullName}</option>)}</select>}
          {kind !== 'repository' && <label><input type="checkbox" checked={closed} onChange={e => setClosed(e.target.checked)} /> Include closed</label>}
        </div>
      </>}
      </div>
      <div className="weekly-link-scroll">
      {mode === 'github' ? <>
        {connectionError && <p role="alert">{connectionError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
        {!status && !connectionError && <p role="status">Loading GitHub connection…</p>}
        {status && !status.connected && <div className="weekly-github-connect"><GitBranch size={28} /><h3>Find your work on GitHub</h3>
          <p>Your team’s Lantern GitHub App makes its repositories, projects and issues available here.</p>

          <p>Ask your career lead to connect GitHub in Department → Settings. You can still add a position focus or use URL.</p>
          <small>One shared Lantern app. No app registration or tokens needed for developers.</small>
        </div>}
        {status?.connected && <>
          {repositoryError && kind === 'issue' && <p role="alert">{repositoryError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
          {searchError && <p role="alert">{searchError} <button type="button" onClick={() => setSearchRetry(value => value + 1)}>Retry</button></p>}
          {results.notice && <p className="weekly-personal-notice">{results.notice}</p>}
          <div className="weekly-link-results" aria-label="GitHub results" aria-busy={loading}>
            {results.items.map(item => <button type="button" key={item.id} className="weekly-link-result" aria-pressed={selected?.id === item.id} onClick={() => setSelected(item)}>
              <span><strong>{item.label}</strong>{item.relevance?.length ? <span className="weekly-work-relevance">{item.relevance.join(' · ')}</span> : null}{item.repository && <small>{item.repository}{item.state ? ' · ' + item.state : ''}</small>}{item.description && <small>{item.description}</small>}</span>{selected?.id === item.id && <Check size={18} />}
            </button>)}
            {loading && <p role="status">Loading {kind === 'repository' ? 'repositories' : kind === 'project' ? 'projects' : 'issues'}…</p>}
            {!loading && !searchError && !results.items.length && <p className="weekly-link-empty">No matching {kind === 'repository' ? 'repositories' : kind === 'project' ? 'projects' : 'issues'}. Try another search or check which repositories the app can access.</p>}
          </div>
          {results.next && !loading && <button type="button" className="weekly-load-more" onClick={() => void more()}>Load more</button>}
        </>}
      </> : mode === 'focus' ? <>
        {focusError && <p role="alert">{focusError} <button type="button" onClick={retryFocuses}>Retry</button></p>}
        {!focuses && !focusError && <p role="status">Loading position focuses…</p>}
        <div className="weekly-link-results">{focuses?.filter(focus => focus.title.toLowerCase().includes(focusQuery.toLowerCase())).map(focus => <button type="button" className="weekly-link-result" aria-pressed={focusId === focus.id} key={focus.id} onClick={() => {setFocusId(focus.id);setTargetChoice('')}}><span><strong>{focus.title}</strong><small>{formatFocusDate(focus.start)} – {formatFocusDate(focus.end)}</small></span>{focusId === focus.id && <Check size={18} />}</button>)}</div>
        {targetEnabled && selectedFocus && (selectedFocus.status === 'confirmed' ? <label>Link to<select aria-label="Link to" value={targetChoice} onChange={event => setTargetChoice(event.target.value)}><option value="">Whole position focus</option>{selectedFocus.sections.map((section,i) => <optgroup key={i} label={`Objective ${i+1}`}><option value={`objective:${i}`}>{section.objective}</option>{section.goals.map((goal,j) => <option key={j} value={`goal:${i}:${j}`}>SMART goal {j+1}: {goal}</option>)}</optgroup>)}</select></label> : <p className="muted">Drafts link to the whole focus. Confirm the focus before linking a specific objective or SMART goal.</p>)}
        {focuses?.length === 0 && <p className="weekly-link-empty">No saved position focuses yet.</p>}
      </> : <div className="weekly-manual-link">
        <label>URL<input autoFocus required type="url" maxLength={2048} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></label>
        <label>Name <span className="muted">(optional)</span><input maxLength={200} value={label} onChange={e => setLabel(e.target.value)} placeholder="A short name for this link" /></label>
        <label>Work type<select value={linkKind} onChange={e => setLinkKind(e.target.value as ExternalWorkKind)}><option value="other">Other work</option><option value="project">Project</option><option value="repository">Repository</option><option value="issue">Issue</option></select></label>
      </div>}
      </div>
    </div>
  </Dialog>, document.body);
}
