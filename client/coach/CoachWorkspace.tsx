import { useEffect, useRef, useState } from "react";
import type { CoachRecord } from "../../shared/coach.js";
import type { PositionFocus } from "../../shared/focus.js";
import type { SessionView } from "../../shared/access.js";
import { objectiveTypes } from "../workspace/ObjectiveType.js";
import { FocusDocument } from "../workspace/FocusDocument.js";
import { formatFocusDate } from "../workspace/focusDate.js";
import { api } from "../workspace/api.js";
import { StatusBadge } from "./StatusBadge.js";
import "./coach.css";
import "./status-badge.css";
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
export function CoachWorkspace({
  session,
  lead = false,
  focusId,
  onChanged,
  displayedVersion,
  confirmedView = false,
}: {
  session: SessionView;
  lead?: boolean;
  focusId?: string;
  onChanged?: () => void;
  displayedVersion?: number;
  confirmedView?: boolean;
}) {
  const actor = session.user!.id;
  const [records, setRecords] = useState<CoachRecord[]>([]),
    [selected, setSelected] = useState(focusId || "");
  const [view, setView] = useState<"home" | "request" | "review">(
    confirmedView ? "review" : focusId ? "request" : "home",
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [note, setNote] = useState(""),
    [compose, setCompose] = useState(false);
  const [noteVersion, setNoteVersion] = useState<number>(),
    [confirmed, setConfirmed] = useState<number>();
  const [readRetry, setReadRetry] = useState(0);
  const revision = useRef(0),
    mounted = useRef(true);
  const changed = useRef(onChanged);
  useEffect(() => { changed.current = onChanged; }, [onChanged]);
  const record = records.find((r) => r.focus.id === selected),
    request = record?.requests.at(-1),
    locked = record?.focus.status === "confirmed";
  const displayedFocus = view === "review" && request ? record?.focus.id : undefined;
  const unreadIds = JSON.stringify(displayedFocus
    ? record!.notes.filter(n => !record!.readIds.includes(n.id)).map(n => n.id)
    : []);
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
    const noteIds = JSON.parse(unreadIds) as string[];
    if (!displayedFocus || !noteIds.length) return;
    const controller = new AbortController();
    let active = true;
    void api<CoachRecord>(base + "/focuses/" + displayedFocus + "/read", "POST", { noteIds }, controller.signal)
      .then(r => {
        if (!active || !mounted.current) return;
        // A read response may predate a poll or mutation. Retain the displayed
        // record and merge only the acknowledgements for the notes we showed.
        const acknowledged = noteIds.filter(id => r.readIds.includes(id));
        revision.current++;
        setRecords(old => old.map(current => current.focus.id === displayedFocus
          ? { ...current, readIds: [...new Set([...current.readIds, ...acknowledged])] }
          : current));
        changed.current?.();
      })
      .catch(e => { if (active && mounted.current) setError((e as Error).message); });
    return () => { active = false; controller.abort(); };
  }, [displayedFocus, unreadIds, actor, readRetry]);
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
  function review(r: CoachRecord) {
    if (!canLeaveNote()) return;
    setSelected(r.focus.id);
    setView("review");
    setCompose(false);
    setNote("");
    setConfirmed(undefined);
    setError("");
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
      onChanged?.();
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
        {!locked && <button
          className="link"
          disabled={compose || !!busy}
          onClick={() => {
            setNoteVersion(request?.document.version);
            setCompose(true);
          }}
        >
          + Add note
        </button>}
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
                  <FocusDocument
                    focus={
                      record.requests.find(
                        (r) => r.document.version === n.requestVersion,
                      )!.document
                    }
                  />
                </details>
              )}
            </span>
            {!locked && !n.deletedAt && n.authorId === actor && (
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
      {compose && (!locked || note.trim()) && (
        <div className="cp-field">
          <label htmlFor="new-note">Add a note</label>
          {locked && <p role="status">This focus was confirmed. Your unsent note cannot be sent; you can copy it before closing.</p>}
          <textarea
            id="new-note"
            value={note}
            disabled={!!busy}
            readOnly={!!locked}
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
            {!locked && <button
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
            </button>}
          </div>
        </div>
      )}
    </section>
  );
  const old = record?.requests.at(-2)?.document;
  function comparison(before: PositionFocus, after: PositionFocus) {
    if (
      before.title === after.title &&
      before.start === after.start &&
      before.end === after.end &&
      JSON.stringify(before.sections) === JSON.stringify(after.sections)
    )
      return null;
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
            Focus period: {formatFocusDate(after.start)} –{" "}
            {formatFocusDate(after.end)}
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
                {a?.kind !== b?.kind && (
                  <p>Type: {b ? objectiveTypes[b.kind].label : "Removed"}</p>
                )}
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
          <FocusDocument focus={before} />
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
      ) : null}
      {error && (
        <p role="alert">
          {error} <button onClick={() => { setError(""); setReadRetry(n => n + 1); void refresh(); }}>Try again</button>
        </p>
      )}
      {busy && <p role="status">{busy}</p>}
      {view === "home" && (
        <>
          <h1>Review requests</h1>
          {records.map((r) => (
            <section className="cp-card" key={r.focus.id}>
              <h2>
                {r.memberName} · {r.requests.at(-1)?.document.title ?? r.focus.title}
              </h2>
              <div className="cp-row">
                <StatusBadge status={r.focus.status === "confirmed" ? "confirmed" : "review-requested"} />
                {r.focus.status !== "confirmed" && r.requests.at(-1)?.document.version !== r.focus.version && <StatusBadge status="unsent-changes" />}
                {r.notes.some(
                  (n) =>
                    n.authorId !== actor &&
                    !n.deletedAt &&
                    !r.readIds.includes(n.id),
                ) && <StatusBadge status="new-notes" />}
              </div>
              <button onClick={() => void review(r)}>Review focus</button>
            </section>
          ))}
          {!records.length && <p>No requests waiting.</p>}
        </>
      )}
      {view === "request" && record && (
        <section className="cp-request" aria-labelledby="request-review-title">
          <h2 id="request-review-title">Request review</h2>
          {request && comparison(request.document, record.focus)}
          {displayedVersion !== undefined && displayedVersion !== record.focus.version && <p role="alert">This focus has changed. Return to the focus and reload before requesting review.</p>}
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
          <div className="cp-nav cp-request-actions">
            <button
              className="primary"
              disabled={
                !!busy ||
                locked ||
                (displayedVersion !== undefined && displayedVersion !== record.focus.version) ||
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
        </section>
      )}
      {view === "review" && record && request && (
        <>
          {lead ? <h1>{request.document.title}</h1> : !confirmedView && <h2>Review discussion</h2>}
          {lead && (
            <p className="muted">{record.memberName}’s position focus</p>
          )}
          <div className="cp-row cp-between">
            {lead ? <div className="cp-row"><StatusBadge status={locked ? "confirmed" : "review-requested"} />{!locked && record.focus.version !== request.document.version && <StatusBadge status="unsent-changes" />}{record.notes.some(n => n.authorId !== actor && !n.deletedAt && !record.readIds.includes(n.id)) && <StatusBadge status="new-notes" />}<span className="cp-muted">{locked ? "Requested version " + request.document.version : "Draft " + request.document.version}</span></div> : !locked && <span className="cp-muted">{"Review requested · Draft " + request.document.version}</span>}
          </div>
          {lead && (
            <>
              {record.focus.version !== request.document.version && !locked && (
                <details className="cp-warning">
                  <summary>Newer saved changes have not been sent</summary>
                  <FocusDocument focus={record.focus} />
                </details>
              )}
              {old && comparison(old, request.document)}
              <FocusDocument focus={request.document} />
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
          {notesPanel}
        </>
      )}
    </div>
  );
}
