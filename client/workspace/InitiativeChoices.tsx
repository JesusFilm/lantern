import { useEffect, useState } from "react";
import type { DepartmentDirection } from "../../shared/direction.js";
import type { ObjectiveAlignment, ObjectiveAlignmentChoice } from "../../shared/focus.js";
import { api } from "./api.js";
import { InitiativeIdentity } from "./InitiativeIdentity.js";

export function InitiativeChoices({ initial }: { initial?: ObjectiveAlignment }) {
  const [selection, setSelection] = useState<ObjectiveAlignmentChoice>({ initiatives: initial?.initiatives.map(({ id }) => ({ id })) ?? [], other: initial?.other ?? false });
  const [direction, setDirection] = useState<DepartmentDirection>();
  const [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void api<DepartmentDirection>("/api/department/direction").then(value => {
      if (active) setDirection(value);
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attempt]);
  const choices = direction?.initiatives.filter(item => !item.archived || initial?.initiatives.some(choice => choice.id === item.id)) ?? [];
  return (
    <fieldset className="initiative-choices">
      <legend>Strategic initiatives</legend>
      <p className="muted">Select all that apply, or choose Other.</p>
      {error ? <p role="alert">{error} <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry initiatives</button></p> :
        !direction ? <p role="status">Loading initiatives…</p> : <>
          <input type="hidden" name="alignment" value={JSON.stringify(selection)} />
          <div className="initiative-options">
            {!choices.length && <p className="muted">No active initiatives have been configured yet.</p>}
            {choices.map(item => <label className="initiative-option" key={item.id}>
              <input type="checkbox" checked={selection.initiatives.some(choice => choice.id === item.id)}
                onChange={event => setSelection({
                  other: false,
                  initiatives: event.target.checked
                    ? [...selection.initiatives, { id: item.id }]
                    : selection.initiatives.filter(choice => choice.id !== item.id),
                })} />
              <span><InitiativeIdentity name={item.name} appearance={item.appearance} />{item.archived && <small>Archived · retained on this objective</small>}</span>
            </label>)}
            <label className="initiative-option initiative-other">
              <input type="checkbox" checked={selection.other}
                onChange={event => setSelection({ initiatives: [], other: event.target.checked })} />
              <span>Other — none of these apply</span>
            </label>
          </div>
        </>}
    </fieldset>
  );
}

export function AlignmentSummary({ alignment }: { alignment?: ObjectiveAlignment }) {
  if (!alignment || (!alignment.other && !alignment.initiatives.length)) return null;
  return <div className="alignment-summary">
    <h3>Strategic initiatives</h3>
    {alignment.other ? <span className="badge">Other — none of these apply</span> :
      <ul>{alignment.initiatives.map(item => <li key={item.id}><InitiativeIdentity name={item.name} appearance={item.appearance} chip /></li>)}</ul>}
  </div>;
}
