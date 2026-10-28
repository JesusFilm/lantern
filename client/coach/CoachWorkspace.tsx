import { useEffect, useRef, useState } from "react";
import type { CoachRecord } from "../../shared/coach.js";
import type { PositionFocus } from "../../shared/focus.js";
import type { SessionView } from "../../shared/access.js";
import type { EditTarget } from "../workspace/useDraftFocusWorkflow.js";
import { ObjectiveType } from "../workspace/ObjectiveType.js";
import { InitiativeIdentity } from "../workspace/InitiativeIdentity.js";
import { api } from "../workspace/api.js";
import { CoachingStages } from "./FocusAssistance.js";
import "./coach.css";
const base = "/api/coach";
function Diff({ before, after }: { before: string; after: string }) {
  const a = before.split(/(\s+)/),
    b = after.split(/(\s+)/);
  let first = 0,
    last = 0;
  while (first < a.length && first < b.length && a[first] === b[first]) first++;
  while (
    last < a.length - first &&
    last < b.length - first &&
    a[a.length - last - 1] === b[b.length - last - 1]
  )
    last++;
  return (
    <p>
      {b.slice(0, first).join("")}
      {a.length - first - last > 0 && (
        <del>{a.slice(first, a.length - last).join("")}</del>
      )}{" "}
      {b.length - first - last > 0 && (
        <ins>{b.slice(first, b.length - last).join("")}</ins>
      )}
      {last ? b.slice(b.length - last).join("") : ""}
    </p>
  );
}
function FocusText({
  focus,
  onEdit,
  onCoach,
}: {
  focus: PositionFocus;
  onEdit?: (target: EditTarget, source: PositionFocus) => void;
  onCoach?: (target: EditTarget, source: PositionFocus) => void;
}) {
  return (
    <section className="cp-document">
      <p className="cp-muted">
        {focus.start} – {focus.end}
      </p>
      {focus.sections.map((s, i) => (
        <div key={i}>
          <h2>Objective {i + 1}</h2>
          <ObjectiveType kind={s.kind} />
          <p>{s.objective}</p>
          {onEdit && (
            <button
              className="link"
              onClick={() => onEdit({ type: "objective", section: i }, focus)}
            >
              Edit objective
            </button>
          )}
          {onCoach && (
            <button
              className="link"
              onClick={() => onCoach({ type: "objective", section: i }, focus)}
            >
              Coach
            </button>
          )}
          {s.alignment?.other && (
            <p className="cp-muted">Other — none of these apply</p>
          )}
          <div className="cp-chips">
            {s.alignment?.initiatives.map((a) => (
              <InitiativeIdentity key={a.id} {...a} chip />
            ))}
          </div>
          {s.goals.map((g, j) => (
            <div key={j}>
              <h3>SMART goal {j + 1}</h3>
              <p>{g}</p>
              {onEdit && (
                <button
                  className="link"
                  onClick={() =>
                    onEdit({ type: "goal", section: i, goal: j }, focus)
                  }
                >
                  Edit goal
                </button>
              )}
              {onCoach && (
                <button
                  className="link"
                  onClick={() =>
                    onCoach({ type: "goal", section: i, goal: j }, focus)
                  }
                >
                  Coach
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
export function CoachWorkspace({
  session,
  lead = false,
  focusId,
  onBack,
  onEdit,
  onCoach,
}: {
  session: SessionView;
  lead?: boolean;
  focusId?: string;
  onBack?: () => void;
  onEdit?: (target: EditTarget, source: PositionFocus) => void;
  onCoach?: (target: EditTarget, source: PositionFocus) => void;
}) {
  const actor = session.user!.id;
  const [records, setRecords] = useState<CoachRecord[]>([]),
    [selected, setSelected] = useState(focusId || "");
  const [view, setView] = useState<"home" | "request" | "review">(
    focusId ? "request" : "home",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [note, setNote] = useState(""),
    [compose, setCompose] = useState(false);
  const [noteVersion, setNoteVersion] = useState<number>(),
    [confirmed, setConfirmed] = useState<number>();
  const revision = useRef(0),
    mounted = useRef(true);
  const record = records.find((r) => r.focus.id === selected),
    request = record?.requests.at(-1),
    locked = record?.focus.status === "confirmed";
  function put(r: CoachRecord) {
    if (!mounted.current) return;
    revision.current++;
    setRecords((old) => [r, ...old.filter((x) => x.focus.id !== r.focus.id)]);
  }
  async function refresh() {
    const n = ++revision.current;
    try {
      const r = focusId
        ? [await api<CoachRecord>(base + "/focuses/" + focusId)]
        : await api<CoachRecord[]>(base + "/focuses?view=lead");
      if (mounted.current && n === revision.current) setRecords(r);
    } catch (e) {
      if (mounted.current && n === revision.current)
        setError((e as Error).message);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const run = () => void refresh();
    window.addEventListener("focus", run);
    const timer = setInterval(run, 7000);
    return () => {
      mounted.current = false;
      revision.current++;
      clearInterval(timer);
      window.removeEventListener("focus", run);
    };
  }, [focusId]);
  useEffect(() => {
    const nav = (e: Event) => {
      if (note.trim() && !window.confirm("Leave without saving your note?"))
        e.preventDefault();
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (note.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("lantern-coach-leave", nav);
    window.addEventListener("beforeunload", unload);
    return () => {
      window.removeEventListener("lantern-coach-leave", nav);
      window.removeEventListener("beforeunload", unload);
    };
  }, [note]);
  function canLeaveNote() {
    return !note.trim() || window.confirm("Discard this unsaved note?");
  }
  function back() {
    if (canLeaveNote()) onBack?.();
  }
  async function review(r: CoachRecord) {
    if (!canLeaveNote()) return;
    setSelected(r.focus.id);
    setView("review");
    setCompose(false);
    setNote("");
    setConfirmed(undefined);
    setError("");
    try {
      put(
        await api<CoachRecord>(
          base + "/focuses/" + r.focus.id + "/read",
          "POST",
          { noteIds: r.notes.map((n) => n.id) },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function mutation(path: string, method: string, body?: unknown) {
    setBusy("Saving…");
    setError("");
    try {
      const r = await api<CoachRecord>(
        base + "/focuses/" + selected + path,
        method,
        body,
      );
      put(r);
      return r;
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy("");
    }
  }
  const notesPanel = record && (
    <section className="cp-notes">
      <div className="cp-row cp-between">
        <h2>Notes</h2>
        <button
          className="link"
          disabled={compose || !!busy}
          onClick={() => {
            setNoteVersion(request?.document.version);
            setCompose(true);
          }}
        >
          + Add note
        </button>
      </div>
      {record.notes.map((n) => (
        <article key={n.id}>
          <div className="cp-row cp-between">
            <span className="cp-muted">
              <strong>{n.authorName}</strong> ·{" "}
              {new Date(n.createdAt).toLocaleString("en-NZ")}
              {n.requestVersion !== request?.document.version && (
                <details>
                  <summary>Earlier draft · {n.requestVersion}</summary>
                  <FocusText
                    focus={
                      record.requests.find(
                        (r) => r.document.version === n.requestVersion,
                      )!.document
                    }
                  />
                </details>
              )}
            </span>
            {!n.deletedAt && n.authorId === actor && (
              <button
                className="link cp-delete"
                disabled={!!busy}
                onClick={() => void mutation("/notes/" + n.id, "DELETE")}
              >
                Delete note
              </button>
            )}
          </div>
          <p>{n.deletedAt ? <em>Note removed</em> : n.body}</p>
        </article>
      ))}
      {!record.notes.length && <p className="cp-muted">No notes yet.</p>}
      {compose && (
        <div className="cp-field">
          <label htmlFor="new-note">Add a note</label>
          <textarea
            id="new-note"
            value={note}
            disabled={!!busy}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cp-row cp-end">
            <button
              disabled={!!busy}
              onClick={() => {
                setCompose(false);
                setNote("");
              }}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={!note.trim() || !!busy}
              onClick={async () => {
                if (
                  await mutation("/notes", "POST", {
                    body: note,
                    version: noteVersion,
                  })
                ) {
                  setCompose(false);
                  setNote("");
                }
              }}
            >
              Add note
            </button>
          </div>
        </div>
      )}
    </section>
  );
  const old = record?.requests.at(-2)?.document;
  function comparison(before: PositionFocus, after: PositionFocus) {
    return (
      <section className="cp-changes">
        <h2>Changes since previous request</h2>
        {before.title !== after.title && (
          <>
            <h3>Title</h3>
            <Diff before={before.title} after={after.title} />
          </>
        )}
        {(before.start !== after.start || before.end !== after.end) && (
          <p>
            Focus period: {after.start} – {after.end}
          </p>
        )}
        {Array.from(
          { length: Math.max(before.sections.length, after.sections.length) },
          (_, index) => {
            const a = before.sections[index],
              b = after.sections[index];
            if (JSON.stringify(a) === JSON.stringify(b)) return null;
            return (
              <div key={index}>
                <h3>
                  Objective {index + 1}
                  {!a ? " · Added" : !b ? " · Removed" : ""}
                </h3>
                <Diff before={a?.objective || ""} after={b?.objective || ""} />
                {a?.kind !== b?.kind && <p>Type: {b?.kind || "Removed"}</p>}
                {JSON.stringify(a?.alignment) !==
                  JSON.stringify(b?.alignment) && (
                  <p>Initiative selection changed.</p>
                )}
                {Array.from(
                  {
                    length: Math.max(
                      a?.goals.length || 0,
                      b?.goals.length || 0,
                    ),
                  },
                  (_, j) =>
                    a?.goals[j] === b?.goals[j] ? null : (
                      <div key={j}>
                        <h3>Goal {j + 1}</h3>
                        <Diff
                          before={a?.goals[j] || ""}
                          after={b?.goals[j] || ""}
                        />
                      </div>
                    ),
                )}
              </div>
            );
          },
        )}
        <details>
          <summary>Previous request · Draft {before.version}</summary>
          <FocusText focus={before} />
        </details>
      </section>
    );
  }
  return (
    <div className="coach-workspace">
      {lead ? (
        <button
          className="link"
          onClick={() => {
            if (!canLeaveNote()) return;
            setNote("");
            setView("home");
            void refresh();
          }}
        >
          Review requests
        </button>
      ) : (
        <button className="link" onClick={back}>
          Back to authoring
        </button>
      )}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void refresh()}>Try again</button>
        </p>
      )}
      {busy && <p role="status">{busy}</p>}
      {view === "home" && (
        <>
          <h1>Review requests</h1>
          {records.map((r) => (
            <section className="cp-card" key={r.focus.id}>
              <h2>
                {r.memberName} · {r.focus.title}
              </h2>
              <p>
                {r.focus.status === "confirmed"
                  ? "Confirmed"
                  : "Review requested"}
                {r.notes.some(
                  (n) =>
                    n.authorId !== actor &&
                    !n.deletedAt &&
                    !r.readIds.includes(n.id),
                )
                  ? " · New notes"
                  : ""}
              </p>
              <button onClick={() => void review(r)}>Review focus</button>
            </section>
          ))}
          {!records.length && <p>No requests waiting.</p>}
        </>
      )}
      {!lead && view === "request" && <CoachingStages active={3} />}
      {view === "request" && record && (
        <>
          <h1>Review your whole focus</h1>
          <FocusText
            focus={record.focus}
            onEdit={
              !lead && !locked && onEdit
                ? (target, source) => {
                    if (canLeaveNote()) onEdit(target, source);
                  }
                : undefined
            }
            onCoach={
              !lead && !locked && onCoach
                ? (target, source) => {
                    if (canLeaveNote()) onCoach(target, source);
                  }
                : undefined
            }
          />
          {request && comparison(request.document, record.focus)}
          {!record.focus.sections.some(
            (s) => s.kind === "normal" && s.goals.length,
          ) && (
            <p>
              Add a Contribution objective with at least one SMART goal before
              requesting review.
            </p>
          )}
          {request && (
            <button className="link" onClick={() => void review(record)}>
              Review discussion
            </button>
          )}
          <label htmlFor="review-note">Note to career lead · optional</label>
          <textarea
            id="review-note"
            value={note}
            disabled={!!busy}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cp-nav">
            <button disabled={!!busy} onClick={back}>
              Back to draft
            </button>
            <button
              className="primary"
              disabled={
                !!busy ||
                locked ||
                request?.document.version === record.focus.version ||
                !record.focus.sections.some(
                  (s) => s.kind === "normal" && s.goals.length,
                )
              }
              onClick={async () => {
                const r = await mutation("/request", "POST", {
                  version: record.focus.version,
                  note,
                });
                if (r) {
                  setNote("");
                  setView("review");
                }
              }}
            >
              {request?.document.version === record.focus.version
                ? "Review requested"
                : request
                  ? "Send changes for review"
                  : "Send request"}
            </button>
          </div>
        </>
      )}
      {view === "review" && record && request && (
        <>
          <h1>{lead ? record.memberName + "’s focus" : record.focus.title}</h1>
          <div className="cp-row cp-between">
            <span className="cp-muted">
              {record.focus.status === "confirmed"
                ? "Confirmed"
                : "Review requested"}{" "}
              · Draft {request.document.version}
            </span>
            {!lead && (
              <button onClick={back}>
                {locked ? "View focus" : "Edit draft"}
              </button>
            )}
          </div>
          {lead && (
            <>
              {record.focus.version !== request.document.version && !locked && (
                <details className="cp-warning">
                  <summary>Newer saved changes have not been sent</summary>
                  <FocusText focus={record.focus} />
                </details>
              )}
              {old && comparison(old, request.document)}
              <FocusText focus={request.document} />
              {!locked && (
                <div className="cp-confirm">
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed === request.document.version}
                      onChange={(e) =>
                        setConfirmed(
                          e.target.checked
                            ? request.document.version
                            : undefined,
                        )
                      }
                    />
                    We have discussed and agreed this focus.
                  </label>
                  <button
                    className="primary"
                    disabled={
                      confirmed !== request.document.version ||
                      !!busy ||
                      record.focus.version !== request.document.version ||
                      !record.focus.sections.some(
                        (s) => s.objective.trim() && s.goals.length,
                      )
                    }
                    onClick={() =>
                      void mutation("/confirm", "POST", {
                        version: request.document.version,
                      })
                    }
                  >
                    Confirm focus
                  </button>
                </div>
              )}
            </>
          )}
          {!lead && <FocusText focus={request.document} />}
          {notesPanel}
        </>
      )}
    </div>
  );
}
