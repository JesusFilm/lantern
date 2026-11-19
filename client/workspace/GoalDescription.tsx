import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { maxWeeklyGoalDescriptionLength } from '../../shared/weekly.js';

export function GoalMarkdown({ text }: { text: string }) {
  return <div className="week-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml
    components={{ a: ({ children, href, title }) => <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a> }}
  >{text}</Markdown></div>;
}

export function GoalDetailEditor({ title, value, number, onTitleChange, onChange, onClose, saveError, onRetry }: {
  title: string; value: string; number: number; onTitleChange: (value: string) => void;
  onChange: (value: string) => void; onClose: () => void; saveError?: string; onRetry?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; };
  }, []);
  return createPortal(<dialog ref={dialog} className="week-goal-editor" aria-label={`Edit goal ${number}`}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="week-goal-editor-heading">
      <input type="text" aria-label="Goal title" className="week-goal-editor-title" required maxLength={1000}
        placeholder="Write a goal…" value={title} onChange={event => onTitleChange(event.target.value)} />
      <button type="button" className="week-goal-editor-close" aria-label="Close goal editor" onClick={onClose}><X size={24} /></button>
    </header>
    <div className="week-goal-editor-body">
      <textarea className="week-goal-editor-markdown" aria-label={`Markdown description for goal ${number}`} autoFocus
        value={value} maxLength={maxWeeklyGoalDescriptionLength} rows={8}
        placeholder={'Add context, a plan, or supporting information…\n\n## What success looks like\n- …\n\n## Notes\nLinks, code, and anything else that helps.'}
        onChange={event => onChange(event.target.value)} />
    {saveError && <p role="alert" className="week-goal-editor-error">{saveError} <button type="button" onClick={onRetry}>Retry saving</button></p>}
    </div>
  </dialog>, document.body);
}
