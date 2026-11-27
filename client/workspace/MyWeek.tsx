import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, Plus } from 'lucide-react';
import type { DailyUpdateDraft, GoalStatus, WeekRecord, WeeklyGoalDraft, WeeklyPlan, WeeklyRange } from '../../shared/weekly.js';
import { GoalStatusFooter } from './GoalStatusFooter.js';
import type { PositionFocus } from '../../shared/focus.js';
import { WeeklyGoalEditor, emptyWeeklyGoal, weeklyGoalDraft } from './WeeklyGoalEditor.js';
import { api } from './api.js';
import { DailyEntries } from './DailyEntries.js';
import { WeekTabs, type WeekView } from './WeekTabs.js';
import { goalStatusLabels } from '../../shared/weekly.js';
import { GoalOrder } from './GoalOrder.js';
import { workspaceHistoryIndex } from './useDraftFocusWorkflow.js';
import './weekly.css';

import {day,monday,shift} from './week-dates.js';
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

function compactRange(week: string) {
  const end = shift(week, 4);
  const start = new Date(week + 'T12:00:00');
  const outsideCurrentYear = start.getFullYear() !== new Date().getFullYear();
  const startLabel = start.toLocaleDateString('en-NZ', { day: 'numeric', ...(week.slice(0, 7) !== end.slice(0, 7) || outsideCurrentYear ? { month: 'short' as const } : {}), ...(outsideCurrentYear ? { year: 'numeric' as const } : {}) });
  const endLabel = new Date(end + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', ...(new Date(end).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}) });
  return startLabel + '–' + endLabel;
}

type EditableGoal = WeeklyGoalDraft & { key: string };
type RetainedUpdate = { payload: DailyUpdateDraft; error: string };
const dailyDateLabel = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'short' });
const editableGoal = (goal: WeeklyGoalDraft): EditableGoal => ({ ...goal, key: crypto.randomUUID() });
const planGoals = (goals: WeeklyGoalDraft[]) => goals.map(goal => ({
  ...(goal.id ? { id: goal.id } : {}), text: goal.text.trim(), ...(goal.visibility ? { visibility: goal.visibility } : {}), description: goal.description ?? '', completed: goal.completed ?? false,
  links: goal.links.map(link => link.kind === 'focus' ? { kind: link.kind, focusId: link.focusId, ...(link.target ? {target:link.target} : {}) }
    : { kind: link.kind, label: link.label, url: link.url }),
}));

function latestGoalStatuses(record: WeekRecord | undefined, date: string): Partial<Record<string, GoalStatus>> {
  const statuses: Partial<Record<string, GoalStatus>> = {};
  for (const update of [...(record?.updates ?? [])].filter(update => update.date <= date).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const flag of update.goalStatuses) statuses[flag.goalId] = flag.status;
  }
  return statuses;
}

function dailyDraft(plan: WeeklyPlan | undefined, date: string, body: string, statuses: Partial<Record<string, GoalStatus>>): DailyUpdateDraft {
  return { date, body, planVersion: plan?.version ?? 0,
    goalStatuses: plan?.goals.filter(goal => statuses[goal.id])
      .map(goal => ({ goalId: goal.id, status: statuses[goal.id]! })) ?? [] };
}

function WeeklyHelp({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null), popover = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 320 });
  const cancelClose = () => { clearTimeout(closeTimer.current); };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  function show() {
    cancelClose();
    const bounds = trigger.current!.getBoundingClientRect();
    const width = Math.min(400, window.innerWidth - 24);
    const below = window.innerHeight - bounds.bottom - 20;
    const above = bounds.top - 20;
    const placeBelow = below >= 320 || below >= above;
    const maxHeight = Math.max(0, Math.min(320, placeBelow ? below : above));
    setPosition({ left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)), top: placeBelow ? bounds.bottom + 8 : bounds.top - maxHeight - 8, maxHeight });
    popover.current?.showPopover();
  }
  function leave() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (!popover.current?.contains(document.activeElement)) popover.current?.hidePopover();
    }, 200);
  }
  return <>
    <button ref={trigger} type="button" className="week-help-trigger" aria-label={title} aria-haspopup="dialog" aria-expanded={open} popoverTarget={id}
      onPointerEnter={event => { if (event.pointerType === 'mouse') show(); }}
      onPointerLeave={event => { if (event.pointerType === 'mouse') leave(); }}
      onClick={event => {
        event.preventDefault();
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches || !popover.current?.matches(':popover-open')) show();
        else popover.current.hidePopover();
      }}><CircleHelp size={18} aria-hidden="true" /></button>
    <div ref={popover} id={id} popover="auto" role="dialog" aria-label={title} className="week-help-popover" style={position}
      onPointerEnter={cancelClose} onPointerLeave={event => { if (event.pointerType === 'mouse') leave(); }}
      onToggle={event => setOpen(event.currentTarget.matches(':popover-open'))}>
      <h3>{title}</h3>
      {children}
    </div>
  </>;
}

export function MyWeek({ privacyEnabled = false, targetEnabled = false }: { privacyEnabled?: boolean; targetEnabled?: boolean }) {
  const [view, setView] = useState<WeekView>('updates');
  const tabsId = useId();
  const [week, setWeek] = useState(initialWeek), [reload, setReload] = useState(0);
  const [record, setRecord] = useState<WeekRecord>();
  const [today, setToday] = useState(day), [dailyDate, setDailyDate] = useState<string>();
  const [firstWeek, setFirstWeek] = useState<string | null>(null);
  const [goals, setGoals] = useState<EditableGoal[]>([editableGoal(emptyWeeklyGoal())]), [body, setBody] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [focuses, setFocuses] = useState<PositionFocus[]>(), [focusError, setFocusError] = useState(''), [focusReload, setFocusReload] = useState(0);
  const historyIndex = useRef(workspaceHistoryIndex()), restoringHistory = useRef(false);
  const [planSaving, setPlanSaving] = useState(false), [planError, setPlanError] = useState('');
  const [statuses, setStatuses] = useState<Partial<Record<string, GoalStatus>>>({});
  const [savedUpdate, setSavedUpdate] = useState(''), [updateError, setUpdateError] = useState('');
  const [retainedUpdates, setRetainedUpdates] = useState<RetainedUpdate[]>([]);
  const generation = useRef(0);
  const editedDailyStatuses = useRef(new Set<string>());
  function changeStatus(id: string, status: GoalStatus) {
    editedDailyStatuses.current.add(id);
    setStatuses(values => ({ ...values, [id]: status })); setUpdateError('');
  }
  const latest = record?.plans.at(-1);
  const goalDirty = !!record && JSON.stringify(planGoals(goals)) !== JSON.stringify(planGoals(latest?.goals.map(weeklyGoalDraft) ?? [emptyWeeklyGoal()]));
  const completeGoals = goals.every(goal => goal.text.trim().length > 0);
  const currentWeek = monday(today);
  const oldestWeek = firstWeek && firstWeek < currentWeek ? firstWeek : currentWeek;
  const todayInWeek = today >= week && today <= shift(week, 6);
  const previousStatuses = latestGoalStatuses(record, shift(today, -1));
  const updatePayload = dailyDraft(latest, today, body, statuses);
  const updateSignature = JSON.stringify(updatePayload);
  const updateDirty = !!record && dailyDate === today && todayInWeek && updateSignature !== savedUpdate && (!!body || Object.keys(statuses).length > 0 || record.updates.some(update => update.date === today));
  const dirty = goalDirty || updateDirty || retainedUpdates.length > 0;
  function changeGoals(change: (values: EditableGoal[]) => EditableGoal[]) {
    setPlanError(''); setUpdateError(''); setGoals(change);
  }
  function restoreDaily(saved: WeekRecord, date: string) {
    const plan = saved.plans.at(-1);
    const previous = saved.updates.find(update => update.date === date);
    const carried = latestGoalStatuses(saved, date);
    const flags = Object.fromEntries((plan?.goals ?? []).filter(goal => carried[goal.id]).map(goal => [goal.id, carried[goal.id]]));
    editedDailyStatuses.current.clear();
    setBody(previous?.body ?? ''); setStatuses(flags); setDailyDate(date); setUpdateError('');
    setSavedUpdate(JSON.stringify(dailyDraft(plan, date, previous?.body ?? '', flags)));
  }
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      setToday(day());
      const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, midnight.getTime() - Date.now() + 25);
    }
    refresh();
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    if (!record || !dailyDate || dailyDate === today || busy || planSaving || goalDirty) return;
    const payload = dailyDraft(latest, dailyDate, body, statuses);
    const baseline: DailyUpdateDraft = JSON.parse(savedUpdate);
    const baselineStatuses = Object.fromEntries(baseline.goalStatuses.map(flag => [flag.goalId, flag.status]));
    const before = dailyDraft(latest, dailyDate, baseline.body, baselineStatuses);
    if (dailyDate >= week && dailyDate <= shift(week, 6) && JSON.stringify(payload) !== JSON.stringify(before)) {
      setRetainedUpdates(values => [...values.filter(value => value.payload.date !== dailyDate), { payload, error: updateError || 'This update did not finish saving before the day changed.' }]);
    }
    restoreDaily(record, today);
  }, [today, dailyDate, record, busy, planSaving, latest, body, statuses, savedUpdate, updateError, goalDirty, week]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setRecord(undefined); setError(''); setUpdateError(''); setPlanError(''); setPlanSaving(false); setRetainedUpdates([]);
    void Promise.all([api<WeekRecord>('/api/weeks/' + week, 'GET', undefined, controller.signal), api<WeeklyRange>('/api/weeks', 'GET', undefined, controller.signal)]).then(([saved, range]) => {
      if (controller.signal.aborted || generation.current !== current) return;
      setFirstWeek(range.firstWeek);
      const plan = saved.plans.at(-1), date = day();
      const drafts = (plan?.goals.map(weeklyGoalDraft) ?? [emptyWeeklyGoal()]).map(editableGoal);
      setRecord(saved); setGoals(drafts); setToday(date);
      restoreDaily(saved, date);
    }).catch(e => { if (!controller.signal.aborted) setError((e as Error).message); });
    return () => { controller.abort(); generation.current++; };
  }, [week, reload]);
  useEffect(() => {
    if (!record || !goalDirty || !completeGoals || busy || planSaving || planError) return;
    const timer = window.setTimeout(() => {
      const sent = goals, current = generation.current;
      setPlanSaving(true);
      void api<WeekRecord>(`/api/weeks/${week}/plans`, 'POST', { version: latest?.version ?? 0, goals: planGoals(sent).map(goal => privacyEnabled ? goal : (({visibility: _visibility, ...rest}) => rest)(goal)) })
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
                if (editedDailyStatuses.current.delete(goal.key)) editedDailyStatuses.current.add(savedGoals[index]!.id);
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
    if (day() !== today) { setToday(day()); return; }
    if (!record || !latest || !updateDirty || goalDirty || busy || planSaving || updateError) return;
    const timer = window.setTimeout(() => {
      const current = generation.current;
      const payload: DailyUpdateDraft = JSON.parse(updateSignature);
      if (day() !== payload.date) { setToday(day()); return; }
      setBusy(true);
      void api<WeekRecord>(`/api/weeks/${week}/updates`, 'POST', payload)
        .then(saved => {
          if (generation.current !== current) return;
          setRecord(saved);
          setSavedUpdate(updateSignature);
        })
        .catch(e => { if (generation.current === current) setUpdateError((e as Error).message); })
        .finally(() => { if (generation.current === current) setBusy(false); });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [record, latest, updateDirty, updateSignature, goalDirty, busy, planSaving, updateError, week, today]);

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
  async function retryRetainedUpdate(original: DailyUpdateDraft) {
    if (busy || planSaving || goalDirty || !latest) return;
    const ids = new Set(latest.goals.map(goal => goal.id));
    const payload = { ...original, planVersion: latest.version, goalStatuses: original.goalStatuses.filter(flag => ids.has(flag.goalId)) };
    const current = generation.current;
    const previous = latestGoalStatuses(record, today);
    setBusy(true);
    try {
      const saved = await api<WeekRecord>(`/api/weeks/${week}/updates`, 'POST', payload);
      if (generation.current !== current) return;
      setRecord(saved);
      setRetainedUpdates(values => values.filter(value => value.payload.date !== payload.date));
      const carried = latestGoalStatuses(saved, today);
      const savedBody = saved.updates.find(update => update.date === today)?.body ?? '';
      setSavedUpdate(JSON.stringify(dailyDraft(saved.plans.at(-1), today, savedBody, carried)));
      if (day() === today && dailyDate === today) setStatuses(values => {
        const next = { ...values };
        for (const goal of saved.plans.at(-1)?.goals ?? []) {
          if (values[goal.id] === previous[goal.id] && !editedDailyStatuses.current.has(goal.id)) next[goal.id] = carried[goal.id];
        }
        return next;
      });
    } catch (error) {
      if (generation.current === current) setRetainedUpdates(values => values.map(value => value.payload.date === payload.date ? { ...value, error: (error as Error).message } : value));
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  function addGoal() {
    const goal = editableGoal(emptyWeeklyGoal());
    changeGoals(values => [...values, goal]);
  }
  function chooseWeek(next: string) {
    if (busy || planSaving || !next || !Number.isFinite(Date.parse(next))) return;
    next = monday(next);
    if (next === week || (dirty && !window.confirm('Leave without saving your weekly goals or update?'))) return;
    const url = new URL(location.href); url.searchParams.set('week', next); history.replaceState(history.state, '', url);
    setWeek(next);
  }
  const updateFeedback = updateError && <p role="alert">{updateError} <button type="button" onClick={() => setUpdateError('')}>Retry saving update</button></p>;
  const savedStatuses = latestGoalStatuses(record, shift(week, 6));
  const isCompleted = (goal: EditableGoal) => {
    const status = todayInWeek ? statuses[goal.id ?? goal.key] : savedStatuses[goal.id ?? goal.key];
    return status ? status === 'done' : !!goal.completed;
  };
  const activeGoals = goals.filter(goal => !isCompleted(goal)), completedGoals = goals.filter(isCompleted);
  const completedToday = completedGoals.filter(goal => previousStatuses[goal.id ?? goal.key] !== 'done' && !goal.completed);
  function renderDailyGoals(items: EditableGoal[], label: string) {
    return <ul className="week-today-goals" aria-label={label}>{items.map(goal => {
            const index = goals.indexOf(goal);
            const status = statuses[goal.id ?? goal.key];
            return <li key={goal.key}><span className={`week-today-goal-title${status === 'done' ? ' is-done' : ''}`}>{goal.text || `Goal ${index + 1}`}</span>
              <GoalStatusFooter disabled={dailyDate !== today} name={goal.id ?? goal.key} title={goal.text || `goal ${index + 1}`} status={status}
                onChange={next => changeStatus(goal.id ?? goal.key, next)} />
            </li>;
          })}</ul>;
  }
  function renderGoalEditors(items: EditableGoal[], reorderable = true) {
    return <GoalOrder items={items} onReorder={reorderable ? (key, index) => changeGoals(values => {
      const next = [...items], from = next.findIndex(goal => goal.key === key);
      const [goal] = next.splice(from, 1); next.splice(index, 0, goal!);
      const keys = new Set(items.map(item => item.key)); let position = 0;
      return values.map(value => keys.has(value.key) ? next[position++]! : value);
    }) : undefined}>{goal => <WeeklyGoalEditor goal={goal} privacyEnabled={privacyEnabled} targetEnabled={targetEnabled} number={goals.indexOf(goal) + 1} removable={goals.length > 1}
              onChange={next => changeGoals(values => values.map(value => value.key === goal.key ? { ...next, key: goal.key } : value))}
              onRemove={() => changeGoals(values => values.filter(value => value.key !== goal.key))}
              status={todayInWeek ? statuses[goal.id ?? goal.key] : undefined}
              onStatusChange={todayInWeek && dailyDate === today ? next => changeStatus(goal.id ?? goal.key, next) : undefined}
              focuses={focuses} focusError={focusError} retryFocuses={() => setFocusReload(value => value + 1)}
              saveError={planError} onRetrySave={() => setPlanError('')} />}</GoalOrder>;
  }
  return <div className="my-week is-daily">
    <header className="week-header"><h1>My week</h1>
      <div className="week-heading-controls">
      <div className="week-navigation" role="group" aria-label="Week navigation">
        <button type="button" aria-label="Previous week" disabled={!record || busy || planSaving || week <= oldestWeek} onClick={() => chooseWeek(shift(week, -7))}><ChevronLeft size={18} /></button>
        <button type="button" className="week-navigation-current" aria-label="Go to this week" title="Go to this week" disabled={!record || busy || planSaving} onClick={() => chooseWeek(currentWeek)}><span aria-live="polite"><span className="week-range-full">{labelDate(week)} – {labelDate(shift(week, 4))}</span><span className="week-range-short">{compactRange(week)}</span></span></button>
        <button type="button" aria-label="Next week" disabled={!record || busy || planSaving} onClick={() => chooseWeek(week < oldestWeek ? oldestWeek : shift(week, 7))}><ChevronRight size={18} /></button>
      </div>
      <WeekTabs value={view} onChange={setView} id={tabsId} />
      </div>
    </header>
    {error && <p role="alert">{error} <button disabled={busy || planSaving} onClick={() => { if (!dirty || window.confirm('Reload the saved week and discard your unsaved changes?')) setReload(value => value + 1); }}>Reload saved week</button></p>}
    {!record ? (!error && <p role="status">Loading your week…</p>) : <>
      {view === 'updates' && <div role="tabpanel" id={`${tabsId}-updates-panel`} aria-labelledby={`${tabsId}-updates-tab`} tabIndex={0}><div className="week-daily-layout">
        {todayInWeek && <section className="week-today-section" aria-label="Daily update">
          <div className="week-update-heading"><div className="week-heading-title"><h2>Today’s update</h2>          <WeeklyHelp title="What makes a useful daily update?">
            <p>A few specific sentences are enough to help your teammates understand your day.</p>
            <ul>
              <li><strong>Progress:</strong> What changed or moved forward? Mention a result, decision or something you learned.</li>
              <li><strong>Next:</strong> What will you work on next?</li>
              <li><strong>Help:</strong> What is blocking you, and what support do you need?</li>
            </ul>
            <p className="week-update-example">The sign-in fix is ready for review. Next I’ll test it on mobile. I need a teammate to review the access checks.</p>
          </WeeklyHelp>
</div><span className="muted">{new Date(today + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'short' })}</span></div>
          <div className="week-day-entry week-daily-composer"><div className="week-day-content">
          {dailyDate !== today && <p role="status">Finish saving your goals and previous update to start today’s update.</p>}
          <p id="daily-update-prompt" className="week-update-prompt">What moved forward today? Anything blocking you?</p>
          <div className="week-update-notes">
            <textarea disabled={dailyDate !== today} aria-label="Daily update" aria-describedby="daily-update-prompt" maxLength={4000} rows={2} value={body} onChange={e => { setBody(e.target.value); setUpdateError(''); }} placeholder="Write your daily update…" />
          </div>
          {renderDailyGoals(activeGoals, "Today's goal statuses")}
          {completedToday.length > 0 && <><h3 className="week-completed-heading">Completed</h3>{renderDailyGoals(completedToday, "Today's completed goals")}</>}
          {updateFeedback}
          </div></div>
        </section>}
        {record.updates.some(update => update.date !== today) && <section className="week-day-entries" aria-label="Previous updates">
          <h2 className="week-history-heading">Previous updates</h2>
          <DailyEntries updates={record.updates.filter(update => update.date !== today)} plans={record.plans} />
        </section>}
        {!todayInWeek && record.updates.length === 0 && <p className="muted">No updates for this week yet. Open Goals to plan your week.</p>}
        {planError && <p role="alert">{planError} <button type="button" onClick={() => setView('goals')}>Open Goals to retry</button></p>}
      </div></div>}
      {view === 'goals' && <div role="tabpanel" id={`${tabsId}-goals-panel`} aria-labelledby={`${tabsId}-goals-tab`} tabIndex={0}>
        <section className="week-card week-goals-panel" aria-label="Weekly goals">
          <div className="week-goals-heading">
            <div className="week-heading-title"><h2>Weekly goals</h2><WeeklyHelp title="What makes a useful weekly goal?">
            <p>Tasks are fine. Make the intended result clear, for example: “Run the pre-release smoke test and record the results.”</p>
            <p>Goals stay in their own week and do not repeat automatically. Add recurring work again for each week.</p>
          </WeeklyHelp></div>

            <div className="week-header-actions"><button type="button" className="week-add" disabled={goals.length >= 10} onClick={addGoal}><Plus size={16} /> Add goal</button></div>
          </div>
          <form onSubmit={e => e.preventDefault()}>
            {renderGoalEditors(activeGoals)}
            {completedGoals.length > 0 && <><h3 className="week-completed-heading">Completed</h3>{renderGoalEditors(completedGoals, false)}</>}
            {updateFeedback}
            {planError && <p role="alert">{planError} <button type="button" onClick={() => setPlanError('')}>Retry saving goals</button><button type="button" disabled={busy || planSaving} onClick={() => { if (window.confirm('Reload the saved week and discard your unsaved changes?')) setReload(value => value + 1); }}>Reload saved week</button></p>}
          </form>
        </section>
      </div>}
      {retainedUpdates.length > 0 && <section className="week-day-entries" aria-label="Unsaved previous updates">
        <h2 className="week-history-heading">Unsaved previous updates</h2>
        {retainedUpdates.map(({ payload, error }) => <article className="week-card" key={payload.date}>
          <h3>{dailyDateLabel(payload.date)}</h3>
          {payload.body && <p className="week-day-body">{payload.body}</p>}
          {payload.goalStatuses.length > 0 && <ul>{payload.goalStatuses.map(flag => <li key={flag.goalId}>
            {record.plans.find(plan => plan.version === payload.planVersion)?.goals.find(goal => goal.id === flag.goalId)?.text}: {goalStatusLabels[flag.status]}
          </li>)}</ul>}
          <p role="alert">{error}</p>
          <button type="button" disabled={busy || planSaving || goalDirty} aria-label={`Retry saving update for ${dailyDateLabel(payload.date)}`} onClick={() => void retryRetainedUpdate(payload)}>Retry saving update</button>
        </article>)}
      </section>}
    </>}
  </div>;
}
