import { useEffect, useRef, useState } from "react";
import type { CoachCheckpoint, CoachSuggestion } from "../../shared/coach.js";
import type { AuthoringEdit } from "../workspace/useDraftFocusWorkflow.js";
import {
  ObjectiveType,
  ObjectiveTypeChoices,
} from "../workspace/ObjectiveType.js";
import { InitiativeChoices } from "../workspace/InitiativeChoices.js";
import { api } from "../workspace/api.js";
import { CoachPreparing, type CoachStage } from "./CoachPreparing.js";
import "./coach.css";

export function assistanceCheckpoint(
  edit: AuthoringEdit,
  entry: NonNullable<CoachCheckpoint["entry"]>,
): CoachCheckpoint {
  const section = edit.source.sections[edit.section];
  return {
    entry,
    step: entry === "work" ? 0 : entry === "goal" ? 4 : 2,
    sectionIndex: edit.section,
    goalIndex:
      edit.type === "goal"
        ? edit.adding
          ? section!.goals.length
          : edit.goal
        : 0,
    adding: !!edit.adding,
    kind: edit.type === "objective" ? edit.kind : section!.kind,
    work: "",
    answers: [],
    question: "",
    options: [],
    answer: "",
    objective: edit.type === "objective" ? edit.text : section!.objective,
    initiatives:
      edit.type === "objective"
        ? edit.alignment.initiatives.map((i) => i.id)
        : section?.alignment?.initiatives.map((i) => i.id) || [],
    other:
      edit.type === "objective"
        ? edit.alignment.other
        : section?.alignment?.other,
    actions: [],
    action: "",
    date: edit.source.end,
    goal: edit.type === "goal" ? edit.text : "",
    title: edit.source.title,
    start: edit.source.start,
    end: edit.source.end,
    concern: "",
    siblings: (section?.goals || [])
      .slice(0, 12)
      .map((goal) => goal.slice(0, 500)),
    sourceVersion: edit.source.version,
  };
}
export function CoachingStages({ active }: { active: number }) {
  return (
    <nav className="coaching-stages" aria-label="Authoring stages">
      {["Your work", "Objective", "SMART goals", "Review"].map((label, i) => (
        <span key={label} aria-current={i === active ? "step" : undefined}>
          {i > 0 && <span aria-hidden="true"> → </span>}
          {label}
        </span>
      ))}
    </nav>
  );
}
export function FocusAssistance({
  edit,
  initial,
  available,
  onUse,
  onClose,
  onPause,
  onRetryInitiatives,
}: {
  edit: AuthoringEdit;
  initial: CoachCheckpoint;
  available: boolean;
  onRetryInitiatives: () => void;
  onUse: (checkpoint: CoachCheckpoint) => void;
  onClose: () => void;
  onPause: (checkpoint: CoachCheckpoint) => Promise<void>;
}) {
  const [c, setC] = useState({
      ...initial,
      kind:
        edit.type === "goal"
          ? edit.source.sections[edit.section]!.kind
          : initial.kind || edit.kind,
    }),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState<CoachStage | null>(null);
  const request = useRef<AbortController | null>(null),
    epoch = useRef(0),
    mounted = useRef(true);
  const goal = edit.type === "goal";
  const patch = (p: Partial<CoachCheckpoint>) =>
    setC((old) => ({ ...old, ...p }));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
      request.current?.abort();
    };
  }, []);
  function stop() {
    epoch.current++;
    request.current?.abort();
    setPreparing(null);
  }
  async function suggest(stage: CoachStage, context = c) {
    const n = ++epoch.current,
      abort = new AbortController();
    request.current = abort;
    setPreparing(stage);
    setError("");
    try {
      const r = await api<CoachSuggestion>(
        "/api/coach/suggest",
        "POST",
        {
          stage,
          context,
          focusId: edit.source.id,
          version: edit.source.version,
        },
        abort.signal,
      );
      if (n === epoch.current) return r;
    } catch (e) {
      if (n === epoch.current) setError((e as Error).message);
    } finally {
      if (n === epoch.current) setPreparing(null);
    }
  }
  async function proposeObjective(context = c) {
    const r = await suggest("objective", context);
    if (r)
      patch({
        ...context,
        step: 2,
        objective: r.objective || context.objective,
        recommendedKind: r.recommendedKind,
        initiatives: r.initiativeIds || context.initiatives,
        other: r.initiativeIds?.length ? false : context.other,
        concern: r.concern || "",
      });
  }
  async function next() {
    if (c.step < 2) {
      const context =
        c.step === 0
          ? { ...c, answers: [] }
          : {
              ...c,
              answers: [
                ...c.answers,
                { question: c.question, answer: c.answer || "" },
              ],
            };
      if (context.answers.length >= 3) {
        await proposeObjective(context);
        return;
      }
      const r = await suggest("clarify", context);
      if (!r) return;
      if (r.objective && r.ready !== false)
        patch({
          ...context,
          step: 2,
          objective: r.objective,
          recommendedKind: r.recommendedKind,
          initiatives: r.initiativeIds || [],
          other: false,
          concern: r.concern || "",
        });
      else
        patch({
          ...context,
          step: 1,
          question: r.question || "Who benefits, and what will improve?",
          options: r.options || [],
          answer: "",
        });
    } else if (c.step === 4) patch({ step: 5 });
    else if (c.step === 5) {
      if (c.goal) {
        patch({ step: 6 });
        return;
      }
      const r = await suggest("goal");
      if (r) patch({ step: 6, goal: r.goal || "", concern: r.concern || "" });
    }
  }
  async function actions() {
    const r = await suggest("actions");
    if (r)
      patch({
        actions: r.actions || [],
        date: c.date || r.suggestedDate || c.end,
        concern: r.concern || "",
      });
  }
  function dateLabel(date: string) {
    return date
      ? new Date(date + "T12:00:00Z").toLocaleDateString("en-NZ", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : "";
  }
  function changeDate(date: string) {
    const prefix = "By " + dateLabel(c.date) + ",";
    patch({
      date,
      goal: c.goal.startsWith(prefix)
        ? "By " + dateLabel(date) + "," + c.goal.slice(prefix.length)
        : c.goal,
      concern:
        c.goal && !c.goal.startsWith(prefix)
          ? "Check that the date in your goal still matches."
          : "",
    });
  }
  const busy = !!preparing || saving;
  return (
    <section
      className="focus-assistance coach-workspace"
      aria-label="Optional coaching"
    >
      <p className="muted">
        {edit.source.title} · Objective {edit.section + 1}
        {goal
          ? " · " +
            (edit.adding
              ? "New SMART goal"
              : "SMART goal " + ((edit.goal ?? 0) + 1))
          : ""}
      </p>
      <CoachingStages active={c.step < 2 ? 0 : goal ? 2 : 1} />
      {goal && (
        <div className="assistance-context">
          <ObjectiveType kind={edit.source.sections[edit.section]!.kind} />
          <p>{edit.source.sections[edit.section]!.objective}</p>
        </div>
      )}
      <fieldset disabled={busy} className="cp-fields">
        {c.step === 0 && (
          <>
            <h2>What are you working on?</h2>
            <label htmlFor="coach-work">Your project work</label>
            <textarea
              id="coach-work"
              value={c.work}
              maxLength={10000}
              onChange={(e) => patch({ work: e.target.value })}
            />
          </>
        )}
        {c.step === 1 && (
          <>
            <h2>{c.question}</h2>
            {c.options.map((o) => (
              <button
                type="button"
                key={o}
                onClick={() => patch({ answer: o })}
              >
                {o}
              </button>
            ))}
            <label htmlFor="coach-answer">Your answer</label>
            <textarea
              id="coach-answer"
              value={c.answer || ""}
              onChange={(e) => patch({ answer: e.target.value })}
            />
            <button
              type="button"
              className="link"
              onClick={() => void proposeObjective()}
            >
              Draft with what we have
            </button>
          </>
        )}
        {!goal && c.step >= 2 && (
          <>
            <h2>Shape your objective</h2>
            <label htmlFor="coach-objective">Objective</label>
            <textarea
              id="coach-objective"
              value={c.objective}
              maxLength={10000}
              onChange={(e) => patch({ objective: e.target.value })}
            />
            <ObjectiveTypeChoices
              kind={c.kind || "normal"}
              recommended={c.recommendedKind}
              onChange={(kind) => patch({ kind })}
            />
            <button
              type="button"
              disabled={!available || !c.objective.trim()}
              onClick={() => void proposeObjective()}
            >
              Suggest wording & type
            </button>
            {edit.type === "objective" && (
              <InitiativeChoices
                readiness={edit.initiatives}
                selection={{
                  initiatives: c.initiatives.map((id) => ({ id })),
                  other: !!c.other,
                }}
                onInitiative={(id, checked) =>
                  patch({
                    initiatives: checked
                      ? [...c.initiatives, id]
                      : c.initiatives.filter((i) => i !== id),
                    other: false,
                  })
                }
                onOther={(other) => patch({ other, initiatives: [] })}
                onRetry={onRetryInitiatives}
              />
            )}
          </>
        )}
        {goal && c.step === 4 && (
          <>
            <h2>What could you do next?</h2>
            <button
              type="button"
              disabled={!available}
              onClick={() => void actions()}
            >
              Suggest actions
            </button>
            {c.actions.map((action) => (
              <label className="cp-choice" key={action}>
                <input
                  type="radio"
                  name="coach-action"
                  checked={c.action === action}
                  onChange={() => patch({ action, goal: "" })}
                />
                {action}
              </label>
            ))}
            <label htmlFor="coach-action">Your action</label>
            <textarea
              id="coach-action"
              value={c.action}
              onChange={(e) => patch({ action: e.target.value, goal: "" })}
            />
          </>
        )}
        {goal && c.step === 5 && (
          <>
            <h2>When could you do that?</h2>
            <p>{c.action}</p>
            <label htmlFor="coach-date">Aim for</label>
            <input
              id="coach-date"
              type="date"
              value={c.date}
              onChange={(e) => changeDate(e.target.value)}
            />
          </>
        )}
        {goal && c.step >= 6 && (
          <>
            <h2>Check this suggested goal</h2>
            <label htmlFor="coach-goal">Goal</label>
            <textarea
              id="coach-goal"
              value={c.goal}
              maxLength={10000}
              onChange={(e) => patch({ goal: e.target.value })}
            />
            <label htmlFor="coach-date">Aim for</label>
            <input
              id="coach-date"
              type="date"
              value={c.date}
              onChange={(e) => changeDate(e.target.value)}
            />
          </>
        )}
        {c.concern && <p className="muted">{c.concern}</p>}
        {!available && (
          <p>
            Coaching is unavailable. Your saved answers remain here; you can
            continue manually.
          </p>
        )}
        <div className="cp-nav">
          <button
            type="button"
            onClick={() => {
              if (
                c.step === 0 ||
                c.step === 4 ||
                (!goal && c.step === 2 && c.entry !== "work")
              ) {
                onClose();
                return;
              }
              if (c.step === 2) {
                const last = c.answers.at(-1);
                patch({
                  step: c.question ? 1 : 0,
                  ...(last
                    ? {
                        answers: c.answers.slice(0, -1),
                        question: last.question,
                        answer: last.answer,
                      }
                    : {}),
                });
                return;
              }
              if (c.step === 1) {
                const last = c.answers.at(-1);
                patch(
                  last
                    ? {
                        answers: c.answers.slice(0, -1),
                        question: last.question,
                        answer: last.answer,
                      }
                    : { step: 0 },
                );
                return;
              }
              patch({ step: c.step - 1 });
            }}
          >
            Back
          </button>
          <div className="cp-row">
            <button
              type="button"
              onClick={() => {
                setSaving(true);
                setError("");
                void onPause(c)
                  .catch((e) => {
                    if (mounted.current) setError(e.message);
                  })
                  .finally(() => {
                    if (mounted.current) setSaving(false);
                  });
              }}
            >
              Save progress & close
            </button>
            {(!goal && c.step >= 2) || (goal && c.step >= 6) ? (
              <button
                type="button"
                className="primary"
                disabled={!(goal ? c.goal : c.objective).trim()}
                onClick={() => onUse(c)}
              >
                Use suggestion
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                disabled={
                  (!available && c.step !== 4) ||
                  (c.step === 0 && !c.work.trim()) ||
                  (c.step === 1 && !c.answer?.trim()) ||
                  (c.step === 4 && !c.action.trim()) ||
                  (c.step === 5 && !c.date)
                }
                onClick={() => void next()}
              >
                Next
              </button>
            )}
          </div>
        </div>
        <button type="button" className="link" onClick={onClose}>
          Cancel assistance
        </button>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button type="button" onClick={() => onUse(c)}>
              Continue manually
            </button>
          </>
        )}
      </fieldset>
      <CoachPreparing stage={preparing} onBack={stop} />
    </section>
  );
}
