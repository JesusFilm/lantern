import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Ellipsis, EyeOff, FileText, Plus, Trash2, UsersRound, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Dialog } from './Dialog.js';
import { GoalStatusFooter } from './GoalStatusFooter.js';
import type { PositionFocus } from '../../shared/focus.js';
import type { GoalStatus, GoalVisibility, WeeklyGoal, WeeklyGoalDraft } from '../../shared/weekly.js';

import { WorkLinkIcon, workLinkLabel } from './WorkLinkIcon.js';
import { WeeklyLinkDialog } from './WeeklyLinkDialog.js';
import { GoalDetailEditor, GoalMarkdown } from './GoalDescription.js';

export const workLabels = { focus: 'Position focus', project: 'Project', repository: 'Repository', issue: 'Issue', other: 'Other work' };
const goalVisibility: Record<GoalVisibility, string> = {
  team: 'Team', lead: 'Me and my career lead', private: 'Only me',
};

function navigateMenu(event: KeyboardEvent<HTMLDivElement>) {
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const current = buttons.findIndex(button => button === document.activeElement);
  const next = event.key === 'ArrowDown' ? (current + 1) % buttons.length : event.key === 'ArrowUp' ? (current - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
  if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
}

function TeamVisibilityIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="6" r="3" /><path d="M7 21v-3a5 5 0 0 1 10 0v3" />
    <circle cx="4" cy="10" r="2" /><path d="M1 20v-3a3 3 0 0 1 4-2.8" />
    <circle cx="20" cy="10" r="2" /><path d="M23 20v-3a3 3 0 0 0-4-2.8" />
  </svg>;
}

export const emptyWeeklyGoal = (): WeeklyGoalDraft => ({ text: '', links: [] });
export function weeklyGoalDraft(goal: WeeklyGoal): WeeklyGoalDraft {
  return { id: goal.id, text: goal.text, visibility: goal.visibility, description: goal.description ?? '', completed: goal.completed ?? false, links: goal.links.map(link => link.kind === 'focus' ? { kind: 'focus', focusId: link.focusId, ...(link.target ? {target:{version:link.target.version,section:link.target.section,goal:link.target.goal}} : {}) } : link) };
}
export function WeeklyGoalLinks({ goal, showDescription = true }: { goal: WeeklyGoal; showDescription?: boolean }) {
  return <>{showDescription && goal.description?.trim() && <details className="week-history-description"><summary>Description</summary><GoalMarkdown text={goal.description} /></details>}
    {goal.links.length ? <ul className="week-work-links">{goal.links.map((link, i) => <li key={i}>
    <a href={link.kind === 'focus' ? '/?focus=' + encodeURIComponent(link.focusId) : link.url} target="_blank" rel="noopener noreferrer">{workLabels[link.kind]}: {link.kind === 'focus' ? [link.title,link.target?.objective,link.target?.goalText].filter(Boolean).join(' · ') : link.label}</a>
  </li>)}</ul> : null}</>;
}
export function WeeklyGoalEditor({ goal, number, privacyEnabled = false, targetEnabled = false, removable, onChange, onRemove, focuses, focusError, retryFocuses, saveError, onRetrySave, status, onStatusChange }: {
  goal: WeeklyGoalDraft; number: number; privacyEnabled?: boolean; targetEnabled?: boolean; removable: boolean; onChange: (goal: WeeklyGoalDraft) => void;
  onRemove: () => void; focuses: PositionFocus[] | undefined; focusError: string; retryFocuses: () => void;
  status: GoalStatus | undefined; onStatusChange?: (status: GoalStatus) => void;
  saveError?: string; onRetrySave?: () => void;
}) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const visibility = goal.visibility ?? 'team';
  const sharing = goalVisibility[visibility];
  const visibilityMenuId = useId();
  const visibilityMenu = useRef<HTMLDivElement>(null);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  function positionMenu(button: HTMLButtonElement, width = 184) {
    const bounds = button.getBoundingClientRect();
    setMenuPosition({ top: Math.max(8, Math.min(bounds.bottom + 6, window.innerHeight - 154)), left: Math.max(8, Math.min(bounds.right - width, window.innerWidth - width - 8)) });
  }
  function action(run: () => void) { menu.current?.hidePopover(); run(); }

  return <div className={`week-goal-block${status === 'done' ? ' is-complete' : ''}`}>
    <div className="week-goal-entry">
    <input type="text" className="week-goal-text" aria-label={`Weekly goal ${number}`} required maxLength={1000} placeholder="Write a goal…" value={goal.text} onChange={e => onChange({ ...goal, text: e.target.value })} />
    {privacyEnabled && <>
      <button type="button" className="week-goal-visibility" aria-label={`Visibility for goal ${number}: ${sharing}`}
        title={`Visible to: ${sharing}`} aria-haspopup="menu" aria-expanded={visibilityOpen} popoverTarget={visibilityMenuId}
        onClick={event => positionMenu(event.currentTarget, 252)} onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); positionMenu(event.currentTarget, 252); visibilityMenu.current?.showPopover(); }
        }}>
        {visibility === 'team' ? <TeamVisibilityIcon /> : visibility === 'lead' ? <UsersRound size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}
      </button>
      <div ref={visibilityMenu} id={visibilityMenuId} popover="auto" role="menu" aria-label={`Visibility for goal ${number}`} className="week-goal-menu week-visibility-menu" style={menuPosition}
        onToggle={event => {
          const open = event.currentTarget.matches(':popover-open'); setVisibilityOpen(open);
          if (open) event.currentTarget.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
        }} onKeyDown={navigateMenu}>
        {(Object.keys(goalVisibility) as GoalVisibility[]).map(value => <button key={value} type="button" role="menuitemradio" aria-checked={visibility === value}
          onClick={() => { visibilityMenu.current?.hidePopover(); onChange({ ...goal, visibility: value }); }}>
          {value === 'team' ? <TeamVisibilityIcon /> : value === 'lead' ? <UsersRound size={20} aria-hidden="true" /> : <EyeOff size={20} aria-hidden="true" />}
          {goalVisibility[value]}
        </button>)}
      </div>
    </>}
    <button type="button" className="week-goal-menu-trigger" aria-label={`Actions for goal ${number}`} aria-haspopup="menu" popoverTarget={menuId}
      onClick={event => positionMenu(event.currentTarget)} onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); positionMenu(event.currentTarget); menu.current?.showPopover(); }
      }}><Ellipsis size={20} /></button>
    <div ref={menu} id={menuId} popover="auto" role="menu" aria-label={`Goal ${number} actions`} className="week-goal-menu" style={menuPosition}
      onToggle={event => { if (event.currentTarget.matches(':popover-open')) event.currentTarget.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }}
      onKeyDown={navigateMenu}>
      <button type="button" role="menuitem" disabled={goal.links.length >= 5} onClick={() => action(() => setEditing('new'))}><Plus size={16} />Add link</button>
      <button type="button" role="menuitem" onClick={() => action(() => setDescriptionOpen(true))}><FileText size={16} />Edit details</button>
      <button type="button" role="menuitem" className="week-goal-menu-delete" disabled={!removable} onClick={() => action(() => setConfirmRemove(true))}><Trash2 size={16} />Delete</button>
    </div>
    </div>
    {descriptionOpen && <GoalDetailEditor title={goal.text} value={goal.description ?? ''} number={number}
      onSave={(text, description) => onChange({ ...goal, text, description })} onClose={() => setDescriptionOpen(false)} />}
    {!!goal.links.length && <div className="week-attached-work week-goal-linked-work" role="group" aria-label={`Work links for goal ${number}`} tabIndex={0}>
      {goal.links.map((link, index) => <div className="week-link-chip" key={index}>
        <button type="button" onClick={() => setEditing(index)} aria-label={`Edit work link ${index + 1} for goal ${number}`}><WorkLinkIcon link={link} size={12} /><span>{link.kind === 'focus' ? focuses?.find(focus => focus.id === link.focusId)?.title ?? 'Position focus' : workLinkLabel(link) || workLabels[link.kind]}</span></button>
        <button type="button" className="week-chip-remove" aria-label={`Remove work link ${index + 1} from goal ${number}`} onClick={() => { onChange({ ...goal, links: goal.links.filter((_, i) => i !== index) }); }}><X size={13} /></button>
      </div>)}
    </div>}
    {onStatusChange && <GoalStatusFooter name={goal.id ?? `draft-${number}`} title={goal.text || `goal ${number}`} status={status} onChange={onStatusChange} />}
    {editing !== null && <WeeklyLinkDialog targetEnabled={targetEnabled} initial={editing === 'new' ? undefined : goal.links[editing]}
      focuses={focuses} focusError={focusError} retryFocuses={retryFocuses} onClose={() => setEditing(null)}
      onLink={link => onChange({ ...goal, links: editing === 'new' ? [...goal.links, link] : goal.links.map((current, index) => index === editing ? link : current) })} />}
    {confirmRemove && createPortal(<Dialog title="Delete this goal?" saveLabel="Delete goal" onClose={() => setConfirmRemove(false)}
      onSave={async () => { setConfirmRemove(false); onRemove(); }}>
      <p>This removes the goal and its links from your current weekly goals. You can’t undo this.</p>
      {goal.text && <p>{goal.text}</p>}
    </Dialog>, document.body)}
  </div>;
}
