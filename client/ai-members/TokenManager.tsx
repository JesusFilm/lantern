import { useState } from 'react';
import type { AiMemberDetail, AiMemberToken } from '../../shared/ai-members.js';
import { api } from '../workspace/api.js';

export function TokenManager({ member }: { member: AiMemberDetail }) {
  const [tokens, setTokens] = useState(member.tokens), [name, setName] = useState('');
  const [secret, setSecret] = useState(''), [revealed, setRevealed] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const path = '/api/ai-members/' + member.id + '/tokens';
  async function action(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function issue(token?: AiMemberToken) {
    const result = await api<{ token: AiMemberToken; secret: string }>(token ? path + '/' + token.id + '/rotate' : path, 'POST', token ? { credentialRevision: token.credentialRevision } : { name });
    setTokens(current => token ? current.map(t => t.id === token.id ? result.token : t) : [...current, result.token]);
    setSecret(result.secret); setRevealed(false); setCopied(false); setName('');
  }
  return <section className="ai-tokens" aria-label="Named tokens">
    <h3>Named tokens</h3><p>Token actions take effect immediately. Profile Save and Cancel do not change them. Saved secrets cannot be revealed again.</p>
    {error && <p role="alert">{error}</p>}
    {secret ? <div className="ai-secret" role="region" aria-label="Issued token">
      <p>Store this secret now. Closing this interaction clears it; lost secrets must be regenerated.</p>
      <label>New token secret<input readOnly type={revealed ? 'text' : 'password'} value={secret} autoComplete="off" spellCheck={false} /></label>
      <div className="ai-actions"><button type="button" onClick={() => setRevealed(v => !v)}>{revealed ? 'Hide token' : 'Reveal token'}</button>
        <button type="button" onClick={() => void action(async () => { await navigator.clipboard.writeText(secret); setCopied(true); })}>Copy token</button>
        <button type="button" onClick={() => { setSecret(''); setRevealed(false); setCopied(false); }}>Done with token</button></div>
      {copied && <p role="status">Copied</p>}
    </div> : <>
      {!tokens.length && <p>No tokens yet.</p>}
      <ul className="ai-token-list">{tokens.map(token => <li key={token.id}>
        <div><strong>{token.name}</strong><span> · …{token.suffix}</span><br /><small>Created {new Date(token.createdAt).toLocaleString()} · Regenerated {new Date(token.rotatedAt).toLocaleString()}</small></div>
        <div className="ai-actions"><button type="button" disabled={busy} onClick={() => {
          if (confirm('Regenerate this token? The previous secret will stop working immediately.')) void action(() => issue(token));
        }}>Regenerate {token.name}</button><button type="button" disabled={busy} onClick={() => {
          if (confirm('Permanently revoke this token?')) void action(async () => { await api(path + '/' + token.id, 'DELETE', { credentialRevision: token.credentialRevision }); setTokens(current => current.filter(t => t.id !== token.id)); });
        }}>Delete {token.name}</button></div>
      </li>)}</ul>
      <label>Token name<input maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
      <button type="button" disabled={busy || !name.trim()} onClick={() => void action(() => issue())}>{busy ? 'Working…' : 'Issue token'}</button>
    </>}
  </section>;
}
