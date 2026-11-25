import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {PositionFocus} from '../../shared/focus.js';
import type {ProgressRecord,ProgressStatus,ProgressTarget} from '../../shared/progress.js';
import {api,ApiError} from './api.js';
import {FocusWeeklyWork} from './FocusWeeklyWork.js';
import {Dialog} from './Dialog.js';
import {usePendingProgress,type ProgressWrite,type PendingProgress} from './ProgressPending.js';
import {usePhoneLayout} from './usePhoneLayout.js';
import {useSwipeNavigation} from './useSwipeNavigation.js';

const labels:Record<ProgressStatus,string>={'in-progress':'In progress',achieved:'Achieved','needs-attention':'Needs attention'};
const ProgressContext=createContext<ProgressRecord|undefined>(undefined);
export function FocusStatus({section,goal}:{section:number;goal:number|null}) {
 const data=useContext(ProgressContext), value=data?.statuses.find(s=>s.section===section&&s.goal===goal)?.status;
 return value?<span className={'progress-pill '+value}>{labels[value]}</span>:null;
}
const same=(a:ProgressTarget,b:ProgressTarget)=>a.section===b.section && a.goal===b.goal;
const sameRevision=(a:ProgressRecord,b:ProgressRecord,target:ProgressTarget)=> (a.statuses.find(item=>same(item,target))?.revision??null)===(b.statuses.find(item=>same(item,target))?.revision??null) && (a.notes.find(item=>same(item,target))?.revision??null)===(b.notes.find(item=>same(item,target))?.revision??null);
function validProgressRecord(value:unknown):value is ProgressRecord {
 if(!value || typeof value!=='object')return false;
 const record=value as {statuses?:unknown;notes?:unknown};
 const target=(item:unknown):item is ProgressTarget=>!!item && typeof item==='object' && Number.isSafeInteger((item as ProgressTarget).section) && (item as ProgressTarget).section>=0 && ((item as ProgressTarget).goal===null || Number.isSafeInteger((item as ProgressTarget).goal) && (item as ProgressTarget).goal!>=0);
 const revision=(value:unknown)=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 return Array.isArray(record.statuses)&&Array.isArray(record.notes) && record.statuses.every((item:unknown)=>target(item)&&[null,'in-progress','achieved','needs-attention'].includes((item as ProgressRecord['statuses'][number]).status)&&revision((item as ProgressRecord['statuses'][number]).revision)) && record.notes.every((item:unknown)=>target(item)&&typeof (item as ProgressRecord['notes'][number]).body==='string'&&typeof (item as ProgressRecord['notes'][number]).createdAt==='string'&&!Number.isNaN(Date.parse((item as ProgressRecord['notes'][number]).createdAt))&&revision((item as ProgressRecord['notes'][number]).revision));
}
function validSaveResult(value:unknown,request:ProgressWrite):value is {status:ProgressRecord['statuses'][number];note:ProgressRecord['notes'][number]|null} {
 if(!value || typeof value!=='object')return false;
 const entry=value as {status?:unknown;note?:unknown};
 const revision=(value:unknown)=>typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
 if(!entry.status || typeof entry.status!=='object')return false;
 const status=entry.status as ProgressRecord['statuses'][number];
 if(!same(status,request)||status.status!==request.status||!revision(status.revision))return false;
 if(entry.note===null)return request.body==='';
 if(!entry.note || typeof entry.note!=='object')return false;
 const note=entry.note as ProgressRecord['notes'][number];
 return same(note,request)&&note.body===request.body&&typeof note.createdAt==='string'&&!Number.isNaN(Date.parse(note.createdAt))&&revision(note.revision);
}
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
export function FocusProgress({focus,memberId,enabled,weeklyLinksEnabled=false,children}:{focus:PositionFocus;memberId?:string;enabled:boolean;weeklyLinksEnabled?:boolean;children:ReactNode}) {
 const [tab,setTab]=useState<'focus'|'activity'>(()=>new URLSearchParams(location.search).get('view')==='progress'?'activity':'focus'),[data,setData]=useState<ProgressRecord>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 function chooseTab(next:'focus'|'activity') {
  const url=new URL(location.href);
  if(next==='activity')url.searchParams.set('view','progress');else url.searchParams.delete('view');
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  setTab(next);
 }
 const [editing,setEditing]=useState<ProgressTarget>(),[conflict,setConflict]=useState<ProgressRecord>();
 const {pending:pendingSaves,report:reportProgress}=usePendingProgress(),mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const [editStatus,setEditStatus]=useState(''),[editBody,setEditBody]=useState('');
 const path=memberId?`/api/department/members/${encodeURIComponent(memberId)}/focuses/${encodeURIComponent(focus.id)}/progress`:`/api/focuses/${encodeURIComponent(focus.id)}/progress`;
 async function readAfterPending():Promise<{latest:ProgressRecord;pending:ReturnType<typeof pendingSaves.get>}> {
  const pending=pendingSaves.get(focus.id);
  if(pending && !pending.settled) {
   pending.inFlight++;
   try {
    const headers={'X-Lantern-Progress-Operation':pending.operationId};
    if(pending.discarded) {
     const {section,goal,revision,noteRevision}=pending.request;
     const response=await api<unknown>(`/api/focuses/${encodeURIComponent(focus.id)}/progress-fence`,'POST',{section,goal,revision,noteRevision},AbortSignal.timeout(10000),headers);
     const next=response && typeof response==='object' && 'revision' in response ? response.revision : undefined;
     if(typeof next!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(next) || next===revision)throw new SyntaxError('Invalid progress fence response.');
    } else {
     const response=await api<unknown>(`/api/focuses/${encodeURIComponent(focus.id)}/progress-entry`,'PUT',pending.request,AbortSignal.timeout(10000),headers);
     if(!validSaveResult(response,pending.request))throw new SyntaxError('Invalid progress response.');
    }
    pending.settled=true;
   }
   catch(error) {
    if(error instanceof ApiError && error.status===409)pending.settled=true;
    else {if(!pending.settled)pending.uncertain=true;throw new Error("We couldn't check whether your progress was saved. Please try again.");}
   }
   finally {pending.inFlight--}
  }
  const latest=await api<unknown>(path,'GET',undefined,AbortSignal.timeout(10000));
  if(!validProgressRecord(latest))throw new Error('The saved progress could not be read. Please try again.');
  if(pending)reportProgress({operationId:pending.operationId,phase:'recovery-checked'});
  return {latest,pending};
 }
 useEffect(()=>{
  if(!enabled)return;
  let active=true;
  setData(undefined);setError('');
  void readAfterPending().then(({latest:result,pending})=>{
   if(!active)return;
   setData(result);
   if(pending&&!pending.discarded) {
    const target=pending.request;
    const savedStatus=result.statuses.find(item=>same(item,target))?.status??null;
    const savedBody=result.notes.find(item=>same(item,target))?.body??'';
    const originalMatches=savedStatus===target.status && savedBody===target.body;
    const draftChanged=pending.draft.status!==(target.status||'') || pending.draft.body.trim()!==target.body;
    if(pending.review || !originalMatches || draftChanged) {
     pending.needsReview=true;
     const review=pending.review ??= {status:pending.draft.status,body:pending.draft.body,accepted:originalMatches,base:originalMatches?result:pending.base};
     setEditStatus(review.status);setEditBody(review.body);setEditing({section:target.section,goal:target.goal});
     if(!review.accepted || !sameRevision(review.base,result,target)) {review.accepted=false;setData(review.base);setConflict(result)}
    } else if(pendingSaves.get(focus.id)===pending)pendingSaves.delete(focus.id);
   } else if(pendingSaves.get(focus.id)===pending)pendingSaves.delete(focus.id);
  }).catch((e:Error)=>{if(active)setError(e.message)});
  return()=>{active=false};
 },[path,attempt,enabled]);
 const status=(target:ProgressTarget)=>data?.statuses.find(s=>same(s,target))?.status;
 async function save(form:FormData) {
  if(!editing)return;
  const {section,goal}=editing, target={section,goal};
  const value=String(form.get('status')||'') as ProgressStatus|'';
  const body=String(form.get('body')||'').trim();
  const changedMessage='Saved progress differs from your edit. Review the latest version before retrying.';
  if(conflict)throw new Error(changedMessage);
  let base=data;
  async function reconcile() {
   let latest:ProgressRecord,pending:ReturnType<typeof pendingSaves.get>;
   try { ({latest,pending}=await readAfterPending()); }
   catch {
    throw new Error("We couldn't check whether your progress was saved. Your edit is still here. Try saving again to check, or Cancel to reload progress.");
   }
   if(!mounted.current)return;
   const savedStatus=latest.statuses.find(item=>same(item,target)),savedNote=latest.notes.find(item=>same(item,target));
   if((savedStatus?.status??null)===(value||null) && (savedNote?.body??'')===body) {
    if(pendingSaves.get(focus.id)===pending)pendingSaves.delete(focus.id);
    setData(latest);setConflict(undefined);setEditing(undefined);return;
   }
   if(pending && (savedStatus?.status??null)===pending.request.status && (savedNote?.body??'')===pending.request.body) {
    if(pendingSaves.get(focus.id)===pending)pendingSaves.delete(focus.id);
    setData(latest);return latest;
   }
   if((savedStatus?.revision??null)!==(base?.statuses.find(item=>same(item,target))?.revision??null) ||
      (savedNote?.revision??null)!==(base?.notes.find(item=>same(item,target))?.revision??null)) {
    if(pending){pending.needsReview=true;pending.review={status:value,body,accepted:false,base:pending.base}}
    setConflict(latest);throw new Error(changedMessage);
   }
   if(pendingSaves.get(focus.id)===pending)pendingSaves.delete(focus.id);
   setData(latest);return latest;
  }
  if(pendingSaves.has(focus.id) && !pendingSaves.get(focus.id)?.review?.accepted) {
   const latest=await reconcile();if(!latest)return;
   base=latest;
  }
  const request:ProgressWrite={
   section,goal,status:value||null,body,
   revision:base?.statuses.find(item=>same(item,target))?.revision??null,
   noteRevision:base?.notes.find(item=>same(item,target))?.revision??null,
  };
  const savePath=`/api/focuses/${encodeURIComponent(focus.id)}/progress-entry`;
  let result: {status:ProgressRecord['statuses'][number];note:ProgressRecord['notes'][number]|null};
  const pending:PendingProgress={request,base:base??{statuses:[],notes:[]},operationId:crypto.randomUUID(),inFlight:0,uncertain:false,settled:false,draft:{status:editStatus,body:editBody}};
  function report(phase:'response-received'|'response-error'|'fetch-failed'|'fetch-timeout'|'response-invalid'|'client-error'|'view-gone'|'state-update-scheduled',httpStatus?:number) {
   reportProgress({operationId:pending.operationId,phase,...(httpStatus===undefined?{}:{httpStatus})});
  }
  pendingSaves.set(focus.id,pending);
  try {
   pending.inFlight++;
   let response:unknown;
   try { response=await api<unknown>(savePath,'PUT',request,AbortSignal.timeout(10000),{'X-Lantern-Progress-Operation':pending.operationId}); }
   finally {pending.inFlight--}
   if(!validSaveResult(response,request))throw new SyntaxError('Invalid progress response.');
   result=response;
   report('response-received');
  } catch(error) {
   if(!(error instanceof ApiError && error.status<500 && error.status!==408) && !pending.settled)pending.uncertain=true;
   if(error instanceof ApiError && error.status===409)pending.settled=true;
   report(error instanceof ApiError?'response-error':error instanceof SyntaxError?'response-invalid':error instanceof DOMException && error.name==='TimeoutError'?'fetch-timeout':error instanceof TypeError?'fetch-failed':'client-error',error instanceof ApiError?error.status:undefined);
   if(!mounted.current)report('view-gone');
   if(error instanceof ApiError && error.status<500 && error.status!==408 && error.status!==409) {
    if(error.status===429 && !pending.settled)pending.uncertain=true;
    if(!pending.inFlight && !pending.uncertain && !pending.settled) {
     pending.settled=true;pending.needsReview=true;
     pending.review={status:pending.draft.status,body:pending.draft.body,accepted:true,base:pending.base};
    }
    throw error;
   }
   // An identical retry with the same revisions can win only once, even if
   // the original request is delayed. Do not trust a read until it settles.
   if(!await reconcile())return;
   throw new Error("We couldn't save your progress. Your edit is still here. Please try again.");
  }
  if(mounted.current && !pending.needsReview && pendingSaves.get(focus.id)===pending)pendingSaves.delete(focus.id);
  report(mounted.current?'state-update-scheduled':'view-gone');
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
 const weeklyWork=weeklyLinksEnabled?<FocusWeeklyWork focusId={focus.id} onSuggest={!memberId&&enabled&&data?(target,value)=>{if(target.version!==focus.version||!focus.sections[target.section]||(target.goal!==null&&!focus.sections[target.section]?.goals[target.goal]))return;setEditStatus(value==='done'?'achieved':value==='on-track'?'in-progress':'needs-attention');setEditBody(data.notes.find(note=>same(note,target))?.body||'');setEditing({section:target.section,goal:target.goal})}:undefined}/>:null;
 if(!enabled)return <>{children}{weeklyWork}</>;
 return <><nav className="progress-tabs" aria-label="Position focus views"><button className={tab==='focus'?'active':''} aria-pressed={tab==='focus'} onClick={()=>chooseTab('focus')}>Focus</button><button className={tab==='activity'?'active':''} aria-pressed={tab==='activity'} onClick={()=>chooseTab('activity')}>Progress &amp; notes</button></nav>
  {error&&<p role="alert">{error} <button onClick={()=>setAttempt(x=>x+1)}>Try again</button></p>}
  {tab==='focus'?<ProgressContext.Provider value={data}>{children}</ProgressContext.Provider>:error?null:!data?<p role="status">Loading progress…</p>:<ProgressActivity focus={focus} data={data} row={row}/>}
  {weeklyWork}
  {editing&&<Dialog title={`Progress · Objective ${editing.section+1}`+(editing.goal===null?'':` · SMART goal ${editing.goal+1}`)} onClose={()=>{if(conflict)setData(conflict);const pending=pendingSaves.get(focus.id);if(pending?.needsReview)pendingSaves.delete(focus.id);else if(pending){pending.discarded=true;setData(undefined);setAttempt(x=>x+1)}setConflict(undefined);setEditing(undefined)}} onSave={save} saveLabel="Save progress">
    {conflict&&<div className="progress-conflict"><p>Your edit is still below. Review the latest version, then use it as the base before saving your edit.</p><p>Latest saved status: {conflict.statuses.find(item=>same(item,editing))?.status ? labels[conflict.statuses.find(item=>same(item,editing))!.status!] : 'No status set'}</p><p>Latest saved note: {conflict.notes.find(item=>same(item,editing))?.body || 'No note'}</p><button type="button" onClick={()=>{const nextStatus=editStatus===(status(editing)||'')?(conflict.statuses.find(item=>same(item,editing))?.status||''):editStatus;const nextBody=editBody===(data?.notes.find(item=>same(item,editing))?.body||'')?(conflict.notes.find(item=>same(item,editing))?.body||''):editBody;const pending=pendingSaves.get(focus.id);if(pending)pending.review={status:nextStatus,body:nextBody,accepted:true,base:conflict};setEditStatus(nextStatus);setEditBody(nextBody);setData(conflict);setConflict(undefined)}}>Use latest version</button></div>}
    <label htmlFor="progress-status">Status</label><select id="progress-status" name="status" value={editStatus} onChange={event=>{const value=event.target.value;const pending=pendingSaves.get(focus.id);if(pending){pending.draft.status=value;if(pending.review)pending.review.status=value}setEditStatus(value)}}><option value="">No status set</option>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
    <label htmlFor="progress-note">Progress note</label><textarea id="progress-note" name="body" maxLength={4000} value={editBody} onChange={event=>{const value=event.target.value;const pending=pendingSaves.get(focus.id);if(pending){pending.draft.body=value;if(pending.review)pending.review.body=value}setEditBody(value)}}/><p className="muted">Visible to you and your career lead. Leave the note blank if you only want to set a status.</p>
  </Dialog>}
 </>;
}
