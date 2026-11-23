import { useEffect, useState } from 'react';
import type { ReviewActivity } from '../../shared/review-activity.js';
import { api } from './api.js';

export function useReviewActivity(enabled:boolean) {
 const [activity,setActivity]=useState<ReviewActivity>({items:[]});
 const [error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!enabled){setActivity({items:[]});return;}
  let current=0,active=true;
  const refresh=()=>{const version=++current;void api<ReviewActivity>('/api/review-activity').then(value=>{if(active&&version===current){setActivity(value);setError(false)}}).catch(()=>{if(active&&version===current)setError(true)});};
  refresh();const timer=setInterval(refresh,7000);
  window.addEventListener('focus',refresh);window.addEventListener('lantern-review-read',refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('lantern-review-read',refresh)};
 },[enabled,retry]);
 return {...activity,error,retry:()=>setRetry(value=>value+1)};
}
