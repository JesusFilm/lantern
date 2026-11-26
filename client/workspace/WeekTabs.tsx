import { useRef } from 'react';
export type WeekView = 'updates' | 'goals';
const views: WeekView[] = ['updates', 'goals'];
export function WeekTabs({ value, onChange, id }: { value: WeekView; onChange: (view: WeekView) => void; id: string }) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return <div className="week-view-tabs" role="tablist" aria-label="My week view">
    {views.map((view, index) => <button key={view} ref={element => { buttons.current[index] = element; }} type="button" role="tab"
      id={`${id}-${view}-tab`} aria-controls={`${id}-${view}-panel`} aria-selected={value === view} tabIndex={value === view ? 0 : -1}
      onClick={() => onChange(view)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % views.length : event.key === 'ArrowLeft' ? (index + views.length - 1) % views.length : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault(); onChange(views[next]!); buttons.current[next]?.focus();
      }}>{view === 'updates' ? 'Updates' : 'Goals'}</button>)}
  </div>;
}
