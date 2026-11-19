import { useEffect, useRef, useState } from 'react';

export function InlineProfileField({ value, label, maxLength, onSave, username = false }: {
  value: string; label: string; maxLength: number; onSave: (value: string) => Promise<string>; username?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const saved = useRef(value), inFlight = useRef(false);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  async function save() {
    if (inFlight.current || draft === saved.current) return;
    const sent = draft;
    inFlight.current = true; setSaving(true); setError('');
    try {
      const canonical = await onSave(sent);
      saved.current = canonical;
      setDraft(current => current === sent ? canonical : current);
    } catch (error) { if (latestDraft.current === sent) setError((error as Error).message); }
    finally { inFlight.current = false; setSaving(false); }
  }
  useEffect(() => {
    if (draft === saved.current || saving || error) return;
    const timer = window.setTimeout(() => void save(), 600);
    return () => window.clearTimeout(timer);
  }, [draft, saving, error, onSave]);
  return <>
    <input className="profile-inline-input" type="text" aria-label={label} placeholder={label} maxLength={maxLength}
      autoCapitalize={username ? 'none' : undefined} autoCorrect={username ? 'off' : undefined} spellCheck={username ? false : undefined}
      value={draft} aria-invalid={!!error} onChange={event => { setDraft(event.target.value); setError(''); }}
      onBlur={() => { if (!error) void save(); }} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); void save(); }
        if (event.key === 'Escape') { setDraft(saved.current); setError(''); }
      }} />
    {error && <p role="alert" className="profile-inline-error">{error} <button type="button" className="link" onClick={() => void save()}>Retry</button></p>}
  </>;
}
