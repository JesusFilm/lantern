import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TeamDay, TeamDayMember } from '../../shared/weekly.js';
import { goalStatusLabels } from '../../shared/weekly.js';
import { GitHubIcon } from './GitHubIcon.js';
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
function initialDate() {
  const date=new URLSearchParams(location.search).get('date');
  return date && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date && date<=calendarDay() ? date : calendarDay();
}
function MemberUpdate({member}:{member:TeamDayMember}) {
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const flags=new Map(member.update?.goalStatuses.map(flag=>[flag.goalId,flag.status]));
  const heading='team-member-'+member.id;
  return <article className="team-member" aria-labelledby={heading}>
    <header className="team-member-heading">
      <span className="team-avatar" aria-hidden="true">{member.githubUsername && failedAvatar !== member.githubUsername
        ? <img src={`/api/github-avatars/${encodeURIComponent(member.githubUsername)}`} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedAvatar(member.githubUsername ?? undefined)} />
        : member.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()}</span>
      <div><h2 id={heading}>{member.name}</h2>{member.githubUsername && <a className="team-github" href={`https://github.com/${member.githubUsername}`} target="_blank" rel="noreferrer"><GitHubIcon />{member.githubUsername}</a>}</div>
      {!member.update && <span className="team-no-update">No update yet</span>}
    </header>
    <div className="week-day-content week-day-entry team-member-card">
      {!!member.goals.length && <ul className="week-today-goals team-goals">{member.goals.map(goal=>{
        const status=flags.get(goal.id);
        return <li key={goal.id}><div className="team-goal-main"><span className={`week-today-goal-title${status==='done'?' is-done':''}`}>{goal.text}</span>{status && <span className={`week-today-status flag-${status}`}>{goalStatusLabels[status]}</span>}</div>
          {!!goal.links.length && <div className="team-work-links" role="group" aria-label={`Work links for ${goal.text}`} tabIndex={0}>{goal.links.map((link,index)=>link.kind==='focus'
            ? <span key={index}><WorkLinkIcon link={link} size={12} />{[link.title,link.target?.objective,link.target?.goalText].filter(Boolean).join(' · ')}</span>
            : <a key={index} href={link.url} target="_blank" rel="noreferrer"><WorkLinkIcon link={link} size={12} />{workLinkLabel(link)}</a>)}</div>}
        </li>;
      })}</ul>}
      {member.update?.body && <p className="week-day-body team-update-body">{member.update.body}</p>}
      {!member.goals.length && !member.update && <p className="team-empty">No goals for this week yet.</p>}
    </div>
  </article>;
}

export function MyTeam() {
  const [date,setDate]=useState(initialDate),[view,setView]=useState<TeamDay>(),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const today=calendarDay();
  useEffect(()=>{
    const controller=new AbortController();setView(undefined);setError('');
    void api<TeamDay>('/api/team-updates?date='+date,'GET',undefined,controller.signal).then(saved=>{if(!controller.signal.aborted)setView(saved);}).catch(e=>{if(!controller.signal.aborted)setError((e as Error).message);});
    return ()=>controller.abort();
  },[date,retry]);
  function choose(next:string) {
    if(next>today||next===date)return;
    const url=new URL(location.href);url.searchParams.set('date',next);history.replaceState(history.state,'',url);setDate(next);
  }
  const parsed=new Date(date+'T12:00:00');
  const label=parsed.toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short',...(parsed.getFullYear()!==new Date().getFullYear()?{year:'numeric' as const}:{})});
  return <div className="my-week my-team">
    <header className="week-header"><h1>My team</h1><div className="team-heading-controls">
      <div className="week-navigation" role="group" aria-label="Team update date">
        <button type="button" aria-label="Previous day" disabled={!view || !view.firstDate || date<=view.firstDate} onClick={()=>choose(shift(date,-1))}><ChevronLeft size={18}/></button>
        <button type="button" className="week-navigation-current" aria-label="Go to today" title="Go to today" onClick={()=>choose(today)}><span aria-live="polite">{date===today ? 'Today' : label}</span></button>
        <button type="button" aria-label="Next day" disabled={!view || date>=today} onClick={()=>choose(shift(date,1))}><ChevronRight size={18}/></button>
      </div>
    </div></header>
    {error ? <p role="alert">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>
      : !view ? <p role="status">Loading team updates…</p>
      : <div className="team-members">{view.members.map(member=><MemberUpdate key={member.id} member={member}/>)}</div>}
  </div>;
}
