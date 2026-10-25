import { FocusObjectives } from "./FocusObjectives.js";
import type { ObjectiveKind } from "../../shared/focus.js";
import { FocusHeading } from "./FocusHeading.js";
import { Dialog } from "./Dialog.js";
import { MissionBanner } from "./MissionBanner.js";
import { InitiativeChoices } from "./InitiativeChoices.js";
import { useDraftFocusWorkflow } from "./useDraftFocusWorkflow.js";
import { WritingHelp } from "./WritingHelp.js";
const date = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const kindLabels: Record<ObjectiveKind, string> = {
  normal: "Contribution",
  "personal-development": "Personal development (optional)",
  leadership: "Leadership (optional)",
};
export function FocusWorkspace({ member, canConfirm, onGuide }: {
  member: { id: string; name: string };
  canConfirm: boolean;
  departmentId: string;
  onGuide: () => void;
}) {
  const {
    items, focus, direction, loading, error, edit,
    reload, select, begin, change, cancel, save, retryInitiatives, acceptConfirmed,
  } = useDraftFocusWorkflow();
  return (
    <>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void reload()}>Try again</button>
        </p>
      )}
      {loading ? <p role="status">Loading position focuses…</p> : focus ? (
        <>
          <FocusHeading key={"heading-" + focus.id} focus={focus} member={member}
            onBack={() => select()} onMetadata={() => begin({ type: "metadata" })}
            onConfirmed={canConfirm ? acceptConfirmed : undefined} />
          <FocusObjectives key={"reader-" + focus.id} focus={focus} onEdit={begin} />
        </>
      ) : (
        <div className="focus-overview">
          <header>
            <div>
              <h1>Position focuses</h1>
            </div>
            <button
              className="primary"
              onClick={() => begin({ type: "create" })}
            >
              New position focus
            </button>
          </header>
          {direction && <MissionBanner mission={direction.mission} image={direction.missionImage} />}
          {items.length ? (
            <table className="focus-list">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Period</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <button
                        className="link"
                        onClick={() => select(x.id)}
                      >
                        {x.title}
                      </button>
                    </td>
                    <td>
                      {date(x.start)} – {date(x.end)}
                    </td>
                    <td>
                      <button onClick={() => select(x.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-base">
              <h2>Your first position focus</h2>
              <p>Start with a small draft, then talk it through with your career lead.</p>
              <p>The Guide explains the process and shows what a useful objective and SMART goals can look like.</p>
              <button className="primary" onClick={onGuide}>Start here</button>
              <p className="muted">An incomplete draft is a useful starting point.</p>
            </div>
          )}
        </div>
      )}
      {edit && edit.type !== "metadata" && (
        <Dialog
          key={edit.key}
          title={
            edit.type === "remove-goal" || edit.type === "remove-objective"
              ? "Remove this " +
                (edit.type === "remove-goal"
                  ? "goal"
                  : "objective and its goals") +
                "?"
              : (edit.adding ? "Add " : "Edit ") +
                (edit.type === "goal" ? "SMART goal" : "objective")
          }
          saveLabel={edit.type.startsWith("remove") ? "Remove" : "Save changes"}
          onClose={cancel}
          onSave={save}
        >
          {edit.type === "remove-goal" || edit.type === "remove-objective" ? (
            <>
              <p className="muted">Position focus: {edit.source.title}</p>
              <p>This removes the content from your saved position focus.</p>
            </>
          ) : (
            <WritingHelp kind={edit.type === "goal" ? "goal" : edit.kind} focusTitle={edit.source.title}>
              {edit.type === "objective" && edit.adding && (
                <fieldset className="objective-types">
                  <legend>Objective type</legend>
                  {Object.entries(kindLabels).map(([kind, label]) => (
                    <label className="type-choice" key={kind}>
                      <input
                        type="radio"
                        name="kind"
                        value={kind}
                        checked={edit.kind === kind}
                        onChange={() => change({ type: "kind", kind: kind as ObjectiveKind })}
                      />
                      <strong>{label}</strong>
                    </label>
                  ))}
                </fieldset>
              )}
              {edit.type === "goal" && <p className="muted">For objective: {edit.source.sections[edit.section]?.objective}</p>}
              <label htmlFor="edit-text">
                {edit.type === "goal" ? "SMART goal" : "Objective"}
              </label>
              <p className="writing-hint" id="writing-hint">{edit.type === "goal"
                ? "What will you do, what evidence will show progress, and by when?"
                : "Who will benefit, what will improve, and why does it matter?"}</p>
              <textarea
                id="edit-text"
                aria-describedby="writing-hint"
                name="text"
                placeholder={edit.type === "goal" ? "By [date], [action], with [evidence of progress]…" : "Help [people] to [useful change] so that [why it matters]…"}
                required
                maxLength={10000}
                autoFocus
                value={edit.text}
                onChange={event => change({ type: "text", text: event.target.value })}
              />
              {edit.type === "objective" && <InitiativeChoices
                selection={edit.alignment}
                readiness={edit.initiatives}
                onInitiative={(id, checked) => change({ type: "initiative", id, checked })}
                onOther={checked => change({ type: "other", checked })}
                onRetry={retryInitiatives}
              />}
              <p className="muted writing-draft-note">A partial draft is fine. You can refine the wording with your career lead before confirmation.</p>
            </WritingHelp>
          )}
        </Dialog>
      )}
      {edit?.type === "metadata" && (
        <Dialog
          key={edit.key}
          title={edit.source ? "Edit title & dates" : "New position focus"}
          onClose={cancel}
          onSave={save}
        >
          {edit.source && <p className="muted">Position focus: {edit.source.title}</p>}
          <label htmlFor="title">Document title</label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            value={edit.values.title}
            onChange={event => change({ type: "metadata", values: { title: event.target.value } })}
          />
          <div className="metadata">
            <div>
              <label htmlFor="start">Period starts</label>
              <input
                id="start"
                name="start"
                type="date"
                required
                value={edit.values.start}
                onChange={event => change({ type: "metadata", values: { start: event.target.value } })}
              />
            </div>
            <div>
              <label htmlFor="end">Period ends</label>
              <input
                id="end"
                name="end"
                type="date"
                required
                value={edit.values.end}
                onChange={event => change({ type: "metadata", values: { end: event.target.value } })}
              />
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
