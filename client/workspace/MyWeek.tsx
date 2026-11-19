import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { DailyUpdateDraft, GoalStatus, WeekRecord, WeeklyGoalDraft, WeeklyPlan, WeeklyRange } from '../../shared/weekly.js';
import { goalStatusLabels } from '../../shared/weekly.js';
import type { PositionFocus } from '../../shared/focus.js';
import { WeeklyGoalEditor, emptyWeeklyGoal, weeklyGoalDraft } from './WeeklyGoalEditor.js';
import { api } from './api.js';
import { DailyEntries } from './DailyEntries.js';
import { GoalOrder } from './GoalOrder.js';
import { workspaceHistoryIndex } from './useDraftFocusWorkflow.js';
import './weekly.css';

function day(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function shift(value: string, days: number) {
  const date = new Date(value + 'T12:00:00'); date.setDate(date.getDate() + days); return day(date);
}
function monday(value: string) {
  const date = new Date(value + 'T12:00:00');
  return shift(value, -((date.getDay() + 6) % 7));
}
function initialWeek() {
  const value = new URLSearchParams(location.search).get('week');
  return value && /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    ? monday(value) : monday(day());
}
const labelDate = (value: string) => {
  const date = new Date(value + 'T12:00:00');
  return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}) });
};

type EditableGoal = WeeklyGoalDraft & { key: string };
const editableGoal = (goal: WeeklyGoalDraft): EditableGoal => ({ ...goal, key: crypto.randomUUID() });
const planGoals = (goals: WeeklyGoalDraft[]) => goals.map(goal => ({
  ...(goal.id ? { id: goal.id } : {}), text: goal.text.trim(), description: goal.description ?? '', completed: goal.completed ?? false,
  links: goal.links.map(link => link.kind === 'focus' ? { kind: link.kind, focusId: link.focusId }
    : { kind: link.kind, label: link.label, url: link.url }),
}));

function dailyDraft(plan: WeeklyPlan | undefined, date: string, body: string, statuses: Partial<Record<string, GoalStatus>>): DailyUpdateDraft {
  return { date, body, planVersion: plan?.version ?? 0,
    goalStatuses: plan?.goals.filter(goal => statuses[goal.id]).map(goal => ({ goalId: goal.id, status: statuses[goal.id]! })) ?? [] };
}

export function MyWeek() {
  const [week, setWeek] = useState(initialWeek), [reload, setReload] = useState(0);
  const [record, setRecord] = useState<WeekRecord>();
  const [firstWeek, setFirstWeek] = useState<string | null>(null);
  const [goals, setGoals] = useState<EditableGoal[]>([editableGoal(emptyWeeklyGoal())]), [body, setBody] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [focuses, setFocuses] = useState<PositionFocus[]>(), [focusError, setFocusError] = useState(''), [focusReload, setFocusReload] = useState(0);
  const historyIndex = useRef(workspaceHistoryIndex()), restoringHistory = useRef(false);
  const [planSaving, setPlanSaving] = useState(false), [planError, setPlanError] = useState('');
  const [statuses, setStatuses] = useState<Partial<Record<string, GoalStatus>>>({});
  const [savedUpdate, setSavedUpdate] = useState(''), [updateError, setUpdateError] = useState('');
  const generation = useRef(0);
  const latest = record?.plans.at(-1);
  const goalDirty = !!record && JSON.stringify(planGoals(goals)) !== JSON.stringify(planGoals(latest?.goals.map(weeklyGoalDraft) ?? [emptyWeeklyGoal()]));
  const completeGoals = goals.every(goal => goal.text.trim().length > 0);
  const today = day();
  const currentWeek = monday(today);
  const oldestWeek = firstWeek && firstWeek < currentWeek ? firstWeek : currentWeek;
  const todayInWeek = today >= week && today <= shift(week, 6);
  const updatePayload = dailyDraft(latest, today, body, statuses);
  const updateSignature = JSON.stringify(updatePayload);
  const updateDirty = !!record && todayInWeek && updateSignature !== savedUpdate && (!!body || Object.keys(statuses).length > 0 || record.updates.some(update => update.date === today));
  const dirty = goalDirty || updateDirty;
  function changeGoals(change: (values: EditableGoal[]) => EditableGoal[]) {
    setPlanError(''); setUpdateError(''); setGoals(change);
  }
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setRecord(undefined); setError(''); setUpdateError(''); setPlanError(''); setPlanSaving(false);
    void Promise.all([api<WeekRecord>('/api/weeks/' + week, 'GET', undefined, controller.signal), api<WeeklyRange>('/api/weeks', 'GET', undefined, controller.signal)]).then(([saved, range]) => {
      if (controller.signal.aborted || generation.current !== current) return;
      setFirstWeek(range.firstWeek);
      const plan = saved.plans.at(-1), date = day();
      const previous = saved.updates.filter(update => update.date === date).at(-1);
      const flags = Object.fromEntries((previous?.goalStatuses ?? []).filter(flag => plan?.goals.some(goal => goal.id === flag.goalId)).map(flag => [flag.goalId, flag.status]));
      const drafts = (plan?.goals.map(weeklyGoalDraft) ?? [emptyWeeklyGoal()]).map(editableGoal);
      if (!plan) flags[drafts[0]!.key] = 'on-track';
      setRecord(saved); setGoals(drafts);
      setBody(previous?.body ?? ''); setStatuses(flags);
      setSavedUpdate(JSON.stringify(previous ? { date, body: previous.body, planVersion: previous.planVersion, goalStatuses: previous.goalStatuses } : dailyDraft(plan, date, '', {})));
    }).catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => { controller.abort(); generation.current++; };
  }, [week, reload]);
  useEffect(() => {
    if (!record || !goalDirty || !completeGoals || busy || planSaving || planError) return;
    const timer = window.setTimeout(() => {
      const sent = goals, current = generation.current;
      setPlanSaving(true);
      void api<WeekRecord>(`/api/weeks/${week}/plans`, 'POST', { version: latest?.version ?? 0, goals: planGoals(sent) })
        .then(saved => {
          if (generation.current !== current) return;
          const savedGoals = saved.plans.at(-1)!.goals;
          setFirstWeek(value => value && value < week ? value : week);
          setRecord(saved);
          setStatuses(values => {
            const next = { ...values };
            sent.forEach((goal, index) => {
              if (!goal.id && values[goal.key]) {
                next[savedGoals[index]!.id] = values[goal.key]; delete next[goal.key];
              }
            });
            return next;
          });
          setGoals(values => values.map(goal => {
            const index = sent.findIndex(original => original.key === goal.key);
            return index < 0 ? goal : { ...goal, id: savedGoals[index]!.id };
          }));
        }).catch(e => { if (generation.current === current) setPlanError((e as Error).message); })
        .finally(() => { if (generation.current === current) setPlanSaving(false); });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [record, goals, week, latest?.version, goalDirty, completeGoals, busy, planSaving, planError]);

  useEffect(() => {
    if (!record || !latest || !updateDirty || goalDirty || busy || planSaving || updateError) return;
    const timer = window.setTimeout(() => {
      const current = generation.current;
      const payload: DailyUpdateDraft = JSON.parse(updateSignature);
      setBusy(true);
      void api<WeekRecord>(`/api/weeks/${week}/updates`, 'POST', payload)
        .then(saved => {
          if (generation.current !== current) return;
          setRecord(saved); setSavedUpdate(updateSignature);
        })
        .catch(e => { if (generation.current === current) setUpdateError((e as Error).message); })
        .finally(() => { if (generation.current === current) setBusy(false); });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [record, latest, updateDirty, updateSignature, goalDirty, busy, planSaving, updateError, week]);

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (dirty || busy || planSaving) { event.preventDefault(); event.returnValue = ''; } };
    const leave = (event: Event) => { if (busy || planSaving || (dirty && !window.confirm('Leave without saving your weekly goals or update?'))) event.preventDefault(); };
    const pop = (event: Event) => {
      const destination = workspaceHistoryIndex();
      if (restoringHistory.current) { restoringHistory.current = false; event.preventDefault(); return; }
      // Menu navigation already asks before pushing its synthetic popstate.
      if ((event as CustomEvent<{ browser: boolean }>).detail.browser) {
        leave(event);
        if (event.defaultPrevented) {
          restoringHistory.current = true;
          history.go(historyIndex.current - destination);
          return;
        }
      }
      historyIndex.current = destination;
    };
    window.addEventListener('beforeunload', before); window.addEventListener('lantern-coach-leave', leave); window.addEventListener('lantern-focus-history', pop);
    return () => { window.removeEventListener('beforeunload', before); window.removeEventListener('lantern-coach-leave', leave); window.removeEventListener('lantern-focus-history', pop); };
  }, [dirty, busy, planSaving]);
  useEffect(() => {
    const controller = new AbortController(); setFocusError('');
    void api<PositionFocus[]>('/api/focuses', 'GET', undefined, controller.signal)
      .then(setFocuses).catch(e => { if (!controller.signal.aborted) setFocusError((e as Error).message); });
    return () => controller.abort();
  }, [focusReload]);
  function addGoal() {
    const goal = editableGoal(emptyWeeklyGoal());
    changeGoals(values => [...values, goal]);
    setStatuses(values => ({ ...values, [goal.key]: 'on-track' }));
  }
  function chooseWeek(next: string) {
    if (busy || planSaving || !next || !Number.isFinite(Date.parse(next))) return;
    next = monday(next);
    if (next === week || (dirty && !window.confirm('Leave without saving your weekly goals or update?'))) return;
    const url = new URL(location.href); url.searchParams.set('week', next); history.replaceState(history.state, '', url);
    setWeek(next);
  }
  return <div className="my-week is-daily">
    <header className="week-header"><h1>My week</h1>
      <div className="week-heading-controls">
      <div className="week-navigation" role="group" aria-label="Week navigation">
        <button type="button" aria-label="Previous week" disabled={!record || busy || planSaving || week <= oldestWeek} onClick={() => chooseWeek(week > currentWeek ? currentWeek : shift(week, -7))}><ChevronLeft size={18} /></button>
        <button type="button" className="week-navigation-current" aria-label="Go to this week" title="Go to this week" disabled={!record || busy || planSaving} onClick={() => chooseWeek(currentWeek)}><span aria-live="polite">{labelDate(week)} – {labelDate(shift(week, 4))}</span></button>
        <button type="button" aria-label="Next week" disabled={!record || busy || planSaving || week >= currentWeek} onClick={() => chooseWeek(week < oldestWeek ? oldestWeek : shift(week, 7))}><ChevronRight size={18} /></button>
      </div>
      <div className="week-header-actions">{record && <button type="button" className="week-add" disabled={goals.length >= 10} onClick={addGoal}><Plus size={16} /> Add Goal</button>}
      </div>
      </div>
    </header>
    {error && <p role="alert">{error} <button disabled={busy || planSaving} onClick={() => { if (!dirty || window.confirm('Reload the saved week and discard your unsaved changes?')) setReload(value => value + 1); }}>Reload saved week</button></p>}
    {!record ? (!error && <p role="status">Loading your week…</p>) : <>
      <div className="week-daily-layout">
        <section className="week-card week-goals-panel" aria-label="Weekly goals">
          <form onSubmit={e => e.preventDefault()}>
            <GoalOrder items={goals} onReorder={(key, index) => changeGoals(values => {
              const next = [...values], from = next.findIndex(goal => goal.key === key);
              if (from < 0 || from === index) return values;
              const [goal] = next.splice(from, 1);
              next.splice(index, 0, goal!);
              return next;
            })}>{(goal, index) => <WeeklyGoalEditor goal={goal} number={index + 1} removable={goals.length > 1}
              onChange={next => changeGoals(values => values.map(value => value.key === goal.key ? { ...next, key: goal.key } : value))}
              onRemove={() => changeGoals(values => values.filter(value => value.key !== goal.key))}
              status={statuses[goal.id ?? goal.key]} statusKey={goal.id ?? goal.key}
              onStatusChange={status => { if (!todayInWeek) return; setStatuses(values => ({ ...values, [goal.id ?? goal.key]: status })); setUpdateError(''); }}
              focuses={focuses} focusError={focusError} retryFocuses={() => setFocusReload(value => value + 1)}
              saveError={planError} onRetrySave={() => setPlanError('')} />}</GoalOrder>
            {planError && <p role="alert">{planError} <button type="button" onClick={() => setPlanError('')}>Retry saving goals</button><button type="button" onClick={() => { if (window.confirm('Reload the saved week and discard your unsaved changes?')) setReload(value => value + 1); }}>Reload saved week</button></p>}
          </form>
        </section>
        <section className="week-day-entries" aria-label="Daily updates">
        {todayInWeek && <section className="week-day-entry week-daily-composer" aria-label="Daily update">
          <h2 className="week-day-heading">{new Date(today + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
          <div className="week-day-content">
          <ul className="week-today-goals" aria-label="Today's goal statuses">{goals.filter(goal => goal.text.trim()).map(goal => {
            const status = statuses[goal.id ?? goal.key];
            return <li key={goal.key}><span className={`week-today-goal-title${status === 'done' ? ' is-done' : ''}`}>{goal.text}</span><span className={`week-today-status${status ? ` flag-${status}` : ''}`}>{status ? goalStatusLabels[status] : '—'}</span></li>;
          })}</ul>
          <div className="week-update-notes">
            <textarea aria-label="Daily update" maxLength={4000} rows={1} value={body} onChange={e => { setBody(e.target.value); setUpdateError(''); }} placeholder="A short update is plenty…" />
          </div>
          {updateError && <p role="alert">{updateError} <button type="button" onClick={() => setUpdateError('')}>Retry saving update</button></p>}
          </div>
        </section>}
        <DailyEntries updates={record.updates.filter(update => update.date !== today)} plans={record.plans} />
        </section>
      </div>
    </>}
  </div>;
}
