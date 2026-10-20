import { useEffect, useState } from "react";
import type {
  FocusDraft,
  PositionFocus,
  ObjectiveKind,
} from "../../shared/focus.js";
import { FocusConfirmation } from "./FocusConfirmation.js";
import { api } from "./api.js";
import { Dialog } from "./Dialog.js";
import type { DepartmentDirection, ObjectiveAlignment } from "../../shared/direction.js";
import { MissionBanner } from "./MissionBanner.js";
import { AlignmentSummary, InitiativeChoices } from "./InitiativeChoices.js";
const date = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
type Edit = {
  type: "objective" | "goal" | "remove-objective" | "remove-goal";
  section: number;
  goal?: number;
  adding?: boolean;
};
const kindLabels: Record<ObjectiveKind, string> = {
  normal: "Normal Objectives",
  "personal-development": "Personal Development Objectives",
  leadership: "Leadership Objectives",
};
export function FocusWorkspace({ member, canConfirm, departmentId }: {
  member: { id: string; name: string };
  canConfirm: boolean;
  departmentId: string;
}) {
  const [edit, setEdit] = useState<Edit>();
  const [direction, setDirection] = useState<DepartmentDirection>();

  const [items, setItems] = useState<PositionFocus[]>([]),
    [focus, setFocus] = useState<PositionFocus>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [metadata, setMetadata] = useState(false),
    [creating, setCreating] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await api("/api/focuses"));
      setDirection(await api("/api/department/direction"));
      const id = new URLSearchParams(location.search).get("focus");
      setFocus(id ? await api("/api/focuses/" + id) : undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const pop = () => void load();
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  function open(value?: PositionFocus) {
    setFocus(value);
    const url = new URL(location.href);
    if (value) url.searchParams.set("focus", value.id);
    else url.searchParams.delete("focus");
    history.pushState(null, "", url);
    window.scrollTo(0, 0);
  }
  async function openSaved(id: string) {
    setError("");
    try {
      open(await api<PositionFocus>("/api/focuses/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function persist(draft: FocusDraft, newDocument = creating) {
    const result = await api<PositionFocus>(
      "/api/focuses" + (newDocument ? "" : "/" + focus!.id),
      newDocument ? "POST" : "PUT",
      { ...draft, ...(newDocument ? {} : { version: focus!.version }) },
    );
    setItems((old) =>
      [result, ...old.filter((x) => x.id !== result.id)].sort((a, b) =>
        b.start.localeCompare(a.start),
      ),
    );
    open(result);
    setMetadata(false);
    setEdit(undefined);
  }
  const editable = focus?.status === "draft";
  if (loading) return <p role="status">Loading position focuses…</p>;
  return (
    <>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Try again</button>
        </p>
      )}
      {focus ? (
        <>
          <button className="link back" onClick={() => open()}>
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
              onClick={() => {
                setCreating(false);
                setMetadata(true);
              }}
            >
              Edit title & dates
            </button>}
          </header>
          <FocusConfirmation key={focus.id} focus={focus} member={member}
            onConfirmed={canConfirm ? (saved) => {
              setFocus(saved);
              setItems(old => old.map(item => item.id === saved.id ? saved : item));
            } : undefined} />
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
                          setEdit({ type: "objective", section: i })
                        }
                      >
                        Edit objective
                      </button>
                      <button
                        className="link danger small-action"
                        onClick={() =>
                          setEdit({ type: "remove-objective", section: i })
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
                            setEdit({ type: "goal", section: i, goal: j })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="link danger small-action"
                          onClick={() =>
                            setEdit({
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
                      setEdit({ type: "goal", section: i, adding: true })
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
                  setEdit({ type: "objective", section: 0, adding: true })
                }
              >
                Add objective
              </button>
            </div>
          )}
          {editable && <div className="editor-actions">
            <button
              onClick={() =>
                setEdit({
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
              onClick={() => {
                setCreating(true);
                setMetadata(true);
              }}
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
                        onClick={() => void openSaved(x.id)}
                      >
                        {x.title}
                      </button>
                    </td>
                    <td>
                      {date(x.start)} – {date(x.end)}
                    </td>
                    <td>
                      <button onClick={() => void openSaved(x.id)}>Open</button>
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
      {edit && focus && (
        <Dialog
          title={
            edit.type.startsWith("remove")
              ? "Remove this " +
                (edit.type === "remove-goal"
                  ? "goal"
                  : "objective and its goals") +
                "?"
              : (edit.adding ? "Add " : "Edit ") +
                (edit.type === "goal" ? "SMART goal" : "objective")
          }
          saveLabel={edit.type.startsWith("remove") ? "Remove" : "Save changes"}
          onClose={() => setEdit(undefined)}
          onSave={async (data) => {
            const sections = structuredClone(focus.sections);
            if (edit.type === "remove-objective")
              sections.splice(edit.section, 1);
            else if (edit.type === "remove-goal")
              sections[edit.section]!.goals.splice(edit.goal!, 1);
            else {
              const text = String(data.get("text")).trim();
              if (!text) throw new Error("Enter some text before saving.");
              if (edit.type === "objective") {
                const value = data.get("alignment");
                if (typeof value !== "string") throw new Error("Wait for initiatives to load, or retry loading them before saving.");
                const alignment = JSON.parse(value) as ObjectiveAlignment;
                if (edit.adding)
                  sections.push({
                    kind: data.get("kind") as ObjectiveKind,
                    objective: text,
                    goals: [],
                    alignment,
                  });
                else {
                  sections[edit.section]!.objective = text;
                  sections[edit.section]!.alignment = alignment;
                }
              } else if (edit.adding) sections[edit.section]!.goals.push(text);
              else sections[edit.section]!.goals[edit.goal!] = text;
            }
            await persist(
              {
                title: focus.title,
                start: focus.start,
                end: focus.end,
                sections,
              },
              false,
            );
          }}
        >
          {edit.type.startsWith("remove") ? (
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
                        defaultChecked={kind === "normal"}
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
                defaultValue={
                  edit.adding
                    ? ""
                    : edit.type === "goal"
                      ? focus.sections[edit.section]!.goals[edit.goal!]
                      : focus.sections[edit.section]!.objective
                }
              />
              {edit.type === "objective" && <InitiativeChoices initial={edit.adding ? undefined : focus.sections[edit.section]!.alignment} />}
            </>
          )}
        </Dialog>
      )}
      {metadata && (
        <Dialog
          title={creating ? "New position focus" : "Edit title & dates"}
          onClose={() => setMetadata(false)}
          onSave={async (data) => {
            const start = String(data.get("start")),
              end = String(data.get("end"));
            if (end < start)
              throw new Error(
                "The end date must be on or after the start date.",
              );
            await persist({
              title: String(data.get("title")),
              start,
              end,
              sections: creating ? [] : focus!.sections,
            });
          }}
        >
          <label htmlFor="title">Document title</label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            defaultValue={creating ? "" : focus?.title}
          />
          <div className="metadata">
            <div>
              <label htmlFor="start">Period starts</label>
              <input
                id="start"
                name="start"
                type="date"
                required
                defaultValue={creating ? "" : focus?.start}
              />
            </div>
            <div>
              <label htmlFor="end">Period ends</label>
              <input
                id="end"
                name="end"
                type="date"
                required
                defaultValue={creating ? "" : focus?.end}
              />
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
