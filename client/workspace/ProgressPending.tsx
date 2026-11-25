import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import type {ProgressRecord,ProgressStatus,ProgressTarget} from '../../shared/progress.js';

export type ProgressWrite=ProgressTarget & {status:ProgressStatus|null;body:string;revision:string|null;noteRevision:string|null};
export type PendingProgress={request:ProgressWrite;base:ProgressRecord;operationId:string;inFlight:number;uncertain:boolean;settled:boolean;draft:{status:string;body:string};needsReview?:boolean;review?:{status:string;body:string;accepted:boolean;base:ProgressRecord};discarded?:boolean};
type Phase='response-received'|'response-error'|'fetch-failed'|'fetch-timeout'|'response-invalid'|'client-error'|'view-gone'|'state-update-scheduled'|'recovery-checked';
type Diagnostic={operationId:string;phase:Phase;httpStatus?:number};
type Workspace={pending:Map<string,PendingProgress>;report:(event:Diagnostic)=>void};
const PendingContext=createContext<Workspace|null>(null);

// Scoped to the current signed-in workspace, which survives in-app navigation.
export function ProgressPendingProvider({children}:{children:ReactNode}) {
 const pending=useRef(new Map<string,PendingProgress>());
 const diagnostics=useRef<Diagnostic[]>([]),sending=useRef(false),retryRequested=useRef(false),active=useRef(true);
 async function flush() {
  if(!active.current)return;
  if(sending.current){retryRequested.current=true;return}
  sending.current=true;
  try {
   while(active.current && diagnostics.current.length) {
    const event=diagnostics.current[0]!;
    const response=await fetch('/api/progress-diagnostics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),keepalive:true,signal:AbortSignal.timeout(10000)});
    if(!response.ok)break;
    const index=diagnostics.current.indexOf(event);if(index!==-1)diagnostics.current.splice(index,1);
   }
  } catch { /* Retry the bounded queue when the browser reconnects. */ }
  finally {
   sending.current=false;
   if(retryRequested.current){retryRequested.current=false;void flush()}
  }
 }
 function report(event:Diagnostic) {
  if(diagnostics.current.length===50)diagnostics.current.shift();
  if(active.current){diagnostics.current.push(event);void flush()}
 }
 useEffect(()=>{
  active.current=true;
  const warn=(event:BeforeUnloadEvent)=>{if(pending.current.size){event.preventDefault();event.returnValue=''}};
  const reconnect=()=>void flush();
  window.addEventListener('beforeunload',warn);window.addEventListener('online',reconnect);
  return ()=>{active.current=false;window.removeEventListener('beforeunload',warn);window.removeEventListener('online',reconnect)};
 },[]);
 return <PendingContext.Provider value={{pending:pending.current,report}}>{children}</PendingContext.Provider>;
}
export function usePendingProgress() {
 const workspace=useContext(PendingContext);
 if(!workspace)throw new Error('Progress requires an active workspace.');
 return workspace;
}
