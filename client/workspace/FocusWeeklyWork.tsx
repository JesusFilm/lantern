import {useEffect,useState} from 'react';
import type {FocusWeeklyWork as LinkedWork,GoalStatus,SavedFocusWorkTarget} from '../../shared/weekly.js';
import {goalStatusLabels} from '../../shared/weekly.js';
import {api} from './api.js';
import {formatFocusDate} from './focusDate.js';

export function FocusWeeklyWork({focusId,onSuggest}:{focusId:string;onSuggest?:(target:SavedFocusWorkTarget,status:GoalStatus)=>void}) {
 const [data,setData]=useState<LinkedWork>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');setData(undefined);void api<LinkedWork>(`/api/focuses/${encodeURIComponent(focusId)}/weekly-work`,'GET',undefined,controller.signal).then(setData).catch((e:Error)=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[focusId,attempt]);
 return <section aria-label="Linked weekly work" className="read-section"><h2>Linked weekly work</h2>
  <p className="muted">Weekly work can suggest progress. You review and save each change.</p>
  {error?<p role="alert">{error} <button onClick={()=>setAttempt(value=>value+1)}>Try again</button></p>:!data?<p role="status">Loading linked work…</p>:!data.items.length?<p className="muted">No weekly work linked yet.</p>:data.items.map(item=><article key={item.week+':'+item.goal.id+':'+JSON.stringify(item.target)}>
   <h3>{item.goal.text}</h3><p>Week of {formatFocusDate(item.week)}{item.status?' · '+goalStatusLabels[item.status]:''}</p>
   {item.target&&<p>{item.target.objective}{item.target.goalText?' · '+item.target.goalText:''}</p>}
   {onSuggest&&item.target&&item.status&&<button type="button" onClick={()=>onSuggest(item.target!,item.status!)}>Review suggested progress</button>}
  </article>)}
 </section>;
}
