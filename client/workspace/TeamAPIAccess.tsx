import {useEffect,useState} from 'react';
import type {CreatedTeamAPIToken,TeamAPIToken} from '../../shared/team-api.js';
import {api} from './api.js';
import './team-api.css';

export function TeamAPIAccess(){
 const [tokens,setTokens]=useState<TeamAPIToken[]>(),[created,setCreated]=useState<CreatedTeamAPIToken>(),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[copied,setCopied]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  void api<{tokens:TeamAPIToken[]}>('/api/team-api-tokens','GET',undefined,controller.signal).then(value=>setTokens(value.tokens)).catch(e=>{if(!controller.signal.aborted)setError((e as Error).message);});
  return()=>controller.abort();
 },[retry]);
 async function create(){
  setBusy(true);setError('');setCopied(false);
  try{const saved=await api<CreatedTeamAPIToken>('/api/team-api-tokens','POST',{name});setCreated(saved);const {token:_,...metadata}=saved;setTokens(previous=>[metadata,...previous??[]]);setName('');}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function revoke(token:TeamAPIToken){
  setBusy(true);setError('');
  try{await api('/api/team-api-tokens/'+token.id,'DELETE');setTokens(previous=>previous?.filter(item=>item.id!==token.id));if(created?.id===token.id)setCreated(undefined);}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="read-section team-api-settings" aria-label="Team API access">
  <div className="team-api-heading"><h2>Team API access</h2><p className="muted">Read-only access to your team’s updates and pictures for a TV app or another integration.</p></div>
  <form className="team-api-create" onSubmit={event=>{event.preventDefault();void create();}}>
   <label htmlFor="team-api-name">Token name</label><div><input id="team-api-name" value={name} maxLength={80} placeholder="Office TV" onChange={event=>setName(event.target.value)} disabled={busy}/><button type="submit" disabled={busy||!name.trim()||!tokens}>Create token</button></div>
  </form>
  {created&&<div className="team-api-secret"><label htmlFor="team-api-secret">Bearer token</label><textarea id="team-api-secret" value={created.token} readOnly rows={2} spellCheck={false} onFocus={event=>event.currentTarget.select()}/><p>Copy this token now. It won’t be shown again. Keep it on your app’s server.</p><div><button type="button" onClick={()=>{if(!navigator.clipboard){setError('Select the token above and copy it manually.');return;}void navigator.clipboard.writeText(created.token).then(()=>setCopied(true)).catch(()=>setError('Select the token above and copy it manually.'));}}>{copied?'Copied':'Copy token'}</button><button type="button" onClick={()=>setCreated(undefined)}>Dismiss</button></div></div>}
  {error&&<p role="alert">{error}{!tokens&&<button onClick={()=>{setError('');setRetry(value=>value+1);}}>Retry</button>}</p>}
  {!tokens&&!error&&<p className="muted">Loading tokens…</p>}
  {tokens?.length===0&&<p className="muted">No active tokens.</p>}
  {!!tokens?.length&&<ul className="team-api-tokens">{tokens.map(token=><li key={token.id}><div><strong>{token.name}</strong><span>Expires {new Date(token.expiresAt).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'})}</span></div><button type="button" disabled={busy} aria-label={'Revoke '+token.name} onClick={()=>void revoke(token)}>Revoke</button></li>)}</ul>}
  <p className="muted team-api-note"><code>GET /api/v1/team-updates?date=YYYY-MM-DD</code></p>
  <p className="muted team-api-note">Tokens expire after 90 days. Revoking a token or ending your membership stops its access.</p>
 </section>;
}
