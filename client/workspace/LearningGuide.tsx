import { ProceduresGuide, procedureSections } from "./ProceduresGuide.js";
import type { DepartmentDirection } from "../../shared/direction.js";
import { api } from "./api.js";
import { InitiativeIdentity } from "./InitiativeIdentity.js";
import { useEffect, useRef, useState } from "react";
import { useSwipeNavigation } from "./useSwipeNavigation.js";
import { usePhoneLayout } from "./usePhoneLayout.js";
import { lessons } from "./lessons.js";
import { FocusExample } from "./FocusExample.js";
import { FocusProcess } from "./FocusProcess.js";
const topics = ["Start here", "Objectives", "SMART goals", "Example", "Strategic initiatives", "Procedures"] as const;
type Topic = typeof topics[number];
export function LearningGuide({ onFocuses }: { onFocuses: () => void }) {
  const compact = usePhoneLayout();
  const [engineering, setEngineering] = useState(false);
  const [example, setExample] = useState<"weak" | "strong">("strong");
  const weakExample = useRef<HTMLDivElement>(null), strongExample = useRef<HTMLDivElement>(null);
  function compare(next: "weak" | "strong") {
    setExample(next);
    // Reveal the chosen example even when a small phone needs vertical reading.
    requestAnimationFrame(() => (next === "weak" ? weakExample : strongExample)
      .current?.scrollIntoView({ block: "nearest" }));
  }
  const [topic, setTopic] = useState<Topic>("Start here"),
    [step, setStep] = useState(0);
  const [direction, setDirection] = useState<DepartmentDirection>();
  const [directionError, setDirectionError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (topic !== "Strategic initiatives") return;
    let active = true;
    setDirection(undefined);
    setDirectionError("");
    void api<DepartmentDirection>("/api/department/direction").then(value => {
      if (active) { setDirection(value); setStep(0); }
    }).catch((error: Error) => { if (active) setDirectionError(error.message); });
    return () => { active = false; };
  }, [topic, attempt]);
  const heading = useRef<HTMLHeadingElement>(null),
    interacted = useRef(false);
  function choose(t: Topic) {
    interacted.current = true;
    setTopic(t);
    setExample("strong");
    setStep(0);
  }
  function advance(n: number) {
    interacted.current = true;
    setStep(n);
    setExample("strong");
  }
  useEffect(() => {
    if (interacted.current) {
      heading.current?.focus({ preventScroll: true });
      if (compact) {
        const destination = topic === "Procedures"
          ? heading.current?.closest("section")
          : topic === "Strategic initiatives" || topic === "Example" ? heading.current : document.querySelector(".guide-layout");
        destination?.scrollIntoView({ block: "start" });
      }
      else heading.current?.scrollIntoView({ block: "nearest" });
    }
  }, [topic, step, engineering, direction]);
  const initiatives = direction?.initiatives.filter(item => !item.archived) ?? [];
  const initiative = initiatives[step];
  const steps = topic === "Objectives" || topic === "SMART goals" ? lessons[topic] : [],
    x = steps[step];
  const weak =
    topic === "Objectives"
      ? [
          "Activity without an outcome",
          "Audience and outcome unclear",
          "Too many unrelated outcomes",
        ][step]
      : [
          "Action is vague",
          "Success cannot be checked",
          "Scope exceeds likely capacity",
          "Does not support this objective",
          "No completion date",
        ][step];
  const strong =
    topic === "Objectives"
      ? [
          "A useful outcome for people",
          "A defined audience and benefit",
          "One focused outcome",
        ][step]
      : [
          "A concrete action and deliverable",
          "An observable success measure",
          "A manageable pilot with support",
          "Directly supports the objective",
          "A clear completion date",
        ][step];
  const swipe = useSwipeNavigation(compact && topic !== "Strategic initiatives" && topic !== "Procedures", () => {
    if (step > 0) advance(step - 1);
    else if (topic !== "Start here") {
      const previousTopic = topics[topics.indexOf(topic) - 1]!;
      choose(previousTopic);
      if (previousTopic === "Objectives" || previousTopic === "SMART goals") setStep(lessons[previousTopic].length - 1);
    }
  }, () => {
    if (step < steps.length - 1) advance(step + 1);
    else if (topic !== "Example") choose(topics[topics.indexOf(topic) + 1]!);
  });
  return (
    <>
      <header className="guide-header">
        <h1>
          {compact ? "Guide" : topic === "Procedures" ? "A rhythm to return to" : topic === "Strategic initiatives" ? "Explore our strategic initiatives" : topic === "Start here" ? "Your first position focus" : topic === "Example"
            ? engineering ? "An engineering position focus" : "A simple position focus"
            : topic === "Objectives"
              ? "What makes a useful objective?"
              : "Build a SMART goal"}
        </h1>
      </header>
      {topic === "Procedures" && <div className="procedure-header-copy"><p>Six months of focus. A conversation each quarter.</p><span className="procedure-proposed">Proposed</span></div>}
      <div className="guide-layout">
        <div className="guide-navigation">
          <div className="area-heading">Guide topics</div>
          <div className="topic-group">
            {topics.map((t) => (
              <div className="topic-entry" key={t}>
                <button
                  aria-pressed={topic === t}
                  aria-expanded={t === "Example" || t === "Strategic initiatives" || t === "Procedures" ? topic === t : undefined}
                  aria-controls={topic === t ? t === "Example" ? "example-guide-steps" : t === "Procedures" ? "procedure-guide-steps" : undefined : undefined}
                  className={topic === t ? "selected" : ""}
                  onClick={() => choose(t)}
                >
                  {t}
                </button>
                {topic === t && t === "Example" && <div id="example-guide-steps" className="lesson-steps example-guide-steps" aria-label="Steps within Example">
                  <button aria-current={!engineering ? "step" : undefined} onClick={() => { interacted.current = true; setEngineering(false); }}>Single Example</button>
                  <button aria-current={engineering ? "step" : undefined} onClick={() => { interacted.current = true; setEngineering(true); }}>Engineering Example</button>
                </div>}
                {topic === t && t === "Procedures" && <div id="procedure-guide-steps" className="lesson-steps procedure-guide-steps" aria-label="Steps within Procedures">
                  {procedureSections.map((label, i) => <button key={label} aria-current={step === i ? "step" : undefined} onClick={() => advance(i)}>{label}</button>)}
                </div>}
                {topic === t && t === "Strategic initiatives" && <div className="lesson-steps initiative-guide-steps" aria-label="Strategic initiatives">
                  {initiatives.map((item, i) => <button key={item.id} aria-current={step === i ? "step" : undefined}
                    onClick={() => advance(i)}><InitiativeIdentity name={item.name} appearance={item.appearance} /></button>)}
                </div>}
                {topic === t && x && !compact && (
                  <div
                    className="lesson-steps"
                    aria-label={"Steps within " + topic}
                  >
                    {steps.map((v, i) => (
                      <button
                        key={v[0]}
                        aria-current={step === i ? "step" : undefined}
                        onClick={() => advance(i)}
                      >
                        <span>{topic === "Objectives" ? i + 1 : v[0]}</span>
                        {topic === "Objectives" ? v[0] : v[1]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {compact && x && <label className="lesson-chooser">
          <span>Lesson<span className="gesture-hint" aria-hidden="true">Swipe to move</span></span>
          <select aria-label="Lesson" value={step} onChange={event => advance(Number(event.target.value))}>
            {steps.map((lesson, i) => <option key={lesson[0]} value={i}>{i + 1} / {steps.length} · {topic === "Objectives" ? lesson[0] : lesson[1]}</option>)}
          </select>
        </label>}
        <div className="lesson-body" {...swipe}>
          {topic === "Procedures" ? <ProceduresGuide section={procedureSections[step] ?? "The year"} headingRef={heading} /> : topic === "Strategic initiatives" ? <section className="lesson-card initiative-guide-reader">
            {directionError ? <div role="alert"><p>{directionError}</p><button onClick={() => setAttempt(n => n + 1)}>Try again</button></div>
              : !direction ? <p role="status">Loading initiatives…</p>
              : initiative ? <>
                <h2 ref={heading} tabIndex={-1}><InitiativeIdentity name={initiative.name} appearance={initiative.appearance} /></h2>
                <p className="lesson-intro initiative-description">{initiative.description || "Your career lead hasn’t added a description yet."}</p>
              </> : <h2 ref={heading} tabIndex={-1}>No active initiatives yet.</h2>}
          </section> : topic === "Start here" ? (
            <>
              <section className="lesson-card start-guide">
                <h2 ref={heading} tabIndex={-1}>A draft, a conversation, an agreed focus.</h2>
                <p className="lesson-intro">Start with one objective and one or two goals. Personal and leadership development are optional.</p>
                <FocusProcess />
                <section className="start-guide-alignment">
                  <h3>Choose initiatives</h3>
                  <p>When editing an objective, choose all the initiatives it supports, or Other if none fit.</p>
                </section>
                <section className="explanation">
                  <h3>Good to know</h3>
                  <p>Saved drafts are visible to you and your career lead. Once your lead confirms, the focus can’t be edited or unlocked.</p>
                </section>
                <button className="guide-example-link" onClick={() => { setEngineering(true); choose("Example"); }}>See an engineering example →</button>
              </section>
              <div className="lesson-footer">
                <button onClick={onFocuses}>Start my draft</button>
                <button className="primary" onClick={() => choose("Objectives")}>Explore objectives →</button>
              </div>
            </>
          ) : x ? (
            <>
              <section className="lesson-card">
                <h2 ref={heading} tabIndex={-1}>
                  {x[1]}
                </h2>
                <p className="lesson-intro">{x[2]}</p>
                <div className="comparison-heading">Compare the examples</div>
                {compact && <div className="example-switch" aria-label="Compare examples">
                  <button aria-pressed={example === "weak"} onClick={() => compare("weak")}>Needs work</button>
                  <button aria-pressed={example === "strong"} onClick={() => compare("strong")}>Stronger</button>
                </div>}
                <div className="example-pair">
                  <div ref={weakExample} className="weak-example" hidden={compact && example !== "weak"}>
                    <div className="example-title">
                      <span className="example-icon" aria-hidden="true">
                        ×
                      </span>
                      <h3>Needs work</h3>
                    </div>
                    <p>{x[4]}</p>
                    <div className="example-reason">{weak}</div>
                  </div>
                  <div ref={strongExample} className="strong-example" hidden={compact && example !== "strong"}>
                    <div className="example-title">
                      <span className="example-icon" aria-hidden="true">
                        ✓
                      </span>
                      <h3>Stronger example</h3>
                    </div>
                    <p>{x[5]}</p>
                    <div className="example-reason">{strong}</div>
                  </div>
                </div>
                <section className="explanation">
                  <h3>✦ Why it works</h3>
                  <p>{x[6]}</p>
                </section>
              </section>
              <div className="lesson-footer">
                {step > 0 ? (
                  <button onClick={() => advance(step - 1)}>← Previous</button>
                ) : compact ? (
                  <button onClick={() => {
                    choose(topic === "Objectives" ? "Start here" : "Objectives");
                    if (topic !== "Objectives") setStep(lessons.Objectives.length - 1);
                  }}>← Previous</button>
                ) : <span /> }
                {step < steps.length - 1 ? (
                  <button className="primary" onClick={() => advance(step + 1)}>
                    Next →
                  </button>
                ) : (
                  <button
                    className="primary"
                    onClick={() =>
                      choose(topic === "Objectives" ? "SMART goals" : "Example")
                    }
                  >
                    {topic === "Objectives"
                      ? "Continue to SMART goals →"
                      : "See the full example →"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <FocusExample engineering={engineering} heading={heading} />
              <div className="lesson-footer">
                <button onClick={() => {
                  choose("SMART goals");
                  if (compact) setStep(lessons["SMART goals"].length - 1);
                }}>
                  ← Review SMART goals
                </button>
                <button className="primary" onClick={onFocuses}>
                  Go to my position focuses
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
