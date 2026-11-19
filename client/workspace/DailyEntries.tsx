import { ChevronDown } from 'lucide-react';
import type { DailyUpdate, WeeklyPlan } from '../../shared/weekly.js';
import { goalStatusLabels } from '../../shared/weekly.js';

export function DailyEntries({ updates, plans }: {
  updates: DailyUpdate[]; plans: WeeklyPlan[];
}) {
  if (!updates.length) return null;
  return <section className="week-day-entries" aria-label="Saved daily updates">
    {[...updates].sort((a, b) => b.date.localeCompare(a.date)).map(update => <details className="week-day-entry" key={update.id}>
      <summary><span>{new Date(update.date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'short' })}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className="week-day-content">
        {!!update.goalStatuses.length && <ul className="week-today-goals">{update.goalStatuses.map(flag => <li key={flag.goalId}>
          <span className={`week-today-goal-title${flag.status === 'done' ? ' is-done' : ''}`}>{plans.find(plan => plan.version === update.planVersion)?.goals.find(goal => goal.id === flag.goalId)?.text}</span>
          <span className={`week-today-status flag-${flag.status}`}>{goalStatusLabels[flag.status]}</span>
        </li>)}</ul>}
        {update.body && <p className="week-day-body">{update.body}</p>}
      </div>
    </details>)}
  </section>;
}
