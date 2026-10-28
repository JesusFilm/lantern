import { useFocusRecord } from "../coach/useFocusRecord.js";
import { useEffect, useState } from "react";
import type { CoachCheckpoint, CoachRecord } from "../../shared/coach.js";
import type { SessionView } from "../../shared/access.js";
import type { EditTarget } from "./useDraftFocusWorkflow.js";
import {
  FocusAssistance,
  assistanceCheckpoint,
} from "../coach/FocusAssistance.js";
import { CoachWorkspace } from "../coach/CoachWorkspace.js";
import { api } from "./api.js";
import { ObjectiveType, ObjectiveTypeChoices, objectiveTypes } from "./ObjectiveType.js";
import { FocusObjectives } from "./FocusObjectives.js";
import type { ObjectiveKind, PositionFocus } from "../../shared/focus.js";
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
export function FocusWorkspace({
  member,
  canConfirm,
  onGuide,
  coachAvailable = false,
  session,
}: {
  member: { id: string; name: string };
  coachAvailable?: boolean;
  session: SessionView;
  canConfirm: boolean;
  departmentId: string;
  onGuide: () => void;
}) {
  const {
    items,
    focus,
    direction,
    loading,
    error,
    edit,
    reload,
    select,
    begin,
    change,
    cancel,
    save,
    retryInitiatives,
    acceptConfirmed,
  } = useDraftFocusWorkflow();
  const [assistance, setAssistance] = useState<{
    entry: NonNullable<CoachCheckpoint["entry"]>;
    checkpoint?: CoachCheckpoint;
  }>();
  const {
    record,
    accept: acceptRecord,
    error: recordError,
    refresh: refreshRecord,
  } = useFocusRecord(focus?.id, focus?.version);
  const { record: editRecord, accept: acceptEditRecord } = useFocusRecord(
    edit?.source?.id,
    edit?.source?.version,
  );
  const [appliedProgress, setAppliedProgress] = useState<{
    id: string;
    editKey: number;
    revision: string | 0;
  }>();
  const [reviewing, setReviewing] = useState(false),
    [afterSave, setAfterSave] = useState<{
      id: string;
      section: number;
      goal: boolean;
    }>();
  const [progressError, setProgressError] = useState("");
  useEffect(() => {
    setReviewing(false);
    setProgressError("");
  }, [focus?.id]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (edit) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const nav = (e: Event) => {
      if (edit && !window.confirm("Leave without saving your changes?"))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    window.addEventListener("lantern-coach-leave", nav);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("lantern-coach-leave", nav);
    };
  }, [edit]);
  function start(
    target: EditTarget,
    entry?: NonNullable<CoachCheckpoint["entry"]>,
    source?: PositionFocus,
  ) {
    begin(target, source);
    setAppliedProgress(undefined);
    setAfterSave(undefined);
    setAssistance(entry ? { entry } : undefined);
  }
  const checkpoint = record?.checkpoint;
  const currentRecord = editRecord;
  function resume(here = false) {
    const checkpoint = here ? editRecord?.checkpoint : record?.checkpoint;
    const source = here ? edit?.source : focus;
    if (!checkpoint || !source) return;
    const entry =
      checkpoint.entry ||
      (checkpoint.step >= 4
        ? source.sections[checkpoint.sectionIndex ?? 0]
          ? "goal"
          : "objective"
        : "work");
    if (here && edit && (edit.type === "objective" || edit.type === "goal")) {
      if (
        !window.confirm(
          "Use the saved coaching answers for this " +
            edit.type +
            "? Review the suggestion before saving.",
        )
      )
        return;
      const fresh = assistanceCheckpoint(edit, edit.type);
      const resumingWork = edit.type === "objective" && checkpoint.step < 2;
      const entry = resumingWork ? "work" : edit.type;
      setAssistance({
        entry,
        checkpoint: {
          ...checkpoint,
          ...fresh,
          entry,
          work: checkpoint.work,
          answers: checkpoint.answers,
          question: checkpoint.question,
          options: checkpoint.options,
          answer: checkpoint.answer,
          action: checkpoint.action,
          date: checkpoint.date || fresh.date,
          revision: checkpoint.revision,
          objective:
            edit.type === "objective" ? checkpoint.objective : fresh.objective,
          goal: edit.type === "goal" ? checkpoint.goal : fresh.goal,
          step:
            edit.type === "goal"
              ? checkpoint.goal ? 6 : 4
              : resumingWork ? checkpoint.step : 2,
        },
      });
    } else if (focus && checkpoint.sourceVersion === focus.version) {
      const section = checkpoint.sectionIndex ?? 0,
        goal = checkpoint.goalIndex ?? 0;
      begin(
        entry === "goal"
          ? {
              type: "goal",
              section,
              goal,
              adding:
                checkpoint.adding ??
                goal === (focus.sections[section]?.goals.length ?? 0),
            }
          : {
              type: "objective",
              section,
              adding: checkpoint.adding ?? section === focus.sections.length,
            },
      );
      setAssistance({
        entry,
        checkpoint: {
          ...checkpoint,
          entry,
          step:
            entry === "goal"
              ? Math.max(4, Math.min(6, checkpoint.step))
              : Math.min(2, checkpoint.step),
        },
      });
    } else
      setProgressError(
        "The focus changed since this coaching was saved. Open the objective or goal you want to work on, then choose Resume saved help here.",
      );
  }
  async function saveEdit() {
    const pending = edit,
      applied = appliedProgress;
    const result = await save();
    if (
      result &&
      pending &&
      (pending.type === "objective" || pending.type === "goal")
    )
      setAfterSave({
        id: result.id,
        section: pending.section,
        goal: pending.type === "goal",
      });
    if (result && applied?.id === result.id && applied.editKey === pending?.key) {
      setAppliedProgress(undefined);
      try {
        const r = await api<CoachRecord>(
          "/api/coach/focuses/" + result.id + "/progress",
          "DELETE",
          { version: result.version, checkpointRevision: applied.revision },
        );
        acceptRecord(r);
      } catch {
        setProgressError(
          "Your draft was saved. Coaching progress changed or could not be cleared; it has been retained.",
        );
      }
    }
  }
  if (reviewing && focus && !edit)
    return (
      <CoachWorkspace
        session={session}
        focusId={focus.id}
        onBack={() => {
          setReviewing(false);
          void reload();
        }}
        onEdit={(target, source) => {
          setReviewing(false);
          start(target, undefined, source);
        }}
        onCoach={
          coachAvailable
            ? (target, source) => {
                setReviewing(false);
                start(target, target.type === "goal" ? "goal" : "objective", source);
              }
            : undefined
        }
      />
    );
  return (
    <>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void reload()}>Try again</button>
        </p>
      )}
      {!assistance &&
        (loading ? (
          <p role="status">Loading position focuses…</p>
        ) : focus ? (
          <>
            <FocusHeading
              key={"heading-" + focus.id}
              focus={focus}
              member={member}
              onBack={() => select()}
              onMetadata={() => begin({ type: "metadata" })}
              onConfirmed={canConfirm ? acceptConfirmed : undefined}
            />
            <div className="focus-review-actions">
              <button onClick={() => setReviewing(true)}>
                Review whole focus
              </button>
              {record?.requests.length ? (
                <span className="muted">
                  {record.requests.at(-1)?.document.version === focus.version
                    ? "Review requested"
                    : "Changes not sent"}
                  {record.notes.some(
                    (n) =>
                      n.authorId !== member.id &&
                      !n.deletedAt &&
                      !record.readIds.includes(n.id),
                  )
                    ? " · New notes"
                    : ""}
                </span>
              ) : null}
            </div>
            {(progressError || recordError) && (
              <p role="alert">
                {progressError || recordError}{" "}
                <button onClick={() => void refreshRecord()}>Refresh</button>
              </p>
            )}
            {checkpoint && focus.status === "draft" && (
              <div className="saved-coaching">
                <span>
                  Saved coaching · Objective{" "}
                  {(checkpoint.sectionIndex ?? 0) + 1}
                </span>
                <button onClick={() => resume()}>Resume coaching</button>
                <button
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Discard this saved coaching progress? Your focus stays unchanged.",
                      )
                    )
                      return;
                    try {
                      acceptRecord(
                        await api<CoachRecord>(
                          "/api/coach/focuses/" + focus.id + "/progress",
                          "DELETE",
                          {
                            version: focus.version,
                            checkpointRevision: checkpoint.revision ?? 0,
                          },
                        ),
                      );
                    } catch (e) {
                      setProgressError((e as Error).message);
                    }
                  }}
                >
                  Discard saved coaching
                </button>
                <details>
                  <summary>Saved working notes</summary>
                  <p>{checkpoint.work}</p>
                  {checkpoint.answers.map((a, i) => (
                    <p key={i}>
                      {a.question} — {a.answer}
                    </p>
                  ))}
                  <p>{checkpoint.objective}</p>
                  <p>{checkpoint.action}</p>
                  <p>{checkpoint.date}</p>
                  <p>{checkpoint.goal}</p>
                </details>
              </div>
            )}
            {afterSave?.id === focus.id && (
              <div className="editor-actions" role="status">
                <span>{afterSave.goal ? "Goal saved" : "Objective saved"}</span>
                <button
                  onClick={() =>
                    start({
                      type: "goal",
                      section: afterSave.section,
                      adding: true,
                    })
                  }
                >
                  {afterSave.goal ? "Add another goal" : "Add SMART goal"}
                </button>
                <button onClick={() => setAfterSave(undefined)}>
                  Done with this objective
                </button>
              </div>
            )}
            <FocusObjectives
              key={"reader-" + focus.id}
              focus={focus}
              onEdit={(t) => start(t)}
              onCoach={
                coachAvailable
                  ? (t) => start(t, t.type === "goal" ? "goal" : "objective")
                  : undefined
              }
            />
            {coachAvailable && focus.status === "draft" && (
              <button
                onClick={() =>
                  start(
                    {
                      type: "objective",
                      section: focus.sections.length,
                      adding: true,
                    },
                    "work",
                  )
                }
              >
                Help me get started
              </button>
            )}
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
            {direction && (
              <MissionBanner
                mission={direction.mission}
                image={direction.missionImage}
              />
            )}
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
                        <button className="link" onClick={() => select(x.id)}>
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
                <p>
                  Start with a small draft, then talk it through with your
                  career lead.
                </p>
                <p>
                  The Guide explains the process and shows what a useful
                  objective and SMART goals can look like.
                </p>
                <button className="primary" onClick={onGuide}>
                  Start here
                </button>
                <p className="muted">
                  An incomplete draft is a useful starting point.
                </p>
              </div>
            )}
          </div>
        ))}
      {edit && edit.type !== "metadata" && !assistance && (
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
          onSave={saveEdit}
        >
          {edit.type === "remove-goal" || edit.type === "remove-objective" ? (
            <>
              <p className="muted">Position focus: {edit.source.title}</p>
              <p>This removes the content from your saved position focus.</p>
            </>
          ) : (
            <WritingHelp
              kind={edit.type === "goal" ? "goal" : edit.kind}
              focusTitle={edit.source.title}
            >
              {edit.type === "goal" && (
                <>
                  <ObjectiveType
                    kind={edit.source.sections[edit.section]!.kind}
                  />
                  <p className="muted">
                    For objective:{" "}
                    {edit.source.sections[edit.section]?.objective}
                  </p>
                </>
              )}
              <div className="objective-field-heading">
                <label htmlFor="edit-text">
                  {edit.type === "goal" ? "SMART goal" : "Objective"}
                </label>
                {edit.type === "objective" && <span className="badge">{objectiveTypes[edit.kind].label}</span>}
              </div>
              <p className="writing-hint" id="writing-hint">
                {edit.type === "goal"
                  ? "What will you do, what evidence will show progress, and by when?"
                  : "Who will benefit, what will improve, and why does it matter?"}
              </p>
              <textarea
                id="edit-text"
                aria-describedby="writing-hint"
                name="text"
                placeholder={
                  edit.type === "goal"
                    ? "By [date], [action], with [evidence of progress]…"
                    : "Help [people] to [useful change] so that [why it matters]…"
                }
                required
                maxLength={10000}
                autoFocus
                value={edit.text}
                onChange={(event) =>
                  change({ type: "text", text: event.target.value })
                }
              />
              {edit.type === "objective" && (
                <ObjectiveTypeChoices
                  kind={edit.kind}
                  onChange={(kind) => change({ type: "kind", kind })}
                />
              )}
              {edit.type === "objective" && (
                <InitiativeChoices
                  selection={edit.alignment}
                  readiness={edit.initiatives}
                  onInitiative={(id, checked) =>
                    change({ type: "initiative", id, checked })
                  }
                  onOther={(checked) => change({ type: "other", checked })}
                  onRetry={retryInitiatives}
                />
              )}
              {coachAvailable && (
                <button
                  type="button"
                  onClick={() =>
                    setAssistance({ entry: edit.type as "objective" | "goal" })
                  }
                >
                  Help me write this
                </button>
              )}
              {editRecord?.checkpoint && (
                <button type="button" onClick={() => resume(true)}>
                  Resume saved help here
                </button>
              )}
              <p className="muted writing-draft-note">
                A partial draft is fine. You can refine the wording with your
                career lead before confirmation.
              </p>
            </WritingHelp>
          )}
        </Dialog>
      )}
      {assistance &&
        edit &&
        (edit.type === "objective" || edit.type === "goal") && (
          <FocusAssistance
            key={edit.key}
            edit={edit}
            initial={
              assistance.checkpoint ||
              assistanceCheckpoint(edit, assistance.entry)
            }
            available={coachAvailable}
            onRetryInitiatives={retryInitiatives}
            onClose={() => setAssistance(undefined)}
            onUse={(c) => {
              change({ type: "suggestion", checkpoint: c });
              if (assistance.checkpoint)
                setAppliedProgress({
                  id: edit.source.id,
                  editKey: edit.key,
                  revision: assistance.checkpoint.revision ?? 0,
                });
              setAssistance(undefined);
            }}
            onPause={async (c) => {
              if (!currentRecord)
                throw new Error(
                  "Wait for saved coaching to load, then try again.",
                );
              if (
                currentRecord.checkpoint &&
                !assistance.checkpoint &&
                !window.confirm(
                  "Replace the previously saved coaching progress for this focus?",
                )
              )
                return;
              const r = await api<CoachRecord>(
                "/api/coach/focuses/" + edit.source.id + "/progress",
                "PUT",
                {
                  version: edit.source.version,
                  checkpointRevision:
                    assistance.checkpoint?.revision ??
                    currentRecord.checkpoint?.revision ??
                    0,
                  checkpoint: c,
                },
              );
              acceptRecord(r);
              acceptEditRecord(r);
              setAssistance(undefined);
              cancel();
            }}
          />
        )}
      {edit?.type === "metadata" && (
        <Dialog
          key={edit.key}
          title={edit.source ? "Edit title & dates" : "New position focus"}
          onClose={cancel}
          onSave={saveEdit}
        >
          {edit.source && (
            <p className="muted">Position focus: {edit.source.title}</p>
          )}
          <label htmlFor="title">Document title</label>
          <input
            id="title"
            name="title"
            required
            maxLength={200}
            value={edit.values.title}
            onChange={(event) =>
              change({
                type: "metadata",
                values: { title: event.target.value },
              })
            }
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
                onChange={(event) =>
                  change({
                    type: "metadata",
                    values: { start: event.target.value },
                  })
                }
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
                onChange={(event) =>
                  change({
                    type: "metadata",
                    values: { end: event.target.value },
                  })
                }
              />
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
