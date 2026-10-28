import { useEffect, useState } from "react";
import type { SessionView } from "../../shared/access.js";
import type { PositionFocus } from "../../shared/focus.js";
import { useFocusRecord } from "../coach/useFocusRecord.js";
import { CoachWorkspace } from "../coach/CoachWorkspace.js";
import {
  useDraftFocusWorkflow,
  type EditTarget,
} from "./useDraftFocusWorkflow.js";
import { ObjectiveEditor, type AuthoringMethod } from "./ObjectiveEditor.js";
import { ObjectiveType } from "./ObjectiveType.js";
import { FocusHeading } from "./FocusHeading.js";
import { FocusObjectives } from "./FocusObjectives.js";
import { Dialog } from "./Dialog.js";
import { MissionBanner } from "./MissionBanner.js";
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
  canConfirm: boolean;
  onGuide: () => void;
  coachAvailable?: boolean;
  session: SessionView;
  departmentId: string;
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
  const {
    record,
    error: recordError,
    refresh: refreshRecord,
  } = useFocusRecord(focus?.id, focus?.version);
  const [method, setMethod] = useState<AuthoringMethod>("manual"),
    [reviewing, setReviewing] = useState(false);
  useEffect(() => setReviewing(false), [focus?.id]);
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
    chosen?: AuthoringMethod,
    source?: PositionFocus,
  ) {
    setMethod(
      chosen ??
        (target.type === "objective" && target.adding && coachAvailable
          ? "choose"
          : "manual"),
    );
    begin(target, source);
  }
  const saveEdit = async () => {
    const result = await save();
    if (result) void refreshRecord();
  };
  if (edit?.type === "objective")
    return (
      <ObjectiveEditor
        key={edit.key}
        edit={edit}
        initialMethod={method}
        available={coachAvailable}
        onChange={change}
        onSave={saveEdit}
        onCancel={cancel}
        onRetryInitiatives={retryInitiatives}
      />
    );
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
          start(target, "manual", source);
        }}
        onCoach={
          coachAvailable
            ? (target, source) => {
                setReviewing(false);
                start(
                  {
                    type: "objective",
                    section: "section" in target ? target.section : 0,
                  },
                  "guided",
                  source,
                );
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
      {loading ? (
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
              Review position focus
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
          {recordError && (
            <p role="alert">
              {recordError}{" "}
              <button onClick={() => void refreshRecord()}>Refresh</button>
            </p>
          )}
          <FocusObjectives
            key={"reader-" + focus.id}
            focus={focus}
            onEdit={(target) => start(target)}
            onCoach={
              coachAvailable ? (target) => start(target, "guided") : undefined
            }
          />
          {record?.checkpoint && focus.status === "draft" && (
            <details className="earlier-notes">
              <summary>Earlier working notes</summary>
              <p className="muted">Private notes from your earlier draft.</p>
              {[
                record.checkpoint.work,
                ...record.checkpoint.answers.flatMap((a) => [
                  a.question,
                  a.answer,
                ]),
                record.checkpoint.question,
                record.checkpoint.answer,
                record.checkpoint.objective,
                record.checkpoint.action,
                record.checkpoint.date,
                record.checkpoint.goal,
              ]
                .filter(Boolean)
                .map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              <button
                onClick={() => {
                  const c = record.checkpoint!;
                  start(
                    {
                      type: "objective",
                      section: focus.sections.length,
                      adding: true,
                    },
                    "manual",
                  );
                  change({
                    type: "objective-values",
                    values: {
                      text: c.objective,
                      kind: c.kind || "normal",
                      goals: c.goal.trim() ? [c.goal] : [],
                      alignment: {
                        other: !!c.other,
                        initiatives: c.initiatives
                          .filter((id) =>
                            direction?.initiatives.some(
                              (i) => i.id === id && !i.archived,
                            ),
                          )
                          .map((id) => ({ id })),
                      },
                    },
                  });
                }}
              >
                Copy to a new objective
              </button>
            </details>
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
                Start with a small draft, then talk it through with your career
                lead.
              </p>
              <p>
                The Guide explains the process and shows what a useful objective
                and SMART goals can look like.
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
      )}
      {edit && edit.type !== "metadata" && (
        <Dialog
          key={edit.key}
          title={
            edit.type === "goal"
              ? edit.adding
                ? "Add SMART goal"
                : "Edit SMART goal"
              : "Remove this " +
                (edit.type === "remove-goal"
                  ? "goal"
                  : "objective and its goals") +
                "?"
          }
          saveLabel={edit.type.startsWith("remove") ? "Remove" : "Save changes"}
          onClose={cancel}
          onSave={saveEdit}
        >
          {edit.type === "goal" ? (
            <div className="focus-writing manual-authoring">
              <div className="goal-parent">
                <ObjectiveType
                  kind={edit.source.sections[edit.section]!.kind}
                />
                <p>{edit.source.sections[edit.section]!.objective}</p>
              </div>
              <div className="field">
                <label htmlFor="edit-text">SMART goal</label>
                <textarea
                  id="edit-text"
                  name="text"
                  required
                  maxLength={10000}
                  autoFocus
                  value={edit.text}
                  onChange={(e) =>
                    change({ type: "text", text: e.target.value })
                  }
                />
              </div>
            </div>
          ) : (
            <>
              <p className="muted">Position focus: {edit.source.title}</p>
              <p>This removes the content from your saved position focus.</p>
            </>
          )}
        </Dialog>
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
