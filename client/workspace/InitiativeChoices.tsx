import type { ObjectiveAlignment, ObjectiveAlignmentChoice } from "../../shared/focus.js";
import { InitiativeIdentity } from "./InitiativeIdentity.js";
import type { InitiativeReadiness } from "./useDraftFocusWorkflow.js";

export function InitiativeChoices({ selection, readiness, onInitiative, onOther, onRetry }: {
  selection: ObjectiveAlignmentChoice;
  readiness: InitiativeReadiness;
  onInitiative: (id: string, checked: boolean) => void;
  onOther: (checked: boolean) => void;
  onRetry: () => void;
}) {
  return (
    <fieldset className="initiative-choices">
      <legend>Strategic initiatives</legend>
      <p className="muted">Select all that apply, or choose Other.</p>
      {readiness.status === "failed" ? <p role="alert">{readiness.error} <button type="button" onClick={onRetry}>Retry initiatives</button></p> :
        readiness.status === "loading" ? <p role="status">Loading initiatives…</p> : <>
          <div className="initiative-options">
            {!readiness.choices.length && <p className="muted">No active initiatives have been configured yet.</p>}
            {readiness.choices.map(item => <label className="initiative-option" key={item.id}>
              <input type="checkbox" checked={selection.initiatives.some(choice => choice.id === item.id)}
                onChange={event => onInitiative(item.id, event.target.checked)} />
              <span><InitiativeIdentity name={item.name} appearance={item.appearance} />{item.archived && <small>Archived · retained on this objective</small>}</span>
            </label>)}
            <label className="initiative-option initiative-other">
              <input type="checkbox" checked={selection.other}
                onChange={event => onOther(event.target.checked)} />
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
