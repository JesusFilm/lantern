import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {PositionFocus} from '../../shared/focus.js';
import type {ProgressRecord,ProgressStatus,ProgressTarget} from '../../shared/progress.js';
import {api,ApiError} from './api.js';
import {Dialog} from './Dialog.js';
import {usePhoneLayout} from './usePhoneLayout.js';
import {useSwipeNavigation} from './useSwipeNavigation.js';

const labels:Record<ProgressStatus,string>={'in-progress':'In progress',achieved:'Achieved','needs-attention':'Needs attention'};
const ProgressContext=createContext<ProgressRecord|undefined>(undefined);
export function FocusStatus({section,goal}:{section:number;goal:number|null}) {
 const data=useContext(ProgressContext), value=data?.statuses.find(s=>s.section===section&&s.goal===goal)?.status;
 return value?<span className={'progress-pill '+value}>{labels[value]}</span>:null;
}
const same=(a:ProgressTarget,b:ProgressTarget)=>a.section===b.section && a.goal===b.goal;
function ProgressActivity({focus,data,row}:{focus:PositionFocus;data:ProgressRecord;row:(section:number,goal:number|null)=>ReactNode}) {
 const compact=usePhoneLayout(), count=focus.sections.length;
 const [index,setIndex]=useState(0),[all,setAll]=useState(false);
 const active=Math.min(index,Math.max(0,count-1)), heading=useRef<HTMLHeadingElement>(null),interacted=useRef(false);
 function move(next:number){interacted.current=true;setAll(false);setIndex(Math.max(0,Math.min(next,count-1)))}
 useEffect(()=>{if(compact&&interacted.current&&!all){heading.current?.focus({preventScroll:true});heading.current?.closest('.progress-activity')?.scrollIntoView({block:'start'})}},[active,all,compact,count]);
 const swipe=useSwipeNavigation(compact&&!all&&count>1,()=>move(active-1),()=>move(active+1));
 return <div className={"progress-activity focus-objectives"+(compact&&count>1&&!all?" is-paged":"")} {...swipe}>
  {!data.notes.some(item=>item.body)&&!data.statuses.some(item=>item.status)&&<p className="muted">Track progress and add notes to each objective or SMART goal.</p>}
  {compact&&count>1&&<div className="objective-chooser"><label htmlFor="read-progress-objectives">Read progress objectives {!all&&<span aria-hidden="true">· swipe to move</span>}</label><select id="read-progress-objectives" value={all?'all':active} onChange={event=>event.target.value==='all'?setAll(true):move(Number(event.target.value))}>{focus.sections.map((section,i)=><option key={i} value={i}>Objective {i+1} of {count} · {section.objective.slice(0,70)}</option>)}<option value="all">Full document · all {count} objectives</option></select></div>}
  {focus.sections.map((section,i)=><section className="read-section progress-panel" aria-label={`Objective ${i+1}`} key={i} hidden={compact&&!all&&i!==active}><header className="progress-heading"><span className="muted">Objective {i+1}</span><h2 tabIndex={-1} ref={i===active?heading:undefined}>{section.objective}</h2></header>{row(i,null)}{section.goals.map((_,j)=>row(i,j))}</section>)}
  {compact&&count>1&&!all&&<div className="objective-pager" role="navigation" aria-label="Objective navigation"><button aria-label="Previous objective" disabled={active===0} onClick={()=>move(active-1)}>← Previous</button><span role="status">{active+1} / {count}</span><button aria-label="Next objective" disabled={active===count-1} onClick={()=>move(active+1)}>Next →</button></div>}
 </div>;
}
export function FocusProgress({focus,memberId,enabled,children}:{focus:PositionFocus;memberId?:string;enabled:boolean;children:ReactNode}) {
 const [tab,setTab]=useState<'focus'|'activity'>('focus'),[data,setData]=useState<ProgressRecord>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [editing,setEditing]=useState<ProgressTarget>(),[conflict,setConflict]=useState<ProgressRecord>();
 const [editStatus,setEditStatus]=useState(''),[editBody,setEditBody]=useState('');
 const path=memberId?`/api/department/members/${encodeURIComponent(memberId)}/focuses/${encodeURIComponent(focus.id)}/progress`:`/api/focuses/${encodeURIComponent(focus.id)}/progress`;
 useEffect(()=>{if(!enabled)return;let active=true;setData(undefined);setError('');void api<ProgressRecord>(path).then(result=>{if(active)setData(result)}).catch((e:Error)=>{if(active)setError(e.message)});return()=>{active=false}},[path,attempt,enabled]);
 const status=(target:ProgressTarget)=>data?.statuses.find(s=>same(s,target))?.status;
 async function save(form:FormData) {
  if(!editing)return;
  const {section,goal}=editing, target={section,goal};
  const value=String(form.get('status')||'') as ProgressStatus|'';
  let result: {status:ProgressRecord['statuses'][number];note:ProgressRecord['notes'][number]|null};
  try {
   result=await api(`/api/focuses/${encodeURIComponent(focus.id)}/progress-entry`,'PUT',{
    section,goal,status:value||null,body:String(form.get('body')||''),
    revision:data?.statuses.find(item=>same(item,target))?.revision??null,
    noteRevision:data?.notes.find(item=>same(item,target))?.revision??null,
   });
  } catch(error) {
   if(error instanceof ApiError && error.status===409) {
    try { setConflict(await api<ProgressRecord>(path)); }
    catch { throw new Error('Progress changed in another window. Your edit is still here; try saving again to reload the latest version.'); }
    throw new Error('Progress changed in another window. Review the latest version before retrying.');
   }
   throw error;
  }
  setData(previous=>previous?{...previous,statuses:[...previous.statuses.filter(item=>!same(item,target)),result.status],notes:[...previous.notes.filter(item=>!same(item,target)),...(result.note?[result.note]:[])]}:previous);
  setConflict(undefined);setEditing(undefined);
 }
 function row(section:number,goal:number|null) {
  const target={section,goal}, name=goal===null?'Objective progress':`SMART goal ${goal+1}`,value=status(target),note=data?.notes.find(n=>same(n,target));
  const hasNote=!!note?.body;
  return <section key={goal===null?'objective':goal} className="progress-item" aria-label={name}>
   <div className="progress-row"><h3>{name}</h3><div className="progress-actions">{value&&<span className={'progress-pill '+value}>{labels[value]}</span>}{!memberId&&<button className="link" onClick={()=>{setEditStatus(value||'');setEditBody(note?.body||'');setEditing(target)}}>{value||hasNote?'Edit progress':'Add note'}</button>}</div></div>
   {goal!==null&&<p className="read-text">{focus.sections[section]?.goals[goal]}</p>}
   {hasNote?<div className="progress-note"><span className="muted">{new Date(note!.createdAt).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'})}</span><p>{note!.body}</p></div>:<p className="muted progress-empty">No notes yet</p>}
  </section>;
 }
 if(!enabled)return <>{children}</>;
 return <><nav className="progress-tabs" aria-label="Position focus views"><button className={tab==='focus'?'active':''} aria-pressed={tab==='focus'} onClick={()=>setTab('focus')}>Focus</button><button className={tab==='activity'?'active':''} aria-pressed={tab==='activity'} onClick={()=>setTab('activity')}>Progress &amp; notes</button></nav>
  {error&&<p role="alert">{error} <button onClick={()=>setAttempt(x=>x+1)}>Try again</button></p>}
  {tab==='focus'?<ProgressContext.Provider value={data}>{children}</ProgressContext.Provider>:error?null:!data?<p role="status">Loading progress…</p>:<ProgressActivity focus={focus} data={data} row={row}/>}
  {editing&&<Dialog title={`Progress · Objective ${editing.section+1}`+(editing.goal===null?'':` · SMART goal ${editing.goal+1}`)} onClose={()=>{if(conflict)setData(conflict);setConflict(undefined);setEditing(undefined)}} onSave={save} saveLabel="Save progress">
    {conflict&&<div className="progress-conflict"><p>Your edit is still below. Review the latest version, then use it as the base before saving your edit.</p><p>Latest saved status: {conflict.statuses.find(item=>same(item,editing))?.status ? labels[conflict.statuses.find(item=>same(item,editing))!.status!] : 'No status set'}</p><p>Latest saved note: {conflict.notes.find(item=>same(item,editing))?.body || 'No note'}</p><button type="button" onClick={()=>{if(editStatus===(status(editing)||''))setEditStatus(conflict.statuses.find(item=>same(item,editing))?.status||'');if(editBody===(data?.notes.find(item=>same(item,editing))?.body||''))setEditBody(conflict.notes.find(item=>same(item,editing))?.body||'');setData(conflict);setConflict(undefined)}}>Use latest version</button></div>}
    <label htmlFor="progress-status">Status</label><select id="progress-status" name="status" value={editStatus} onChange={event=>setEditStatus(event.target.value)}><option value="">No status set</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
    <label htmlFor="progress-note">Progress note</label><textarea id="progress-note" name="body" maxLength={4000} value={editBody} onChange={event=>setEditBody(event.target.value)}/><p className="muted">Visible to you and your career lead. Leave the note blank if you only want to set a status.</p>
  </Dialog>}
 </>;
}
