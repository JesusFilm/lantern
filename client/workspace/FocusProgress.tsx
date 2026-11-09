import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import type {PositionFocus} from '../../shared/focus.js';
import type {ProgressRecord,ProgressStatus,ProgressTarget} from '../../shared/progress.js';
import {api} from './api.js';
import {Dialog} from './Dialog.js';

const labels:Record<ProgressStatus,string>={'in-progress':'In progress',achieved:'Achieved','needs-attention':'Needs attention'};
const ProgressContext=createContext<ProgressRecord|undefined>(undefined);
export function FocusStatus({section,goal}:{section:number;goal:number|null}) {
 const data=useContext(ProgressContext), value=data?.statuses.find(s=>s.section===section&&s.goal===goal)?.status;
 return value?<span className={'progress-pill '+value}>{labels[value]}</span>:null;
}
const same=(a:ProgressTarget,b:ProgressTarget)=>a.section===b.section && a.goal===b.goal;
export function FocusProgress({focus,memberId,children}:{focus:PositionFocus;memberId?:string;children:ReactNode}) {
 const [tab,setTab]=useState<'focus'|'activity'>('focus'),[data,setData]=useState<ProgressRecord>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [editing,setEditing]=useState<ProgressTarget>();
 const path=memberId?`/api/department/members/${encodeURIComponent(memberId)}/focuses/${encodeURIComponent(focus.id)}/progress`:`/api/focuses/${encodeURIComponent(focus.id)}/progress`;
 useEffect(()=>{let active=true;setData(undefined);setError('');void api<ProgressRecord>(path).then(result=>{if(active)setData(result)}).catch((e:Error)=>{if(active)setError(e.message)});return()=>{active=false}},[path,attempt]);
 const status=(target:ProgressTarget)=>data?.statuses.find(s=>same(s,target))?.status;
 async function save(form:FormData) {
  if(!editing)return;
  const {section,goal}=editing, target={section,goal};
  const value=String(form.get('status')||'') as ProgressStatus|'';
  const result=await api<{status:ProgressRecord['statuses'][number];note:ProgressRecord['notes'][number]|null}>(
   `/api/focuses/${encodeURIComponent(focus.id)}/progress-entry`,'PUT',{
    section,goal,status:value||null,body:String(form.get('body')||''),
    revision:data?.statuses.find(item=>same(item,target))?.revision??null,
    noteRevision:data?.notes.find(item=>same(item,target))?.revision??null,
   });
  setData(previous=>previous?{...previous,statuses:[...previous.statuses.filter(item=>!same(item,target)),result.status],notes:[...previous.notes.filter(item=>!same(item,target)),...(result.note?[result.note]:[])]}:previous);
  setEditing(undefined);
 }
 function row(section:number,goal:number|null) {
  const target={section,goal}, name=goal===null?'Objective progress':`SMART goal ${goal+1}`,value=status(target),note=data?.notes.find(n=>same(n,target));
  const hasNote=!!note?.body;
  return <section key={goal===null?'objective':goal} className="progress-item" aria-label={name}>
   <div className="progress-row"><h3>{name}</h3><div className="progress-actions">{value&&<span className={'progress-pill '+value}>{labels[value]}</span>}{!memberId&&<button className="link" onClick={()=>setEditing(target)}>{value||hasNote?'Edit progress':'Add note'}</button>}</div></div>
   {hasNote?<div className="progress-note"><span className="muted">{new Date(note!.createdAt).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'})}</span><p>{note!.body}</p></div>:<p className="muted progress-empty">No notes yet</p>}
  </section>;
 }
 return <><nav className="progress-tabs" aria-label="Position focus views"><button className={tab==='focus'?'active':''} aria-pressed={tab==='focus'} onClick={()=>setTab('focus')}>Focus</button><button className={tab==='activity'?'active':''} aria-pressed={tab==='activity'} onClick={()=>setTab('activity')}>Progress &amp; notes</button></nav>
  {tab==='focus'?<ProgressContext.Provider value={data}>{children}</ProgressContext.Provider>:error?<p role="alert">{error} <button onClick={()=>setAttempt(x=>x+1)}>Try again</button></p>:!data?<p role="status">Loading progress…</p>:<div className="progress-activity">{!data.notes.some(item=>item.body) && !data.statuses.some(item=>item.status) && <p className="muted">Track progress and add notes to each objective or SMART goal.</p>}{focus.sections.map((section,i)=><section className="read-section progress-panel" aria-label={`Objective ${i+1}`} key={i}><header className="progress-heading"><span className="muted">Objective {i+1}</span><h2>{section.objective}</h2></header>{row(i,null)}{section.goals.map((_,j)=>row(i,j))}</section>)}</div>}
  {editing&&<Dialog title={`Progress · Objective ${editing.section+1}`+(editing.goal===null?'':` · SMART goal ${editing.goal+1}`)} onClose={()=>setEditing(undefined)} onSave={save} saveLabel="Save progress">
    <label htmlFor="progress-status">Status</label><select id="progress-status" name="status" defaultValue={status(editing)||''}><option value="">No status set</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
    <label htmlFor="progress-note">Progress note</label><textarea id="progress-note" name="body" maxLength={4000} defaultValue={data?.notes.find(item=>same(item,editing))?.body||''}/><p className="muted">Visible to you and your career lead. Leave the note blank if you only want to set a status.</p>
  </Dialog>}
 </>;
}
