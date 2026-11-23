import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from './Dialog.js';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { maxWeeklyGoalDescriptionLength } from '../../shared/weekly.js';

export function GoalMarkdown({ text }: { text: string }) {
  return <div className="week-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml
    components={{ a: ({ children, href, title }) => <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a> }}
  >{text}</Markdown></div>;
}

export function GoalDetailEditor({ title, value, number, onSave, onClose }: {
  title: string; value: string; number: number;
  onSave: (title: string, description: string) => void; onClose: () => void;
}) {
  const [draftTitle, setTitle] = useState(title), [description, setDescription] = useState(value);
  return createPortal(<Dialog title={`Edit goal ${number}`} saveLabel="Save details" onClose={onClose}
    onSave={async () => { onSave(draftTitle, description); onClose(); }}>
    <label>Goal title<input type="text" required maxLength={1000} value={draftTitle}
      onChange={event => setTitle(event.target.value)} /></label>
    <label>Markdown description for goal {number}<textarea autoFocus rows={10}
      maxLength={maxWeeklyGoalDescriptionLength} value={description}
      placeholder="Add context, a plan, or supporting information…"
      onChange={event => setDescription(event.target.value)} /></label>
    <p className="muted">Save details to apply your changes to the weekly plan.</p>
  </Dialog>, document.body);
}
