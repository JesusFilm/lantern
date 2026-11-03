import { useEffect, useState } from 'react';
import type { AiMemberDetail, AiMemberProfile } from '../../shared/ai-members.js';
import { api } from '../workspace/api.js';
import { Dialog } from '../workspace/Dialog.js';
import { TokenManager } from './TokenManager.js';
import { AiFocusEditor } from './AiFocusEditor.js';
import './style.css';

const root = '/api/ai-members';
export function Retrieval({ member }: { member: AiMemberProfile }) {
  return <p className="muted">{member.lastRetrievedAt
    ? <>Focus version {member.lastRetrievedVersion} served · <time dateTime={member.lastRetrievedAt}>{new Date(member.lastRetrievedAt).toLocaleString()}</time></>
    : 'Never retrieved'}</p>;
}
export function AiMembers({ coachAvailable }: { coachAvailable: boolean }) {
  const [members, setMembers] = useState<AiMemberProfile[]>(), [error, setError] = useState('');
  const [selected, setSelected] = useState<{ member: AiMemberDetail; mode: 'manage' | 'focus' }>();
  const [adding, setAdding] = useState(false);
  async function load() {
    try { setMembers(await api<AiMemberProfile[]>(root)); setError(''); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);
  async function open(id: string, mode: 'manage' | 'focus') {
    try { setSelected({ member: await api<AiMemberDetail>(root + '/' + id), mode }); setError(''); }
    catch (e) { setError((e as Error).message); }
  }
  function saved(member: AiMemberDetail) {
    setMembers(current => current?.map(m => m.id === member.id ? member : m));
    setSelected(undefined);
  }
  return <section className="ai-members">
    <header><div><h1>{selected?.mode === 'focus' ? 'Position focus' : 'AI members'}</h1><p>Experimental · excluded from QA</p></div>
      {!selected && <button className="primary" onClick={() => setAdding(true)}>Add AI member</button>}</header>
    {error && <p role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}
    {selected?.mode === 'focus' ? <AiFocusEditor key={selected.member.id} member={selected.member} available={coachAvailable} onSaved={saved} onCancel={() => setSelected(undefined)} /> : <>
      {!members && !error && <p role="status">Loading AI members…</p>}
      {members?.length === 0 && <p>No AI members yet.</p>}
      <div className="ai-member-grid">{members?.map(member => <article key={member.id} className="ai-member-card">
        <h2><button className="link" onClick={() => void open(member.id, 'manage')}>{member.name}</button></h2>
        <div className="ai-actions"><button onClick={() => void open(member.id, 'manage')}>Manage</button><button onClick={() => void open(member.id, 'focus')}>Position focus</button></div>
        {member.purpose && <p className="ai-plain-text">{member.purpose}</p>}
        <Retrieval member={member} />
      </article>)}</div>
    </>}
    {adding && <Dialog title="Add AI member" saveLabel="Add member" onClose={() => setAdding(false)} onSave={async data => {
      const member = await api<AiMemberDetail>(root, 'POST', { name: data.get('name'), purpose: data.get('purpose') });
      setMembers(current => [...(current ?? []), member]); setAdding(false);
    }}><ProfileFields /></Dialog>}
    {selected?.mode === 'manage' && <Manage member={selected.member} onSaved={saved} onClose={() => setSelected(undefined)} onDeleted={() => { setMembers(current => current?.filter(m => m.id !== selected.member.id)); setSelected(undefined); }} />}
  </section>;
}
function ProfileFields({ member }: { member?: AiMemberDetail }) {
  return <><label>Name<input name="name" required maxLength={100} defaultValue={member?.name} autoComplete="off" /></label>
    <label htmlFor="ai-purpose">Role / purpose (optional)</label><textarea id="ai-purpose" name="purpose" maxLength={4000} rows={3} defaultValue={member?.purpose} /></>;
}
function Manage({ member, onSaved, onClose, onDeleted }: { member: AiMemberDetail; onSaved: (member: AiMemberDetail) => void; onClose: () => void; onDeleted: () => void }) {
  const [deleteError, setDeleteError] = useState(''), [deleting, setDeleting] = useState(false);
  return <Dialog title={'Manage ' + member.name} onClose={onClose} saveDisabled={deleting} onSave={async data => onSaved(await api<AiMemberDetail>(root + '/' + member.id, 'PATCH', { name: data.get('name'), purpose: data.get('purpose'), profileRevision: member.profileRevision }))}>
    <ProfileFields member={member} />
    <Retrieval member={member} />
    <TokenManager member={member} />
    {deleteError && <p role="alert">{deleteError}</p>}
    <button type="button" disabled={deleting} onClick={() => {
      if (!confirm('Permanently delete this AI member, its position focus and all tokens?')) return;
      setDeleting(true);
      void api(root + '/' + member.id, 'DELETE').then(onDeleted).catch(e => setDeleteError(e.message)).finally(() => setDeleting(false));
    }}>Delete member</button>
  </Dialog>;
}
