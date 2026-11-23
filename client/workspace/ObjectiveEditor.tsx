import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { coachContextLimits, type CoachCheckpoint, type CoachSuggestion, type ObjectiveAssessment } from "../../shared/coach.js";
import type { EditChange, ObjectiveEdit } from "./useDraftFocusWorkflow.js";
import { objectiveTypes, ObjectiveType, ObjectiveTypeChoices } from "./ObjectiveType.js";
import { AlignmentSummary, InitiativeChoices } from "./InitiativeChoices.js";
import { CoachPreparing, type CoachStage } from "../coach/CoachPreparing.js";
import { api } from "./api.js";
import { FocusObjective } from "./FocusDocument.js";
import { Dialog } from "./Dialog.js";

const alignmentError = "Select an initiative or Other before saving this objective.";
const typeError = "Choose an objective type before continuing.";
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

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
  redesigned = false,
  onChange,
  onSave,
  onCancel,
  onRetryInitiatives,
}: {
  edit: ObjectiveEdit;
  initialMethod: AuthoringMethod;
  available: boolean;
  redesigned?: boolean;
  onChange: (change: EditChange) => void;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
  onRetryInitiatives: () => void;
}) {
  const [chosenKind, setChosenKind] = useState<CoachCheckpoint["kind"] | "unsure">(edit.text.trim() ? edit.kind : undefined);
  const [concern, setConcern] = useState("");
  const [addressingConcern, setAddressingConcern] = useState(false);
  const [concernDetails, setConcernDetails] = useState("");
  const [assessment, setAssessment] = useState<{ checks?: ObjectiveAssessment; text: string; kind: ObjectiveEdit["kind"] }>();
  const pendingReply = useRef<{ stage: CoachStage; input: CoachCheckpoint; origin: Stage; apply: (reply: CoachSuggestion) => void } | null>(null);
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
  const [feedbackAnswers, setFeedbackAnswers] = useState<CoachCheckpoint["answers"]>([]);
  const [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [recommended, setRecommended] =
    useState<CoachSuggestion["recommendedKind"]>();
  // The type the server judged alignment against: with Not sure, the coach's recommendation.
  const checkedKind = redesigned && chosenKind === "unsure" ? recommended ?? "normal" : edit.kind;
  const [recommendedInitiatives, setRecommendedInitiatives] = useState<string[]>([]);
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
    concernDetails.trim() ||
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
      answers: [...answers, ...feedbackAnswers],
      question,
      answer,
      options,
      objective: edit.text,
      kind: redesigned && chosenKind === "unsure" ? undefined : edit.kind,
      initiatives: edit.alignment.initiatives.map((i) => i.id),
      other: edit.alignment.other,
      actions: plan.actions,
      action: plan.action,
      date: plan.date,
      goal: plan.text,
      siblings: redesigned ? edit.goals : edit.goals.slice(0, 12).map((g) => g.slice(0, 500)),
      title: edit.source.title,
      start: edit.source.start,
      end: edit.source.end,
      concern: "",
      sourceVersion: edit.source.version,
    };
  }
  async function suggest(requestStage: CoachStage, input = context()) {
    if (redesigned && JSON.stringify(input).length > coachContextLimits.characters) {
      setError("This coaching context is too long. Shorten it or continue writing manually; your draft is unchanged.");
      return;
    }
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
          ...(redesigned && requestStage === "goal" ? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } : {}),
        },
        controller.current.signal,
      );
      if (requestId === epoch.current) {
        if (redesigned) setConcern(result.concern ?? "");
        if (redesigned && (requestStage === "clarify" || requestStage === "objective") && result.objective) {
          setAssessment({ checks: result.assessment, text: result.objective, kind: chosenKind === "unsure" ? result.recommendedKind ?? edit.kind : edit.kind });
        } else if (redesigned && requestStage === "objective" && !result.question) {
          // Feedback without new wording: the checks describe the wording already on screen.
          setAssessment({ checks: result.assessment, text: input.objective, kind: edit.kind });
        }
        if (redesigned && requestStage === "review" && input.entry === "objective") {
          setAssessment({ checks: result.assessment, text: input.objective, kind: edit.kind });
        }
        return result;
      }
    } catch (e) {
      if (requestId === epoch.current) setError((e as Error).message);
    } finally {
      if (requestId === epoch.current) setPreparing(null);
    }
  }
  const missingAlignment = edit.initiatives.status === "ready" &&
    !edit.alignment.other && !edit.alignment.initiatives.length;
  const missingType = redesigned && chosenKind === "unsure";
  const unsentDetails = redesigned && !!concernDetails.trim();
  async function save() {
    setError("");
    if (missingType) { setError(typeError); if (method === "guided") setStage("objective"); return; }
    if (missingAlignment) {
      setError(alignmentError);
      if (method === "guided") setStage("objective");
      return;
    }
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
    if (next === "manual" && unsentDetails) { setError("Update or clear the coach details before switching methods."); return; }
    // A partially written goal becomes an ordinary editable goal when leaving guidance.
    // It is never silently excluded from Save objective.
    if (next === "manual" && (stage === "action" || stage === "goal" || pendingReply.current?.origin === "action")) {
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
    if (pendingReply.current && pendingReply.current.origin !== "action") setStage(pendingReply.current.origin);
    pendingReply.current = null;
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
    const cached = exploration.current.get(JSON.stringify([work, answers, ...(redesigned ? [chosenKind] : [])]));
    if (cached) cached.answer = value;
  }
  async function guidedRequest(requestStage: CoachStage, input: CoachCheckpoint, apply: (reply: CoachSuggestion) => void, origin = stage): Promise<boolean> {
    const reply = await suggest(requestStage, input);
    if (!reply) return false;
    if (reply.question) {
      pendingReply.current = { stage: requestStage, input, apply, origin };
      setQuestion(reply.question);
      setOptions(reply.options ?? []);
      setAnswer("");
      setStage("question");
    } else {
      pendingReply.current = null;
      setStage(origin);
      apply(reply);
    }
    return true;
  }
  async function openGoals() {
    setStage("goals");
    if (!redesigned || edit.goals.length) return;
    await guidedRequest("actions", { ...context(), entry: "goal", action: "", goal: "", actions: [], question: "", answer: "" }, reply => {
      if (reply.actions?.length) setPlan({ actions: reply.actions, action: "", date: boundedDate(reply.suggestedDate), text: "" });
    }, "goals");
  }
  function selectRecommendation(kind: CoachSuggestion["recommendedKind"], basisAnswers = answers) {
    if (!redesigned || chosenKind !== "unsure" || !kind) return;
    onChange({ type: "kind", kind });
    setChosenKind(kind);
    if (objectiveBasis.current) {
      const prior = objectiveBasis.current;
      const revised = JSON.stringify([work, basisAnswers, kind]);
      const cached = exploration.current.get(prior);
      if (cached) exploration.current.set(revised, cached);
      objectiveBasis.current = revised;
    }
  }
  async function addressConcern() {
    if (!concernDetails.trim()) return;
    if (answers.length + feedbackAnswers.length >= coachContextLimits.answers) {
      setError("There is too much coaching context. You can continue editing your objective manually.");
      return;
    }
    const feedback = concern || Object.values(assessment?.checks ?? {}).find(check => check.status !== "met")?.note || "Additional context for the objective";
    const nextAnswers = [...answers, ...feedbackAnswers, { question: feedback, answer: concernDetails }];
    let revised = false;
    if (await guidedRequest("objective", { ...context(), entry: "objective", answers: nextAnswers, question: feedback, answer: concernDetails }, result => {
      if (!result.objective || result.objective.trim() === edit.text.trim()) {
        setConcernDetails(concernDetails);
        setAddressingConcern(true);
        setError("The coach could not update the objective. Try again or clear these details to continue.");
        return;
      }
      revised = true;
      update({ type: "objective-values", values: { text: result.objective } });
      selectRecommendation(result.recommendedKind);
      setRecommended(result.recommendedKind);
      setRecommendedInitiatives(result.initiativeIds ?? []);
    }, "objective")) {
      if (revised || pendingReply.current) {
        setFeedbackAnswers(nextAnswers.slice(answers.length));
        setConcernDetails("");
        setAddressingConcern(false);
      }
    }
  }
  function earliestDate() {
    const today = localToday();
    return today > edit.source.start ? today : edit.source.start;
  }
  function boundedDate(value?: string) {
    const earliest = earliestDate();
    return value && value >= earliest && value <= edit.source.end ? value : edit.source.end;
  }
  async function next(forceRetry = false) {
    setError("");
    if (redesigned && stage === "question" && pendingReply.current) {
      const pending = pendingReply.current;
      if (pending.input.answers.length >= coachContextLimits.answers) { setError("We still need more context. Go back or continue writing manually."); return; }
      const nextAnswers = [...pending.input.answers, { question, answer }];
      if (await guidedRequest(pending.stage, { ...pending.input, answers: nextAnswers, question, answer }, pending.apply, pending.origin)) setFeedbackAnswers(nextAnswers.slice(answers.length));
      return;
    }
    if (stage === "refine") {
      if (!redesigned && !improvement.trim()) {
        await openGoals();
        return;
      }
      if (redesigned) {
        await guidedRequest("objective", { ...context(), entry: "objective", concern: improvement }, result => {
          if (result.objective) {
            update({ type: "objective-values", values: { text: result.objective } });
            setRecommended(result.recommendedKind);
            setRecommendedInitiatives(result.initiativeIds ?? []);
          }
          const checksMet = !!result.assessment && Object.values(result.assessment).every(check => check.status === "met");
          if ((!result.objective || result.objective.trim() === edit.text.trim()) && !checksMet) {
            setConcern(["The coach could not improve this objective yet.", result.concern].filter(Boolean).join(" "));
          }
          setStage("objective");
        });
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
        setRecommendedInitiatives(result.initiativeIds ?? []);
        setStage("objective");
      }
      return;
    }
    if (stage === "work" || stage === "question") {
      if (redesigned && answers.length >= coachContextLimits.answers) {
        setError("We still need more context. You can go back to describe your work or continue writing manually.");
        return;
      }
      const nextAnswers =
        stage === "question" ? [...answers, { question, answer }] : answers;
      const input = { ...context(), answers: nextAnswers, ...(forceRetry ? { objective: "" } : {}) };
      const cacheKey = JSON.stringify([work, nextAnswers, ...(redesigned ? [chosenKind] : [])]);
      const cached = forceRetry ? undefined : exploration.current.get(cacheKey);
      const result =
        cached?.suggestion ??
        (await suggest(
          !redesigned && nextAnswers.length >= 3 ? "objective" : "clarify",
          input,
        ));
      if (!result) return;
      if (!cached && (forceRetry || objectiveBasis.current !== cacheKey)) setFeedbackAnswers([]);
      if (!cached)
        exploration.current.set(cacheKey, { suggestion: result, answer: "" });
      setAnswers(nextAnswers);
      if (redesigned && (!result.objective || result.ready === false) && (!result.question || (stage === "question" && nextAnswers.length >= 1))) {
        if (!edit.text.trim()) update({ type: "objective-values", values: { text: work } });
        const kind = chosenKind === "unsure" ? result.recommendedKind ?? edit.kind : edit.kind;
        objectiveBasis.current = cacheKey;
        selectRecommendation(result.recommendedKind, nextAnswers);
        setRecommended(result.recommendedKind);
        setAssessment({ checks: result.assessment, text: edit.text.trim() ? edit.text : work, kind });
        setConcern([result.concern, result.question].filter(Boolean).join(" "));
        setStage("objective");
        return;
      }
      if (result.objective && result.ready !== false) {
        if (forceRetry || objectiveBasis.current !== cacheKey)
          update({
            type: "objective-values",
            values: {
              text: result.objective,
            },
          });
        objectiveBasis.current = cacheKey;
        selectRecommendation(result.recommendedKind, nextAnswers);
        setRecommended(result.recommendedKind);
        setRecommendedInitiatives(result.initiativeIds ?? []);
        setStage("objective");
      } else {
        if (redesigned && !result.question) return;
        setQuestion(result.question ?? "Who benefits from this work?");
        setOptions(result.options ?? []);
        setAnswer(cached?.answer ?? "");
        setStage("question");
      }
    } else if (stage === "objective") {
      if (missingType) { setError(typeError); return; }
      if (missingAlignment) {
        setError(alignmentError);
        return;
      }
      await openGoals();
    } else if (stage === "goals") {
      if (edit.goals.some((g) => !g.trim())) {
        setError("Write or remove the empty SMART goal before continuing.");
        return;
      }
      if (redesigned) setConcern("");
      setStage("check");
    } else if (stage === "action") {
      if (redesigned && (!plan.date || plan.date < localToday() || plan.date < edit.source.start || plan.date > edit.source.end)) {
        setError("Choose a target date today or later, within this position focus period."); return;
      }
      const signature = plan.action + "\n" + plan.date;
      if (plan.text && plan.generatedFor === signature) {
        setStage("goal");
        return;
      }
      if (redesigned) {
        // A new goal request starts without the previous step's question and answer.
        await guidedRequest("goal", { ...context(), entry: "goal", question: "", answer: "" }, reply => {
          if (!reply.goal) return;
          setPlan(old => ({ ...old, text: reply.goal!, generatedFor: signature, edited: false }));
          setStage("goal");
        });
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
      question: "",
      answer: "",
      actions: [],
      action: "",
      goal: "",
    };
    if (redesigned) {
      if (plan.actions.length) { setStage("action"); return; }
      setPlan({ actions: [], action: "", date: edit.source.end, text: "" });
      await guidedRequest("actions", clean, reply => {
        if (!reply.actions?.length) return;
        setPlan({ actions: reply.actions, action: "", date: boundedDate(reply.suggestedDate), text: "" });
        setStage("action");
      });
      return;
    }
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
    if (redesigned && pendingReply.current) {
      const pending = pendingReply.current;
      setStage(pending.origin);
      pendingReply.current = null;
      if (pending.origin === "objective" && pending.input.question && pending.input.answer) {
        setConcern(pending.input.question);
        setConcernDetails(pending.input.answer);
        setAddressingConcern(true);
        setFeedbackAnswers(old => old.slice(0, -1));
      } else setConcern("");
    } else if (stage === "question") {
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
      if (redesigned && source && !previous) {
        setStage("refine");
      } else if (previous) {
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
        kind={missingType ? undefined : edit.kind}
        recommended={method === "guided" ? recommended : undefined}
        onChange={(kind) => { onChange({ type: "kind", kind }); setChosenKind(kind); if (error === typeError) setError(""); }}
      />
      {missingType && <p>Choose an objective type to continue.</p>}
      {redesigned && method === "guided" && recommended && recommended !== edit.kind && (
        <p>The coach suggests {objectiveTypes[recommended].label}. <button type="button" onClick={() => { onChange({ type: "kind", kind: recommended }); setChosenKind(recommended); }}>Switch to {objectiveTypes[recommended].label}</button></p>
      )}
      <InitiativeChoices
        selection={edit.alignment}
        readiness={edit.initiatives}
        recommended={method === "guided" ? recommendedInitiatives : []}
        onInitiative={(id, checked) => {
          onChange({ type: "initiative", id, checked });
          if (checked && error === alignmentError) setError("");
        }}
        onOther={(checked) => {
          onChange({ type: "other", checked });
          if (checked && error === alignmentError) setError("");
        }}
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
      {redesigned && method === "guided" && stage === "goals" && !!plan.actions.length && <div className="guided-choices">
        <h3>Possible goals</h3>
        {plan.actions.map(action => <button type="button" key={action} onClick={() => { setPlan({ ...plan, action, text: "" }); setStage("action"); }}>{action}</button>)}
      </div>}
      <button type="button" onClick={() => void addGoal()}>
        Add SMART goal
      </button>
    </section>
  );
  const assessmentStale = !!assessment && (assessment.text !== edit.text || assessment.kind !== edit.kind);
  const checks = assessmentStale ? undefined : assessment?.checks;
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
  const returnToDraft = redesigned && !pendingReply.current && !!edit.text.trim() && objectiveBasis.current !== undefined &&
    ((stage === "work" && objectiveBasis.current === JSON.stringify([work, answers, chosenKind])) ||
      (stage === "question" && objectiveBasis.current === JSON.stringify([work, [...answers, { question, answer }], chosenKind])));
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
            <span aria-current={redesigned ? "true" : undefined}>{redesigned ? `Current method: ${method === "guided" ? "Guide with AI" : "Write myself"}` : method === "guided" ? "AI guided" : "Manual"}</span>
            {available && (
              <button
                type="button"
                className="link"
                disabled={busy}
                onClick={() =>
                  switchMethod(method === "manual" ? "guided" : "manual")
                }
              >
                {redesigned ? "Switch to " : ""}{method === "manual" ? "Guide with AI" : "Write myself"}
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
                    {redesigned && <fieldset className="objective-types">
                      <legend>What type of objective are you drafting?</legend>
                      {([...Object.keys(objectiveTypes), "unsure"] as Array<keyof typeof objectiveTypes | "unsure">).map(kind => <label className="type-choice" key={kind}>
                        <input type="radio" name="starting-kind" checked={chosenKind === kind} onChange={() => { setChosenKind(kind); if (kind !== "unsure") onChange({ type: "kind", kind }); }} />
                        <span>{kind === "unsure" ? "Not sure" : objectiveTypes[kind].label}</span>
                      </label>)}
                    </fieldset>}
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
                    {redesigned ? <p>The coach will use the Guide to suggest a clearer objective.</p> : <div className="field">
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
                    </div>}
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
                        min={redesigned ? earliestDate() : undefined}
                        max={redesigned ? edit.source.end : undefined}
                        value={plan.date}
                        onChange={(e) => {
                          setPlan({ ...plan, date: e.target.value });
                          setError("");
                        }}
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
                  <>
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
                  </>
                )}
              </>
            )}
          </fieldset>
          {redesigned && method === "guided" && stage !== "work" && (concern || stage === "objective") && <section className="coach-feedback" aria-label="AI coach feedback">
            <h2><Sparkles aria-hidden="true" size={18} /> AI coach feedback</h2>
            {stage === "objective" && (assessmentStale ?
              <p role="status">Your objective or type changed since the coach checked it. The earlier checks may no longer apply.</p> : checks ? <>
                <p>{Object.values(checks).every(check => check.status === "met") && !concern ? "The main elements are in place. You can continue to SMART goals." : "Here is what the coach found. You can respond or continue with your draft."}</p>
                <ul className="coach-checks">
                  {([ ["purpose", checkedKind === "personal-development" ? "Your growth" : "Your contribution"], ["people", checkedKind === "personal-development" ? "Your growth and benefit" : "Who benefits and how"], ["alignment", checkedKind === "normal" ? "Connection to the mission" : "Connection to your work"] ] as const).map(([key, label]) => {
                    const check = checks[key];
                    return <li key={key} className={`coach-check coach-check-${check.status}`}>
                      <div><span aria-hidden="true">{check.status === "met" ? "✓" : check.status === "needs_attention" ? "!" : "?"}</span> <strong>{label}</strong> — <span>{check.status === "met" ? "Met" : check.status === "needs_attention" ? "Needs attention" : "Not sure"}</span></div>
                      <p>{check.note}</p>
                    </li>;
                  })}
                </ul>
              </> : <p role="status">The coach did not provide an assessment for this draft. You can continue or add context.</p>)}
            {concern && <p role="status">{stage === "objective" && assessmentStale ? "Earlier feedback: " : ""}{concern}</p>}
            {stage === "objective" && !checks && <button type="button" disabled={busy || !edit.text.trim()} onClick={() => void suggest("review", { ...context(), entry: "objective" })}>Check this objective</button>}
            {stage === "objective" && (addressingConcern || concern || (checks && Object.values(checks).some(check => check.status !== "met"))) && (addressingConcern ? <div className="field">
              <label htmlFor="concern-details">Details for the coach</label>
              <small>Optional. The coach will use your answer to update the objective.</small>
              <textarea id="concern-details" maxLength={4000} value={concernDetails} onChange={e => setConcernDetails(e.target.value)} disabled={busy} />
              {unsentDetails && <p role="status">Update objective or clear these details before continuing or saving.</p>}
              <div className="coach-detail-actions"><button type="button" className="primary" disabled={busy || !concernDetails.trim()} onClick={() => void addressConcern()}>Update objective</button>{unsentDetails && <button type="button" disabled={busy} onClick={() => { setConcernDetails(""); setError(""); }}>Clear details</button>}</div>
            </div> : <button type="button" disabled={busy} onClick={() => setAddressingConcern(true)}>Help me address this</button>)}
          </section>}
          {redesigned && canSave && !edit.goals.some(g => g.trim()) && <p role="status">No SMART goals yet. You can save this draft and add goals later. Goals make the objective actionable.</p>}
          {error && <p role="alert">{error}</p>}
          <div className="authoring-actions">
            <button type="button" disabled={busy} onClick={cancel}>
              Cancel
            </button>
            {method === "guided" &&
              stage !== "work" &&
              stage !== "refine" &&
              !(stage === "objective" && !redesigned && !edit.adding && !work) && (
                <button type="button" disabled={busy} onClick={back}>
                  Back
                </button>
              )}
            {canSave && (
              <button
                type="button"
                disabled={busy || !edit.text.trim() || unsentDetails}
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
            {redesigned && method === "guided" && stage === "refine" && <button type="button" disabled={busy} onClick={() => void openGoals()}>Continue without changes</button>}
            {method === "guided" && returnToDraft && (
              <button type="button" disabled={busy || (stage === "work" ? !work.trim() || !chosenKind : !answer.trim())} onClick={() => void next(true)}>Try again</button>
            )}
            {method === "guided" && stage !== "goal" && stage !== "check" && (
              <button
                type="button"
                className="primary"
                disabled={
                  busy ||
                  (stage === "objective" && unsentDetails) ||
                  (stage === "work" && (!work.trim() || (redesigned && !chosenKind))) ||
                  (stage === "question" && !answer.trim()) ||
                  (stage === "objective" && !edit.text.trim()) ||
                  (stage === "action" && (!plan.action.trim() || !plan.date))
                }
                onClick={() => void next()}
              >
                {returnToDraft ? "Return to draft" : redesigned && stage === "refine" ? "Improve objective" : "Next"}
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
