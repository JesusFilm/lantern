import { useEffect, useRef, useState } from 'react';
import type { AiMemberDetail, AiMemberFocusContent } from '../../shared/ai-members.js';
import { api } from '../workspace/api.js';
import { CoachPreparing } from '../coach/CoachPreparing.js';
import '../coach/coach.css';

export function AiFocusEditor({ member, available, onSaved, onCancel }: { member: AiMemberDetail; available: boolean; onSaved: (member: AiMemberDetail) => void; onCancel: () => void }) {
  const [content, setContent] = useState<AiMemberFocusContent>({ objective: member.focus?.objective ?? '', goals: member.focus?.goals ?? [''] });
  const [error, setError] = useState(''), [saving, setSaving] = useState(false), [preparing, setPreparing] = useState(false), [suggestion, setSuggestion] = useState<AiMemberFocusContent>();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { window.scrollTo(0, 0); heading.current?.focus({ preventScroll: true }); }, []);
  const epoch = useRef(0), controller = useRef<AbortController | undefined>(undefined);
  function cancelCoach() { epoch.current++; controller.current?.abort(); setPreparing(false); }
  useEffect(() => () => { epoch.current++; controller.current?.abort(); }, []);
  function update(next: AiMemberFocusContent) { cancelCoach(); setSuggestion(undefined); setContent(next); }
  async function coach() {
    cancelCoach();
    const generation = epoch.current, abort = new AbortController();
    controller.current = abort; setPreparing(true); setSuggestion(undefined); setError('');
    try {
      const result = await api<AiMemberFocusContent>('/api/ai-members/' + member.id + '/coach', 'POST', content, abort.signal);
      if (epoch.current === generation && !abort.signal.aborted) setSuggestion(result);
    } catch (e) { if (epoch.current === generation && !abort.signal.aborted) setError((e as Error).message); }
    finally { if (epoch.current === generation) setPreparing(false); }
  }
  function move(index: number, delta: number) {
    const goals = [...content.goals], next = index + delta;
    [goals[index], goals[next]] = [goals[next]!, goals[index]!];
    update({ ...content, goals });
  }
  return <div className="ai-focus-editor">
    <h2 ref={heading} tabIndex={-1}>{member.name}</h2>
    <p className="muted">{member.focus ? `Saved version ${member.focus.version}` : 'No saved focus yet.'} Changes stay here until Save.</p>
    {member.purpose && <details className="ai-purpose"><summary>Role / purpose</summary><p className="ai-plain-text">{member.purpose}</p></details>}
    <form onSubmit={e => {
      e.preventDefault(); if (saving || preparing) return;
      setSaving(true); setError('');
      void api<AiMemberDetail>('/api/ai-members/' + member.id + '/focus', 'PUT', { ...content, version: member.focus?.version ?? 0 }).then(onSaved).catch(e => setError(e.message)).finally(() => setSaving(false));
    }}>
      <fieldset className="dialog-fields" disabled={saving}>
        <label htmlFor="ai-objective">Objective</label><textarea id="ai-objective" required maxLength={10000} rows={4} value={content.objective} onChange={e => update({ ...content, objective: e.target.value })} />
        <h3>SMART goals</h3>
        {content.goals.map((goal, index) => <div className="ai-goal" key={index}>
          <label htmlFor={`ai-goal-${index}`}>SMART goal {index + 1}</label><textarea id={`ai-goal-${index}`} required maxLength={10000} rows={3} value={goal} onChange={e => update({ ...content, goals: content.goals.map((g, i) => i === index ? e.target.value : g) })} />
          <div className="ai-actions"><button type="button" aria-label={`Move goal ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>Move up</button>
            <button type="button" aria-label={`Move goal ${index + 1} down`} disabled={index === content.goals.length - 1} onClick={() => move(index, 1)}>Move down</button>
            <button type="button" aria-label={`Remove goal ${index + 1}`} disabled={content.goals.length === 1} onClick={() => update({ ...content, goals: content.goals.filter((_, i) => i !== index) })}>Remove</button></div>
        </div>)}
        <button type="button" disabled={content.goals.length >= 100} onClick={() => update({ ...content, goals: [...content.goals, ''] })}>Add SMART goal</button>
      </fieldset>
      <section className="ai-coach" aria-label="Focus coaching"><h3>Refine with AI</h3>
        <p>Coaching uses the purpose and the objective/goals above. Applying a suggestion changes this form; Save is still required.</p>
        {available ? <button type="button" disabled={saving || preparing} onClick={() => void coach()}>Suggest improvements</button> : <p>Coaching is unavailable. You can continue writing manually.</p>}
        {suggestion && <div className="ai-suggestion"><h3>Suggested focus</h3><p className="ai-plain-text">{suggestion.objective}</p><ol>{suggestion.goals.map((goal, i) => <li key={i} className="ai-plain-text">{goal}</li>)}</ol>
          <div className="ai-actions"><button type="button" disabled={saving} onClick={() => update(suggestion)}>Apply suggestion</button><button type="button" disabled={saving} onClick={() => setSuggestion(undefined)}>Dismiss suggestion</button></div></div>}
      </section>
      {error && <p role="alert">{error}</p>}
      <div className="ai-actions ai-focus-actions"><button type="button" disabled={saving} onClick={() => { cancelCoach(); onCancel(); }}>Cancel</button><button className="primary" disabled={saving || preparing}>{saving ? 'Saving…' : 'Save focus'}</button></div>
    </form>
    <CoachPreparing stage={preparing ? 'objective' : null} onBack={cancelCoach} onClose={() => {}} />
  </div>;
}
