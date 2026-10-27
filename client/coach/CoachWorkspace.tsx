// Member coaching and career-lead review use separate navigation destinations.
import { useEffect, useRef, useState } from "react";
import type {
  CoachCheckpoint,
  CoachRecord,
  CoachSuggestion,
} from "../../shared/coach.js";
import type { SessionView } from "../../shared/access.js";
import type {
  DepartmentDirection,
  StrategicInitiative,
} from "../../shared/direction.js";
import type { PositionFocus } from "../../shared/focus.js";
import { api } from "../workspace/api.js";
import { InitiativeIdentity } from "../workspace/InitiativeIdentity.js";
import "./coach.css";
import { CoachPreparing, type CoachStage } from "./CoachPreparing.js";

type Checkpoint = CoachCheckpoint & {
  answer?: string;
  other?: boolean;
  sourceVersion?: number;
};
const base = "/api/coach";
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function newCheckpoint(): Checkpoint {
  const start = today(),
    end = new Date(start + "T12:00:00Z");
  end.setUTCMonth(end.getUTCMonth() + 6);
  return {
    step: 0,
    work: "",
    answers: [],
    question: "",
    options: [],
    objective: "",
    initiatives: [],
    actions: [],
    action: "",
    date: "",
    goal: "",
    title: "My position focus",
    start,
    end: end.toISOString().slice(0, 10),
    concern: "",
    sectionIndex: 0,
    goalIndex: 0,
  };
}
function dateLabel(value: string) {
  return value
    ? new Intl.DateTimeFormat("en-NZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value + "T12:00:00Z"))
    : "a date to agree";
}
function fromRecord(r: CoachRecord): Checkpoint {
  const p = r.checkpoint as Checkpoint | null;
  if (p && p.sourceVersion === r.focus.version) return p;
  const section = r.focus.sections[0];
  return {
    ...newCheckpoint(),
    step: 7,
    title: r.focus.title,
    start: r.focus.start,
    end: r.focus.end,
    objective: section?.objective || "",
    goal: section?.goals[0] || "",
    initiatives: section?.alignment?.initiatives.map((i) => i.id) || [],
    other: section?.alignment?.other,
  };
}
function fingerprint(c: Checkpoint) {
  return JSON.stringify([
    c.step,
    c.question,
    c.options,
    c.actions,
    c.concern,
    c.sectionIndex,
    c.goalIndex,
    c.work,
    c.answers,
    c.answer,
    c.objective,
    c.initiatives,
    c.other,
    c.action,
    c.date,
    c.goal,
    c.title,
    c.start,
    c.end,
  ]);
}
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
function FocusText({ focus }: { focus: PositionFocus }) {
  return (
    <section className="cp-document">
      {focus.sections.map((s, i) => (
        <div key={i}>
          <h2>Objective</h2>
          <p>{s.objective}</p>
          <div className="cp-chips">
            {s.alignment?.initiatives.map((a) => (
              <InitiativeIdentity key={a.id} {...a} chip />
            ))}
          </div>
          {s.goals.map((g, j) => (
            <div key={j}>
              <h2>Goal</h2>
              <p>{g}</p>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
function Info({
  initiative,
  onClose,
}: {
  initiative: StrategicInitiative;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="cp-info"
      style={{ borderTopColor: initiative.appearance?.color }}
      onCancel={onClose}
    >
      <h2>
        <InitiativeIdentity {...initiative} />
      </h2>
      <p>{initiative.description || "No description has been added."}</p>
      <button onClick={onClose}>Done</button>
    </dialog>
  );
}
export function CoachWorkspace({
  session,
  lead = false,
}: {
  session: SessionView;
  lead?: boolean;
}) {
  const actor = session.user!.id;
  const [records, setRecords] = useState<CoachRecord[]>([]),
    [direction, setDirection] = useState<DepartmentDirection>();
  const [view, setView] = useState<"home" | "edit" | "review" | "request">(
      "home",
    ),
    [selected, setSelected] = useState("");
  const [c, setC] = useState<Checkpoint>(newCheckpoint),
    [savedPrint, setSavedPrint] = useState(""),
    [version, setVersion] = useState<number>();
  const [trail, setTrail] = useState<Checkpoint[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [note, setNote] = useState(""),
    [compose, setCompose] = useState(false),
    [info, setInfo] = useState<StrategicInitiative>(),
    [confirmed, setConfirmed] = useState<number>();
  const [noteVersion, setNoteVersion] = useState<number>();
  const readRevision = useRef(0),
    mounted = useRef(true);
  const source = useRef<PositionFocus | undefined>(undefined);
  const epoch = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const [preparing, setPreparing] = useState<CoachStage | null>(null);
  const dirty =
    view === "edit" &&
    fingerprint(c) !== savedPrint &&
    (!!savedPrint || !!c.work || !!c.objective || !!c.goal);
  const record = records.find((r) => r.focus.id === selected),
    request = record?.requests.at(-1);
  const locked = record?.focus.status === "confirmed";
  function update(patch: Partial<Checkpoint>) {
    setC((old) => ({ ...old, ...patch }));
  }
  function put(r: CoachRecord) {
    if (!mounted.current) return;
    readRevision.current++;
    setRecords((old) => [r, ...old.filter((x) => x.focus.id !== r.focus.id)]);
  }
  async function refresh() {
    const revision = ++readRevision.current;
    try {
      const [r, d] = await Promise.all([
        api<CoachRecord[]>(base + "/focuses" + (lead ? "?view=lead" : "")),
        api<DepartmentDirection>("/api/department/direction"),
      ]);
      if (!mounted.current || revision !== readRevision.current) return;
      setRecords(r);
      setDirection(d);
    } catch (e) {
      if (mounted.current && revision === readRevision.current)
        setError((e as Error).message);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
      readRevision.current++;
      epoch.current++;
      requestController.current?.abort();
    };
  }, []);
  useEffect(() => {
    const run = () => {
      if (view === "home" || view === "review") void refresh();
    };
    window.addEventListener("focus", run);
    const interval = setInterval(run, 7000);
    return () => {
      window.removeEventListener("focus", run);
      clearInterval(interval);
    };
  }, [view]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty || note.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const nav = (e: Event) => {
      if (
        (dirty || note.trim()) &&
        !window.confirm("Leave without saving your changes?")
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    window.addEventListener("lantern-coach-leave", nav);
    return () => {
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("lantern-coach-leave", nav);
    };
  }, [dirty, note]);
  function home() {
    if (
      (dirty || note.trim()) &&
      !window.confirm("Leave without saving your changes?")
    )
      return;
    epoch.current++;
    setView("home");
    setError("");
    setNote("");
    setBusy("");
    void refresh();
  }
  function edit(r?: CoachRecord) {
    const next = r
      ? fromRecord(r)
      : { ...newCheckpoint(), step: session.coachAvailable ? 0 : 7 };
    source.current = r?.focus;
    setC(next);
    setSelected(r?.focus.id || "");
    setVersion(r?.focus.version);
    setSavedPrint(r ? fingerprint(next) : "");
    setTrail([]);
    setNote("");
    setCompose(false);
    setError("");
    setView("edit");
  }
  async function review(r: CoachRecord) {
    if (
      (dirty || note.trim()) &&
      !window.confirm("Leave without saving your changes?")
    )
      return;
    setSelected(r.focus.id);
    setView("review");
    setNote("");
    setCompose(false);
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
  function go(step: number, next: Checkpoint = c) {
    setTrail((old) => [...old, c]);
    setC({ ...next, step });
    setError("");
    window.scrollTo(0, 0);
  }
  function back() {
    const previous = trail.at(-1);
    if (previous) {
      setC({
        ...c,
        step: previous.step,
        ...(previous.step < 2
          ? {
              answers: previous.answers,
              question: previous.question,
              options: previous.options,
              answer: previous.answer,
            }
          : {}),
      });
      setTrail((old) => old.slice(0, -1));
    } else update({ step: Math.max(0, c.step - 1) });
    setError("");
  }
  function stopWaiting() {
    epoch.current++;
    requestController.current?.abort();
    requestController.current = null;
    setPreparing(null);
    setBusy("");
  }
  async function suggest(
    stage: CoachStage,
    context: Checkpoint,
  ): Promise<CoachSuggestion | undefined> {
    const n = ++epoch.current;
    const controller = new AbortController();
    requestController.current = controller;
    setPreparing(stage);
    setBusy("Preparing…");
    setError("");
    try {
      const result = await api<CoachSuggestion>(
        base + "/suggest",
        "POST",
        {
          stage,
          context,
          focusId: selected || undefined,
          version,
        },
        controller.signal,
      );
      if (n === epoch.current) return result;
    } catch (e) {
      if (n === epoch.current) setError((e as Error).message);
    } finally {
      if (n === epoch.current) {
        setBusy("");
        setPreparing(null);
        requestController.current = null;
      }
    }
  }
  async function objective(context = c) {
    const r = await suggest("objective", context);
    if (r)
      go(2, {
        ...context,
        objective: r.objective || "",
        title: r.title || c.title,
        initiatives: r.initiativeIds || [],
        concern: r.concern || "",
      });
  }
  async function next() {
    if (c.step === 0 || c.step === 1) {
      const ctx =
        c.step === 0
          ? { ...c, answers: [] }
          : {
              ...c,
              answers: [
                ...c.answers,
                { question: c.question, answer: c.answer || "" },
              ],
            };
      const stage = ctx.answers.length >= 3 ? "objective" : "clarify";
      const r = await suggest(stage, ctx);
      if (!r) return;
      if (r.objective && (r.ready !== false || stage === "objective"))
        go(2, {
          ...ctx,
          objective: r.objective,
          title: r.title || c.title,
          initiatives: r.initiativeIds || [],
          concern: r.concern || "",
        });
      else
        go(1, {
          ...ctx,
          question:
            r.question || "Who benefits, and what becomes easier for them?",
          options: r.options || [],
          answer: "",
        });
      return;
    }
    if (c.step === 2) {
      go(3);
      return;
    }
    if (c.step === 3) {
      const r = await suggest("actions", c);
      if (r)
        go(4, {
          ...c,
          actions: r.actions || [],
          date:
            c.date ||
            (/^\d{4}-\d{2}-\d{2}$/.test(r.suggestedDate || "")
              ? r.suggestedDate!
              : c.end),
          concern: r.concern || "",
        });
      return;
    }
    if (c.step === 4) {
      go(5);
      return;
    }
    if (c.step === 5) {
      if (c.goal) {
        go(6);
        return;
      }
      const r = await suggest("goal", c);
      if (r) go(6, { ...c, goal: r.goal || "", concern: r.concern || "" });
      return;
    }
    go(7);
  }
  function changeDate(date: string) {
    let goal = c.goal;
    const prefix = "By " + dateLabel(c.date) + ",";
    if (goal.startsWith(prefix))
      goal = "By " + dateLabel(date) + "," + goal.slice(prefix.length);
    update({
      date,
      goal,
      concern:
        goal && !goal.startsWith("By " + dateLabel(date) + ",")
          ? "Check that the date in your goal still matches."
          : c.concern,
    });
  }
  function mergedSections() {
    const sections: import("../../shared/focus.js").FocusDraftSection[] =
      structuredClone(source.current?.sections || []);
    if (!c.objective.trim()) {
      const existing = sections[c.sectionIndex ?? 0];
      if (existing)
        sections[c.sectionIndex ?? 0] = { ...existing, objective: c.objective };
      return sections;
    }
    const index = c.sectionIndex ?? 0,
      goalIndex = c.goalIndex ?? 0,
      previous = sections[index];
    const goals = [...(previous?.goals || [])];
    if (c.goal.trim()) goals[goalIndex] = c.goal;
    else if (goalIndex < goals.length) goals.splice(goalIndex, 1);
    sections[index] = {
      kind: previous?.kind || "normal",
      objective: c.objective,
      goals,
      alignment: {
        initiatives: c.initiatives.map((id) => ({ id })),
        other: !!c.other,
      },
    };
    return sections;
  }
  function selectTarget(sectionIndex: number, goalIndex = 0) {
    if (dirty && !window.confirm("Discard unsaved changes to this objective?"))
      return;
    const section = source.current?.sections[sectionIndex];
    const next = {
      ...newCheckpoint(),
      step: section ? 7 : 0,
      title: source.current!.title,
      start: source.current!.start,
      end: source.current!.end,
      sectionIndex,
      goalIndex,
      objective: section?.objective || "",
      goal: section?.goals[goalIndex] || "",
      initiatives: section?.alignment?.initiatives.map((i) => i.id) || [],
      other: section?.alignment?.other,
    };
    setC(next);
    setSavedPrint(fingerprint(next));
    setTrail([]);
  }
  async function save() {
    setBusy("Saving…");
    setError("");
    try {
      const r = await api<CoachRecord>(base + "/save", "POST", {
        id: selected || undefined,
        version,
        draft: {
          title: c.title.trim(),
          start: c.start,
          end: c.end,
          sections: mergedSections(),
        },
        checkpoint: c,
      });
      put(r);
      source.current = r.focus;
      setSelected(r.focus.id);
      setVersion(r.focus.version);
      setSavedPrint(fingerprint(c));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
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
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const initiativeChoices = (
    <div className="cp-choices">
      {direction?.initiatives
        .filter((i) => !i.archived || c.initiatives.includes(i.id))
        .map((i) => (
          <div className="cp-initiative" key={i.id}>
            <label>
              <input
                type="checkbox"
                checked={c.initiatives.includes(i.id)}
                disabled={locked}
                onChange={(e) =>
                  update({
                    other: false,
                    initiatives: e.target.checked
                      ? [...c.initiatives, i.id]
                      : c.initiatives.filter((id) => id !== i.id),
                  })
                }
              />
              <InitiativeIdentity {...i} />
            </label>
            <button
              type="button"
              className="link"
              aria-label={"About " + i.name}
              onClick={() => setInfo(i)}
            >
              ⓘ
            </button>
          </div>
        ))}
      <label className="cp-choice">
        <input
          type="checkbox"
          checked={!!c.other}
          onChange={(e) => update({ other: e.target.checked, initiatives: [] })}
        />
        Other — none of these apply
      </label>
    </div>
  );
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
      <div className="cp-top">
        <button className="link" disabled={!!busy} onClick={home}>
          {lead ? "Review requests" : "Position focuses"}
        </button>
        <span className="cp-muted">
          {session.user!.name} · {lead ? "Career lead" : "Member"}
        </span>
      </div>
      {error && (
        <div className="cp-error" role="alert">
          {error}
        </div>
      )}
      {busy && !preparing && (
        <p className="cp-busy" role="status">
          {busy}
        </p>
      )}
      {view === "home" && (
        <>
          <div className="cp-row cp-between">
            <h1>{lead ? "Review requests" : "Position focuses"}</h1>
            {!lead && (
              <button className="primary" onClick={() => edit()}>
                Create a focus
              </button>
            )}
          </div>
          {records
            .filter((r) => !lead || r.requests.length)
            .map((r) => {
              const unread = r.notes.filter(
                (n) =>
                  n.authorId !== actor &&
                  !n.deletedAt &&
                  !r.readIds.includes(n.id),
              ).length;
              return (
                <section key={r.focus.id} className="cp-card">
                  <div className="cp-row cp-between">
                    <span className="cp-badge">
                      {r.focus.status === "confirmed"
                        ? "Confirmed"
                        : !r.requests.length
                          ? "Draft"
                          : r.requests.at(-1)!.document.version !==
                              r.focus.version
                            ? "Changes not sent"
                            : r.requests.length > 1
                              ? "Revised"
                              : "Review requested"}
                    </span>
                    {unread > 0 && (
                      <span className="cp-badge">
                        {unread} new {unread === 1 ? "note" : "notes"}
                      </span>
                    )}
                  </div>
                  <h2>
                    {lead ? r.memberName + " · " : ""}
                    {r.focus.title}
                  </h2>
                  <p>{r.focus.sections[0]?.objective}</p>
                  <div className="cp-row">
                    {r.requests.length > 0 && (
                      <button
                        className="primary"
                        onClick={() => void review(r)}
                      >
                        {lead
                          ? "Review focus"
                          : unread
                            ? "Read reply"
                            : "Review notes"}
                      </button>
                    )}
                    {!lead && (
                      <button onClick={() => edit(r)}>
                        {r.focus.status === "confirmed"
                          ? "View focus"
                          : "Continue draft"}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          {!records.filter((r) => !lead || r.requests.length).length && (
            <p className="cp-muted">
              {lead
                ? "No requests waiting."
                : "Start with a project you’re working on."}
            </p>
          )}
        </>
      )}
      <CoachPreparing stage={preparing} onBack={stopWaiting} />
      {view === "edit" && locked && record && (
        <>
          <h1>Confirmed focus</h1>
          <FocusText focus={record.focus} />
          {request && (
            <button onClick={() => void review(record)}>Review notes</button>
          )}
        </>
      )}
      {view === "edit" && !locked && (
        <>
          <div className="cp-row cp-between cp-editor-top">
            <span className="cp-muted">
              {c.step < 2
                ? "Your contribution"
                : c.step < 4
                  ? "Your objective"
                  : "Your goal"}
            </span>
            <button className="link" disabled={!!busy} onClick={() => go(7)}>
              Review draft
            </button>
          </div>
          {record && !locked && c.step === 7 && (
            <div className="cp-targets">
              <label htmlFor="coach-objective-target">
                Objective to work on
              </label>
              <select
                id="coach-objective-target"
                disabled={!!busy}
                value={c.sectionIndex ?? 0}
                onChange={(e) => selectTarget(Number(e.target.value))}
              >
                {source.current?.sections.map((section, index) => (
                  <option key={index} value={index}>
                    {index + 1}. {section.objective.slice(0, 80)}
                  </option>
                ))}
                <option value={source.current?.sections.length ?? 0}>
                  New objective
                </option>
              </select>
              {!!source.current?.sections[c.sectionIndex ?? 0] && (
                <>
                  <label htmlFor="coach-goal-target">Goal to work on</label>
                  <select
                    id="coach-goal-target"
                    disabled={!!busy}
                    value={c.goalIndex ?? 0}
                    onChange={(e) =>
                      selectTarget(c.sectionIndex ?? 0, Number(e.target.value))
                    }
                  >
                    {source.current.sections[c.sectionIndex ?? 0]!.goals.map(
                      (goal, index) => (
                        <option key={index} value={index}>
                          {index + 1}. {goal.slice(0, 80)}
                        </option>
                      ),
                    )}
                    <option
                      value={
                        source.current.sections[c.sectionIndex ?? 0]!.goals
                          .length
                      }
                    >
                      New goal
                    </option>
                  </select>
                </>
              )}
              {session.coachAvailable && (
                <button
                  className="link"
                  disabled={!!busy}
                  onClick={() => go(0)}
                >
                  Explore this contribution
                </button>
              )}
            </div>
          )}
          <fieldset
            tabIndex={-1}
            disabled={!!busy || locked}
            className="cp-fields"
          >
            {c.step === 0 && (
              <>
                <h1>What are you working on?</h1>
                <label className="cp-sr" htmlFor="work">
                  Your project work
                </label>
                <textarea
                  id="work"
                  value={c.work}
                  onChange={(e) => update({ work: e.target.value })}
                  placeholder="Describe a project or piece of work you know well."
                />
              </>
            )}
            {c.step === 1 && (
              <>
                <h1>{c.question}</h1>
                <div className="cp-choices">
                  {c.options.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={
                        "cp-option " + (c.answer === option ? "selected" : "")
                      }
                      onClick={() => update({ answer: option })}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <label htmlFor="answer">Your answer</label>
                <textarea
                  id="answer"
                  value={c.answer || ""}
                  onChange={(e) => update({ answer: e.target.value })}
                />
                <button className="link" onClick={() => void objective()}>
                  Draft with what we have
                </button>
              </>
            )}
            {c.step === 2 && (
              <>
                <h1>Does this capture your contribution?</h1>
                <label className="cp-sr" htmlFor="objective">
                  Objective
                </label>
                <textarea
                  id="objective"
                  value={c.objective}
                  onChange={(e) => update({ objective: e.target.value })}
                />
              </>
            )}
            {c.step === 3 && (
              <>
                <h1>Which initiatives does it support?</h1>
                {initiativeChoices}
              </>
            )}
            {c.step === 4 && (
              <>
                <h1>What could you do next?</h1>
                <div className="cp-choices">
                  {c.actions.map((action) => (
                    <label key={action} className="cp-choice">
                      <input
                        type="radio"
                        name="action"
                        checked={c.action === action}
                        onChange={() => update({ action, goal: "" })}
                      />
                      {action}
                    </label>
                  ))}
                </div>
                <label htmlFor="action">Or describe your own action</label>
                <textarea
                  id="action"
                  value={c.actions.includes(c.action) ? "" : c.action}
                  onChange={(e) => update({ action: e.target.value, goal: "" })}
                />
              </>
            )}
            {c.step === 5 && (
              <>
                <h1>When could you do that?</h1>
                <p>{c.action}</p>
                <label htmlFor="target-date">Aim for</label>
                <input
                  id="target-date"
                  className="cp-date"
                  type="date"
                  value={c.date}
                  onChange={(e) => changeDate(e.target.value)}
                />
              </>
            )}
            {c.step === 6 && (
              <>
                <h1>Does this feel achievable?</h1>
                {c.concern && <p className="cp-muted">{c.concern}</p>}
                <label className="cp-sr" htmlFor="goal">
                  Goal
                </label>
                <textarea
                  id="goal"
                  value={c.goal}
                  onChange={(e) => update({ goal: e.target.value })}
                />
              </>
            )}
            {c.step === 7 && (
              <>
                <h1>{locked ? "Confirmed focus" : "Review your draft"}</h1>
                <div className="cp-document">
                  <label htmlFor="title">Title</label>
                  <input
                    id="title"
                    value={c.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                  <label htmlFor="objective">Objective</label>
                  <textarea
                    id="objective"
                    value={c.objective}
                    onChange={(e) => update({ objective: e.target.value })}
                  />
                  <details>
                    <summary>Initiatives</summary>
                    {initiativeChoices}
                  </details>
                  <div className="cp-chips">
                    {direction?.initiatives
                      .filter((i) => c.initiatives.includes(i.id))
                      .map((i) => (
                        <InitiativeIdentity key={i.id} {...i} chip />
                      ))}
                  </div>
                  <label htmlFor="goal">Goal</label>
                  <textarea
                    id="goal"
                    value={c.goal}
                    onChange={(e) => update({ goal: e.target.value })}
                  />
                  <details>
                    <summary>Focus period</summary>
                    <div className="cp-row">
                      <label>
                        From
                        <input
                          type="date"
                          value={c.start}
                          onChange={(e) => update({ start: e.target.value })}
                        />
                      </label>
                      <label>
                        To
                        <input
                          type="date"
                          value={c.end}
                          onChange={(e) => update({ end: e.target.value })}
                        />
                      </label>
                    </div>
                  </details>
                </div>
              </>
            )}
          </fieldset>
          <div className="cp-nav">
            <button disabled={!!busy || locked || c.step === 0} onClick={back}>
              Back
            </button>
            <div className="cp-row">
              {c.step < 7 ? (
                <>
                  <button
                    disabled={!!busy || locked || !dirty}
                    onClick={() => void save()}
                  >
                    {!dirty && selected ? "Saved" : "Save draft"}
                  </button>
                  <button
                    className="primary"
                    disabled={
                      !!busy ||
                      locked ||
                      (c.step === 0 && !c.work.trim()) ||
                      (c.step === 1 && !c.answer?.trim()) ||
                      (c.step === 4 && !c.action.trim()) ||
                      (c.step === 5 && !c.date)
                    }
                    onClick={() => void next()}
                  >
                    {c.step === 6 ? "Review draft" : "Next"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary"
                    disabled={
                      !!busy ||
                      locked ||
                      !dirty ||
                      (!c.objective.trim() && !!c.goal.trim())
                    }
                    onClick={() => void save()}
                  >
                    {!dirty && selected ? "Saved" : "Save draft"}
                  </button>
                  <button
                    disabled={
                      !!busy ||
                      locked ||
                      dirty ||
                      !selected ||
                      !record?.focus.sections.some(
                        (s) => s.kind === "normal" && s.goals.length > 0,
                      )
                    }
                    onClick={() => {
                      if (
                        record &&
                        record.requests.at(-1)?.document.version === version
                      )
                        void review(record);
                      else {
                        setNote("");
                        setView("request");
                      }
                    }}
                  >
                    {record?.requests.at(-1)?.document.version === version
                      ? "Review requested"
                      : record?.requests.length
                        ? "Send changes for review"
                        : "Ask career lead to review"}
                  </button>
                </>
              )}
            </div>
          </div>
          {record?.requests.length && c.step === 7 ? (
            <button className="link" onClick={() => void review(record)}>
              Review notes
            </button>
          ) : null}
          {error && (
            <button className="link" disabled={!!busy} onClick={() => go(7)}>
              Continue manually
            </button>
          )}
        </>
      )}
      {view === "request" && record && (
        <>
          <h1>
            {request
              ? "Send changes for review"
              : "Ask your career lead to review"}
          </h1>
          <FocusText focus={record.focus} />
          {request && comparison(request.document, record.focus)}
          <label htmlFor="review-note">Note to career lead · optional</label>
          <textarea
            id="review-note"
            value={note}
            disabled={!!busy}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="cp-nav">
            <button disabled={!!busy} onClick={() => setView("edit")}>
              Back to draft
            </button>
            <button
              className="primary"
              disabled={!!busy}
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
              {request ? "Send changes for review" : "Send request"}
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
              <button onClick={() => edit(record)}>
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
          {notesPanel}
          {!lead && (
            <details>
              <summary>Focus sent for review</summary>
              <FocusText focus={request.document} />
            </details>
          )}
        </>
      )}
      {info && <Info initiative={info} onClose={() => setInfo(undefined)} />}
    </div>
  );
}
