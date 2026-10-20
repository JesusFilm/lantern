import type { ObjectiveKind } from "../../shared/focus.js";
import { FocusConfirmation } from "./FocusConfirmation.js";
import { Dialog } from "./Dialog.js";
import { MissionBanner } from "./MissionBanner.js";
import { AlignmentSummary, InitiativeChoices } from "./InitiativeChoices.js";
import { useDraftFocusWorkflow } from "./useDraftFocusWorkflow.js";
const date = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const kindLabels: Record<ObjectiveKind, string> = {
  normal: "Normal Objectives",
  "personal-development": "Personal Development Objectives",
  leadership: "Leadership Objectives",
};
export function FocusWorkspace({ member, canConfirm }: {
  member: { id: string; name: string };
  canConfirm: boolean;
  departmentId: string;
}) {
  const {
    items, focus, direction, loading, error, edit,
    reload, select, begin, change, cancel, save, retryInitiatives, acceptConfirmed,
  } = useDraftFocusWorkflow();
  const editable = focus?.status === "draft";
  return (
    <>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void reload()}>Try again</button>
        </p>
      )}
      {loading ? <p role="status">Loading position focuses…</p> : focus ? (
        <>
          <button className="link back" onClick={() => select()}>
            ← Position focuses
          </button>
          <header>
            <div>
              <h1>{focus.title}</h1>
              <p className="muted">
                {date(focus.start)} – {date(focus.end)}
              </p>
            </div>
            {editable && <button
              onClick={() => begin({ type: "metadata" })}
            >
              Edit title & dates
            </button>}
          </header>
          <FocusConfirmation key={focus.id} focus={focus} member={member}
            onConfirmed={canConfirm ? acceptConfirmed : undefined} />
          {focus.sections.length ? (
            focus.sections.map((section, i) => (
              <section className="read-section" key={i}>
                <div className="read-objective">
                  <div className="row section-heading">
                    <div className="section-label">
                      <h2>Objective {i + 1}</h2>
                      {section.kind !== "normal" && (
                        <span className="badge">
                          {kindLabels[section.kind]}
                        </span>
                      )}
                    </div>
                    {editable && <div className="section-tools">
                      <button
                        className="link edit-action"
                        onClick={() =>
                          begin({ type: "objective", section: i })
                        }
                      >
                        Edit objective
                      </button>
                      <button
                        className="link danger small-action"
                        onClick={() =>
                          begin({ type: "remove-objective", section: i })
                        }
                      >
                        Remove
                      </button>
                    </div>}
                  </div>
                  <p className="read-text">{section.objective}</p>
                  <AlignmentSummary alignment={section.alignment} />
                </div>
                <div className="read-goals">
                  <h3>SMART goals</h3>
                  {section.goals.map((goal, j) => (
                    <div className="read-goal" key={j}>
                      <span className="goal-number">{j + 1}</span>
                      <p className="read-text">{goal}</p>
                      {editable && <div>
                        <button
                          className="link"
                          onClick={() =>
                            begin({ type: "goal", section: i, goal: j })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="link danger small-action"
                          onClick={() =>
                            begin({
                              type: "remove-goal",
                              section: i,
                              goal: j,
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>}
                    </div>
                  ))}
                  {!section.goals.length && (
                    <p className="muted">No goals yet.</p>
                  )}
                  {editable && <button
                    className="link"
                    onClick={() =>
                      begin({ type: "goal", section: i, adding: true })
                    }
                  >
                    + Add SMART goal
                  </button>}
                </div>
              </section>
            ))
          ) : (
            <div className="empty-base">
              <h2>A blank position focus</h2>
              <p>Add your first objective when you’re ready.</p>
              <button
                className="primary"
                onClick={() =>
                  begin({ type: "objective", section: 0, adding: true })
                }
              >
                Add objective
              </button>
            </div>
          )}
          {editable && <div className="editor-actions">
            <button
              onClick={() =>
                begin({
                  type: "objective",
                  section: focus.sections.length,
                  adding: true,
                })
              }
            >
              + Add objective
            </button>
          </div>}
        </>
      ) : (
        <>
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
              <p>Create a document for the period you want to focus on.</p>
            </div>
          )}
        </>
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
          <p className="muted">Position focus: {edit.source.title}</p>
          {edit.type === "remove-goal" || edit.type === "remove-objective" ? (
            <p>This removes the content from your saved position focus.</p>
          ) : (
            <>
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
              <label htmlFor="edit-text">
                {edit.type === "goal" ? "SMART goal" : "Objective"}
              </label>
              <textarea
                id="edit-text"
                name="text"
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
            </>
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
