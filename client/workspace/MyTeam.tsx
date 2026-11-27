import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TeamWeek, TeamDayMember } from '../../shared/weekly.js';
import { goalStatusLabels } from '../../shared/weekly.js';
import { WorkLinkIcon, workLinkLabel } from './WorkLinkIcon.js';
import { api } from './api.js';
import './weekly.css';
import './team-weekly.css';

function calendarDay(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}
function shift(value:string,offset:number) {
  const date=new Date(value+'T12:00:00');date.setDate(date.getDate()+offset);return calendarDay(date);
}
function monday(value: string) {
  return shift(value,-((new Date(value+'T12:00:00').getDay()+6)%7));
}
function initialWeek() {
  const params=new URLSearchParams(location.search),value=params.get('week') ?? params.get('date');
  const current=monday(calendarDay());
  return value && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value && monday(value)<=current ? monday(value) : current;
}
function labelDate(value: string) {
  const date=new Date(value+'T12:00:00');
  return date.toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short',...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric' as const}:{})});
}
function weekLabel(week: string) {
  const end=shift(week,4),outsideCurrentYear=week.slice(0,4)!==String(new Date().getFullYear());
  const startLabel=new Date(week+'T12:00:00').toLocaleDateString('en-NZ',{day:'numeric',...(week.slice(0,7)!==end.slice(0,7)||outsideCurrentYear?{month:'short' as const}:{}),...(outsideCurrentYear?{year:'numeric' as const}:{})});
  const endLabel=new Date(end+'T12:00:00').toLocaleDateString('en-NZ',{day:'numeric',month:'short',...(end.slice(0,4)!==String(new Date().getFullYear())?{year:'numeric' as const}:{})});
  return startLabel+'–'+endLabel;
}
function elapsedTime(timestamp: string, now: number) {
  const minutes=Math.max(0,Math.floor((now-Date.parse(timestamp))/60_000));
  if(minutes<1)return 'Just now';
  if(minutes<60)return `${minutes} minute${minutes===1?'':'s'} ago`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return `${hours} hour${hours===1?'':'s'} ago`;
  const days=Math.floor(hours/24);
  return `${days} day${days===1?'':'s'} ago`;
}
function MemberUpdate({member,now}:{member:TeamDayMember;now:number}) {
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const flags=new Map(member.update?.goalStatuses.map(flag=>[flag.goalId,flag.status]));
  const isCompleted = (goal: TeamDayMember['goals'][number]) => {
    const status=flags.get(goal.id);
    return status ? status==='done' : !!goal.completed;
  };
  const activeGoals=member.goals.filter(goal=>!isCompleted(goal)),completedGoals=member.goals.filter(isCompleted);
  function renderGoals(goals: TeamDayMember['goals']) {
    return <ul className="week-today-goals team-goals">{goals.map(goal=>{
        const status=flags.get(goal.id);
        return <li key={goal.id}><div className="team-goal-main"><span className={`week-today-goal-title${isCompleted(goal)?' is-done':''}`}>{goal.text}</span>{status && <span className={`week-today-status flag-${status}`}>{goalStatusLabels[status]}</span>}</div>
          {!!goal.links.length && <div className="team-work-links" role="group" aria-label={`Work links for ${goal.text}`} tabIndex={0}>{goal.links.map((link,index)=>link.kind==='focus'
            ? <span key={index}><WorkLinkIcon link={link} size={12} />{[link.title,link.target?.objective,link.target?.goalText].filter(Boolean).join(' · ')}</span>
            : <a key={index} href={link.url} target="_blank" rel="noreferrer"><WorkLinkIcon link={link} size={12} />{workLinkLabel(link)}</a>)}</div>}
        </li>;
      })}</ul>;
  }
  const heading='team-member-'+member.id;
  return <article className="team-member" aria-labelledby={heading}>
    <header className="team-member-heading">
      <span className="team-avatar" aria-hidden="true">{member.githubUsername && failedAvatar !== member.githubUsername
        ? <img src={`/api/github-avatars/${encodeURIComponent(member.githubUsername)}`} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedAvatar(member.githubUsername ?? undefined)} />
        : member.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</span>
      <div><h2 id={heading}>{member.name}</h2>{member.update && <time className="team-update-time" dateTime={member.update.createdAt} title={new Date(member.update.createdAt).toLocaleString()}>{elapsedTime(member.update.createdAt,now)}</time>}</div>
    </header>
    <div className="week-day-content week-day-entry team-member-card">
      <div className="team-update">{!member.update && <p className="team-no-update">No update yet</p>}{member.update?.body && <p className="week-day-body team-update-body">{member.update.body}</p>}</div>
      <div className="team-goals-column">{!!activeGoals.length && renderGoals(activeGoals)}
      {!!completedGoals.length && <><h3 className="week-completed-heading">Completed</h3>{renderGoals(completedGoals)}</>}
      {!member.goals.length && <p className="team-empty">No goals for this week yet.</p>}</div>
    </div>
  </article>;
}

export function MyTeam() {
  const [week,setWeek]=useState(initialWeek),[view,setView]=useState<TeamWeek>(),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60_000);return ()=>clearInterval(timer);},[]);
  const currentWeek=monday(calendarDay());
  useEffect(()=>{
    const controller=new AbortController();setView(undefined);setError('');
    void api<TeamWeek>('/api/team-updates?week='+week,'GET',undefined,controller.signal).then(saved=>{if(!controller.signal.aborted)setView(saved);}).catch(e=>{if(!controller.signal.aborted)setError((e as Error).message);});
    return ()=>controller.abort();
  },[week,retry]);
  function choose(next:string) {
    if(next>currentWeek||next===week)return;
    const url=new URL(location.href);url.searchParams.delete('date');url.searchParams.set('week',next);history.replaceState(history.state,'',url);setWeek(next);
  }
  return <div className="my-week my-team">
    <header className="week-header"><h1>My team</h1><div className="team-heading-controls">
      <div className="week-navigation" role="group" aria-label="Team update week">
        <button type="button" aria-label="Previous week" disabled={!view || !view.firstWeek || week<=view.firstWeek} onClick={()=>choose(shift(week,-7))}><ChevronLeft size={18}/></button>
        <button type="button" className="week-navigation-current" aria-label="Go to current week" title="Go to current week" onClick={()=>choose(currentWeek)}><span aria-live="polite"><span className="week-range-full">{labelDate(week)} – {labelDate(shift(week,4))}</span><span className="week-range-short">{weekLabel(week)}</span></span></button>
        <button type="button" aria-label="Next week" disabled={!view || week>=currentWeek} onClick={()=>choose(shift(week,7))}><ChevronRight size={18}/></button>
      </div>
    </div></header>
    {error ? <p role="alert">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>
      : !view ? <p role="status">Loading team updates…</p>
      : <div className="team-members">{view.members.map(member=><MemberUpdate key={member.id} member={member} now={now}/>)}</div>}
  </div>;
}
