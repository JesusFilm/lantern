import { dailyGoalStatuses, goalStatusLabels } from '../../shared/weekly.js';
import type { GoalStatus } from '../../shared/weekly.js';

export function GoalStatusFooter({ name, title, status, onChange, disabled = false }: {
  disabled?: boolean; name: string; title: string; status: GoalStatus | undefined; onChange: (status: GoalStatus) => void;
}) {
  return <fieldset disabled={disabled} className="week-goal-statuses" aria-label={`Status for ${title}`}>
    {dailyGoalStatuses.map(value => <label key={value} className={`week-goal-flag flag-${value}`}>
      <input type="radio" name={`goal-status-${name}`} checked={status === value} onChange={() => onChange(value)} />
      <span><i aria-hidden="true" />{goalStatusLabels[value]}</span>
    </label>)}
  </fieldset>;
}
