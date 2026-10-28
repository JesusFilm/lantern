import { useEffect, useRef, useState } from "react";
import type { CoachCheckpoint, CoachSuggestion } from "../../shared/coach.js";
import type { EditChange, ObjectiveEdit } from "./useDraftFocusWorkflow.js";
import { ObjectiveType, ObjectiveTypeChoices } from "./ObjectiveType.js";
import { AlignmentSummary, InitiativeChoices } from "./InitiativeChoices.js";
import { CoachPreparing, type CoachStage } from "../coach/CoachPreparing.js";
import { api } from "./api.js";
import { FocusObjective } from "./FocusDocument.js";
import { Dialog } from "./Dialog.js";

export type AuthoringMethod = "choose" | "manual" | "guided";
type Stage =
  | "work"
  | "question"
  | "refine"
  | "objective"
  | "goals"
  | "action"
  | "goal"
  | "check";
type GoalPlan = {
  actions: string[];
  action: string;
  date: string;
  text: string;
  generatedFor?: string;
  edited?: boolean;
};
const dateLabel = (date: string) =>
  date
    ? new Date(date + "T12:00:00Z").toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

export function ObjectiveEditor({
  edit,
  initialMethod,
  available,
  onChange,
  onSave,
  onCancel,
  onRetryInitiatives,
}: {
  edit: ObjectiveEdit;
  initialMethod: AuthoringMethod;
  available: boolean;
  onChange: (change: EditChange) => void;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
  onRetryInitiatives: () => void;
}) {
  const [method, setMethod] = useState(initialMethod);
  const [stage, setStage] = useState<Stage>(
    edit.text.trim() ? "refine" : "work",
  );
  const enteredGuidance = useRef(initialMethod === "guided");
  const [improvement, setImprovement] = useState("");
  const exploration = useRef(
    new Map<string, { suggestion: CoachSuggestion; answer: string }>(),
  );
  const objectiveBasis = useRef<string | undefined>(undefined);
  const [work, setWork] = useState("");
  const [answers, setAnswers] = useState<CoachCheckpoint["answers"]>([]);
  const [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [recommended, setRecommended] =
    useState<CoachSuggestion["recommendedKind"]>();
  const [plan, setPlan] = useState<GoalPlan>({
    actions: [],
    action: "",
    date: edit.source.end,
    text: "",
  });
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState<CoachStage | null>(null);
  const [resolveGoal, setResolveGoal] = useState(false);
  const controller = useRef<AbortController | null>(null),
    epoch = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(
    () => () => {
      epoch.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [stage, method]);
  const busy = saving || !!preparing;
  const update = (
    values: Parameters<typeof onChange>[0] & { type: "objective-values" },
  ) => onChange(values);
  const setGoals = (goals: string[]) =>
    update({ type: "objective-values", values: { goals } });
  const source = edit.adding ? undefined : edit.source.sections[edit.section];
  const changed =
    work.trim() ||
    improvement.trim() ||
    answer.trim() ||
    answers.length ||
    plan.action.trim() ||
    edit.text !== (source?.objective ?? "") ||
    edit.kind !== (source?.kind ?? "normal") ||
    JSON.stringify(edit.goals) !== JSON.stringify(source?.goals ?? []) ||
    JSON.stringify(edit.alignment) !==
      JSON.stringify({
        other: source?.alignment?.other ?? false,
        initiatives:
          source?.alignment?.initiatives.map(({ id }) => ({ id })) ?? [],
      });
  function cancel() {
    if (
      !changed ||
      window.confirm("Discard your unsaved changes to this objective?")
    )
      onCancel();
  }
  function stop() {
    epoch.current++;
    controller.current?.abort();
    setPreparing(null);
  }
  function context(): CoachCheckpoint {
    return {
      entry: "work",
      step: 0,
      work,
      answers,
      question,
      answer,
      options,
      objective: edit.text,
      kind: edit.kind,
      initiatives: edit.alignment.initiatives.map((i) => i.id),
      other: edit.alignment.other,
      actions: plan.actions,
      action: plan.action,
      date: plan.date,
      goal: plan.text,
      siblings: edit.goals.slice(0, 12).map((g) => g.slice(0, 500)),
      title: edit.source.title,
      start: edit.source.start,
      end: edit.source.end,
      concern: "",
      sourceVersion: edit.source.version,
    };
  }
  async function suggest(requestStage: CoachStage, input = context()) {
    if (!available) {
      setError(
        "AI guidance is unavailable. You can write this objective yourself.",
      );
      return;
    }
    const requestId = ++epoch.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setPreparing(requestStage);
    setError("");
    try {
      const result = await api<CoachSuggestion>(
        "/api/coach/suggest",
        "POST",
        {
          stage: requestStage,
          context: input,
          focusId: edit.source.id,
          version: edit.source.version,
        },
        controller.current.signal,
      );
      if (requestId === epoch.current) return result;
    } catch (e) {
      if (requestId === epoch.current) setError((e as Error).message);
    } finally {
      if (requestId === epoch.current) setPreparing(null);
    }
  }
  async function save() {
    setError("");
    setSaving(true);
    try {
      await onSave();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function switchMethod(next: AuthoringMethod) {
    // A partially written goal becomes an ordinary editable goal when leaving guidance.
    // It is never silently excluded from Save objective.
    if (next === "manual" && (stage === "action" || stage === "goal")) {
      if (
        plan.edited &&
        plan.text &&
        plan.generatedFor !== plan.action + "\n" + plan.date
      ) {
        setResolveGoal(true);
        return;
      }
      const text =
        (plan.generatedFor === plan.action + "\n" + plan.date
          ? plan.text
          : "") || plannedGoal();
      finishManualGoal(text);
    } else if (next === "guided" && !enteredGuidance.current)
      setStage(edit.text.trim() ? "refine" : "work");
    if (next === "guided") enteredGuidance.current = true;
    setMethod(next);
    setError("");
  }
  function plannedGoal() {
    return plan.action.trim()
      ? `${plan.date ? "By " + dateLabel(plan.date) + ", " : ""}${plan.action}`
      : "";
  }
  function finishManualGoal(text: string) {
    if (text) setGoals([...edit.goals, text]);
    setPlan({ actions: [], action: "", date: plan.date, text: "" });
    setStage("goals");
    setMethod("manual");
    setResolveGoal(false);
  }
  function answerQuestion(value: string) {
    setAnswer(value);
    const cached = exploration.current.get(JSON.stringify([work, answers]));
    if (cached) cached.answer = value;
  }
  async function next() {
    setError("");
    if (stage === "refine") {
      if (!improvement.trim()) {
        setStage("goals");
        return;
      }
      const result = await suggest("objective", {
        ...context(),
        entry: "objective",
        concern: improvement,
      });
      if (result?.objective) {
        // Refinement cannot silently relabel or realign an existing objective.
        update({
          type: "objective-values",
          values: { text: result.objective },
        });
        setRecommended(result.recommendedKind);
        setStage("objective");
      }
      return;
    }
    if (stage === "work" || stage === "question") {
      const nextAnswers =
        stage === "question" ? [...answers, { question, answer }] : answers;
      const input = { ...context(), answers: nextAnswers };
      const cacheKey = JSON.stringify([work, nextAnswers]);
      const cached = exploration.current.get(cacheKey);
      const result =
        cached?.suggestion ??
        (await suggest(
          nextAnswers.length >= 3 ? "objective" : "clarify",
          input,
        ));
      if (!result) return;
      if (!cached)
        exploration.current.set(cacheKey, { suggestion: result, answer: "" });
      setAnswers(nextAnswers);
      if (result.objective && result.ready !== false) {
        if (objectiveBasis.current !== cacheKey)
          update({
            type: "objective-values",
            values: {
              text: result.objective,
              alignment: {
                other: false,
                initiatives: (result.initiativeIds ?? []).map((id) => ({ id })),
              },
            },
          });
        objectiveBasis.current = cacheKey;
        setRecommended(result.recommendedKind);
        setStage("objective");
      } else {
        setQuestion(result.question ?? "Who benefits from this work?");
        setOptions(result.options ?? []);
        setAnswer(cached?.answer ?? "");
        setStage("question");
      }
    } else if (stage === "objective") setStage("goals");
    else if (stage === "goals") {
      if (edit.goals.some((g) => !g.trim())) {
        setError("Write or remove the empty SMART goal before continuing.");
        return;
      }
      setStage("check");
    } else if (stage === "action") {
      const signature = plan.action + "\n" + plan.date;
      if (plan.text && plan.generatedFor === signature) {
        setStage("goal");
        return;
      }
      const result = await suggest("goal", { ...context(), entry: "goal" });
      if (result?.goal) {
        setPlan((old) => ({
          ...old,
          text: result.goal!,
          generatedFor: signature,
          edited: false,
        }));
        setStage("goal");
      }
    }
  }
  async function addGoal() {
    if (method === "manual") {
      setGoals([...edit.goals, ""]);
      return;
    }
    const clean = {
      ...context(),
      entry: "goal" as const,
      actions: [],
      action: "",
      goal: "",
    };
    const result = await suggest("actions", clean);
    if (result) {
      setPlan({
        actions: result.actions ?? [],
        action: "",
        date: result.suggestedDate ?? edit.source.end,
        text: "",
      });
      setStage("action");
    }
  }
  function back() {
    setError("");
    if (stage === "question") {
      const previous = answers.at(-1);
      if (previous) {
        setAnswers(answers.slice(0, -1));
        setQuestion(previous.question);
        setAnswer(previous.answer);
        setOptions(
          exploration.current.get(JSON.stringify([work, answers.slice(0, -1)]))
            ?.suggestion.options ?? [],
        );
      } else setStage("work");
    } else if (stage === "objective") {
      const previous = answers.at(-1);
      if (previous) {
        setAnswers(answers.slice(0, -1));
        setQuestion(previous.question);
        setAnswer(previous.answer);
        setStage("question");
      } else setStage("work");
    } else if (stage === "goals") setStage("objective");
    else if (stage === "check") setStage("goals");
    else if (stage === "goal") setStage("action");
    else if (
      stage === "action" &&
      (!plan.action || window.confirm("Discard this unfinished goal?"))
    )
      setStage("goals");
  }
  const pendingAlignment = {
    other: edit.alignment.other,
    initiatives: edit.alignment.initiatives.map(({ id }) => {
      const current =
        edit.initiatives.status === "ready"
          ? edit.initiatives.choices.find((i) => i.id === id)
          : undefined;
      const original = source?.alignment?.initiatives.find((i) => i.id === id);
      return {
        id,
        name: current?.name ?? original?.name ?? "Initiative",
        appearance: current?.appearance ?? original?.appearance,
      };
    }),
  };
  const fields = (
    <>
      <div className="field">
        <label htmlFor="objective-text">Objective</label>
        <textarea
          id="objective-text"
          maxLength={10000}
          value={edit.text}
          onChange={(e) => onChange({ type: "text", text: e.target.value })}
        />
      </div>
      <ObjectiveTypeChoices
        kind={edit.kind}
        recommended={method === "guided" ? recommended : undefined}
        onChange={(kind) => onChange({ type: "kind", kind })}
      />
      <InitiativeChoices
        selection={edit.alignment}
        readiness={edit.initiatives}
        onInitiative={(id, checked) =>
          onChange({ type: "initiative", id, checked })
        }
        onOther={(checked) => onChange({ type: "other", checked })}
        onRetry={onRetryInitiatives}
      />
    </>
  );
  const goals = (
    <section className="authoring-section">
      <h2>SMART goals</h2>
      {!edit.goals.length && <p className="muted">No goals yet.</p>}
      <div className="goal-editor-list">
        {edit.goals.map((goal, i) => (
          <div className="field" key={i}>
            <label htmlFor={"objective-goal-" + i}>SMART goal {i + 1}</label>
            <textarea
              id={"objective-goal-" + i}
              value={goal}
              maxLength={10000}
              onChange={(e) =>
                setGoals(
                  edit.goals.map((old, j) => (i === j ? e.target.value : old)),
                )
              }
            />
            <button
              type="button"
              className="link"
              onClick={() => setGoals(edit.goals.filter((_, j) => i !== j))}
            >
              Remove goal {i + 1}
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => void addGoal()}>
        Add SMART goal
      </button>
    </section>
  );
  const stageNumber =
    stage === "work" || stage === "question"
      ? 0
      : stage === "objective" || stage === "refine"
        ? 1
        : stage === "check"
          ? 3
          : 2;
  const canSave =
    method === "manual" ||
    stage === "objective" ||
    stage === "goals" ||
    stage === "check";
  return (
    <section
      className="objective-editor"
      aria-label={edit.adding ? "Add objective" : "Edit objective"}
    >
      <header className="authoring-header">
        <p className="muted">
          {edit.source.title} · Objective {edit.section + 1}
        </p>
        <h1 ref={heading} tabIndex={-1}>
          {method === "guided" && stage === "check"
            ? "Check objective"
            : edit.adding
              ? "Add objective"
              : "Edit objective"}
        </h1>
        {method !== "choose" && (
          <div className="authoring-method">
            <span>{method === "guided" ? "AI guided" : "Manual"}</span>
            {available && (
              <button
                type="button"
                className="link"
                disabled={busy}
                onClick={() =>
                  switchMethod(method === "manual" ? "guided" : "manual")
                }
              >
                {method === "manual" ? "Guide with AI" : "Write myself"}
              </button>
            )}
          </div>
        )}
      </header>
      {method === "choose" ? (
        <>
          <div className="objective-methods">
            <button type="button" onClick={() => switchMethod("manual")}>
              Write myself
            </button>
            <button type="button" onClick={() => switchMethod("guided")}>
              Guide with AI
            </button>
          </div>
          <div className="authoring-actions">
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {method === "guided" && (
            <nav className="authoring-stages" aria-label="Objective stages">
              {["Your work", "Objective", "SMART goals", "Check objective"].map(
                (label, i) => (
                  <span
                    key={label}
                    aria-current={i === stageNumber ? "step" : undefined}
                  >
                    {i > 0 && <span aria-hidden="true"> → </span>}
                    {label}
                  </span>
                ),
              )}
            </nav>
          )}
          <fieldset disabled={busy} className="authoring-fields">
            {method === "manual" ? (
              <>
                {fields}
                {goals}
              </>
            ) : (
              <>
                {stage === "work" && (
                  <div className="field">
                    <label htmlFor="project-work">Your work</label>
                    <textarea
                      id="project-work"
                      value={work}
                      maxLength={10000}
                      onChange={(e) => setWork(e.target.value)}
                    />
                  </div>
                )}
                {stage === "question" && (
                  <section className="authoring-section">
                    <h2>{question}</h2>
                    {!!options.length && (
                      <div className="guided-choices">
                        {options.map((option) => (
                          <button
                            type="button"
                            key={option}
                            onClick={() => answerQuestion(option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="work-answer">Your answer</label>
                      <textarea
                        id="work-answer"
                        maxLength={4000}
                        value={answer}
                        onChange={(e) => answerQuestion(e.target.value)}
                      />
                    </div>
                  </section>
                )}
                {stage === "refine" && (
                  <>
                    <div className="goal-parent">
                      <ObjectiveType kind={edit.kind} />
                      <p>{edit.text}</p>
                      <AlignmentSummary alignment={pendingAlignment} />
                    </div>
                    <div className="field">
                      <label htmlFor="objective-improvement">
                        What would you like to improve about this objective?
                      </label>
                      <small>Optional</small>
                      <textarea
                        id="objective-improvement"
                        maxLength={4000}
                        value={improvement}
                        onChange={(e) => setImprovement(e.target.value)}
                      />
                    </div>
                  </>
                )}
                {stage === "objective" && fields}
                {stage === "goals" && (
                  <>
                    <div className="goal-parent">
                      <ObjectiveType kind={edit.kind} />
                      <p>{edit.text}</p>
                    </div>
                    {goals}
                  </>
                )}
                {stage === "action" && (
                  <section className="authoring-section">
                    <div className="goal-parent">
                      <ObjectiveType kind={edit.kind} />
                      <p>{edit.text}</p>
                    </div>
                    <h2>Plan a SMART goal</h2>
                    <fieldset className="guided-choices">
                      <legend>Choose an action</legend>
                      {plan.actions.map((action) => (
                        <label key={action}>
                          <input
                            type="radio"
                            name="goal-action"
                            checked={plan.action === action}
                            onChange={() => setPlan({ ...plan, action })}
                          />
                          <span>{action}</span>
                        </label>
                      ))}
                    </fieldset>
                    <div className="field">
                      <label htmlFor="goal-action">Action</label>
                      <textarea
                        id="goal-action"
                        value={plan.action}
                        maxLength={10000}
                        onChange={(e) =>
                          setPlan({ ...plan, action: e.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="goal-date">Target date</label>
                      <input
                        id="goal-date"
                        type="date"
                        value={plan.date}
                        onChange={(e) =>
                          setPlan({ ...plan, date: e.target.value })
                        }
                      />
                    </div>
                  </section>
                )}
                {stage === "goal" && (
                  <section className="authoring-section">
                    <div className="goal-parent">
                      <ObjectiveType kind={edit.kind} />
                      <p>{edit.text}</p>
                    </div>
                    <h2>Check this goal</h2>
                    <div className="field">
                      <label htmlFor="goal-text">SMART goal</label>
                      <textarea
                        id="goal-text"
                        value={plan.text}
                        maxLength={10000}
                        onChange={(e) =>
                          setPlan({
                            ...plan,
                            text: e.target.value,
                            edited: true,
                          })
                        }
                      />
                    </div>
                  </section>
                )}
                {stage === "check" && (
                  <FocusObjective
                    focus={{
                      ...edit.source,
                      sections: edit.source.sections
                        .slice(0, edit.section)
                        .concat({
                          kind: edit.kind,
                          objective: edit.text,
                          goals: edit.goals,
                          alignment: pendingAlignment,
                        })
                        .concat(edit.source.sections.slice(edit.section + 1)),
                    }}
                    index={edit.section}
                  />
                )}
              </>
            )}
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <div className="authoring-actions">
            <button type="button" disabled={busy} onClick={cancel}>
              Cancel
            </button>
            {method === "guided" &&
              stage !== "work" &&
              stage !== "refine" &&
              !(stage === "objective" && !edit.adding && !work) && (
                <button type="button" disabled={busy} onClick={back}>
                  Back
                </button>
              )}
            {canSave && (
              <button
                type="button"
                disabled={busy || !edit.text.trim()}
                className={
                  method === "manual" || stage === "check"
                    ? "primary"
                    : undefined
                }
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save objective"}
              </button>
            )}
            {method === "guided" && stage === "goal" && (
              <button
                type="button"
                className="primary"
                disabled={busy || !plan.text.trim()}
                onClick={() => {
                  setGoals([...edit.goals, plan.text]);
                  setPlan({
                    actions: [],
                    action: "",
                    date: plan.date,
                    text: "",
                  });
                  setStage("goals");
                }}
              >
                Add to objective
              </button>
            )}
            {method === "guided" && stage !== "goal" && stage !== "check" && (
              <button
                type="button"
                className="primary"
                disabled={
                  busy ||
                  (stage === "work" && !work.trim()) ||
                  (stage === "question" && !answer.trim()) ||
                  (stage === "objective" && !edit.text.trim()) ||
                  (stage === "action" && (!plan.action.trim() || !plan.date))
                }
                onClick={() => void next()}
              >
                Next
              </button>
            )}
          </div>
        </>
      )}
      {resolveGoal && (
        <Dialog
          title="The goal’s plan changed"
          saveLabel="Keep my wording"
          onClose={() => setResolveGoal(false)}
          onSave={async () => finishManualGoal(plan.text)}
        >
          <h3>Your wording</h3>
          <p>{plan.text}</p>
          <h3>Updated plan</h3>
          <p>{plannedGoal()}</p>
          <button type="button" onClick={() => finishManualGoal(plannedGoal())}>
            Use updated plan
          </button>
        </Dialog>
      )}
      <CoachPreparing
        stage={preparing}
        onBack={stop}
        onClose={() => heading.current?.focus({ preventScroll: true })}
      />
    </section>
  );
}
