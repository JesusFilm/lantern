import { useEffect, useRef, useState } from "react";
import { lessons } from "./lessons.js";
type Topic = "Objectives" | "SMART goals" | "Example";
export function LearningGuide({ onFocuses }: { onFocuses: () => void }) {
  const [topic, setTopic] = useState<Topic>("Objectives"),
    [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null),
    interacted = useRef(false);
  function choose(t: Topic) {
    interacted.current = true;
    setTopic(t);
    setStep(0);
  }
  function advance(n: number) {
    interacted.current = true;
    setStep(n);
  }
  useEffect(() => {
    if (interacted.current) {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "nearest" });
    }
  }, [topic, step]);
  const steps = topic === "Example" ? [] : lessons[topic],
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
  return (
    <>
      <header>
        <h1>
          {topic === "Example"
            ? "A simple position focus"
            : topic === "Objectives"
              ? "What makes a useful objective?"
              : "Build a SMART goal"}
        </h1>
      </header>
      <div className="guide-layout">
        <div className="guide-navigation">
          <div className="area-heading">Guide topics</div>
          <div className="topic-group">
            {(["Objectives", "SMART goals", "Example"] as Topic[]).map((t) => (
              <div className="topic-entry" key={t}>
                <button
                  aria-pressed={topic === t}
                  className={topic === t ? "selected" : ""}
                  onClick={() => choose(t)}
                >
                  {t}
                </button>
                {topic === t && x && (
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
        <div className="lesson-body">
          {x ? (
            <>
              <section className="lesson-card">
                <h2 ref={heading} tabIndex={-1}>
                  {x[1]}
                </h2>
                <p className="lesson-intro">{x[2]}</p>
                <div className="comparison-heading">Compare the examples</div>
                <div className="example-pair">
                  <div className="weak-example">
                    <div className="example-title">
                      <span className="example-icon" aria-hidden="true">
                        ×
                      </span>
                      <h3>Needs work</h3>
                    </div>
                    <p>{x[4]}</p>
                    <div className="example-reason">{weak}</div>
                  </div>
                  <div className="strong-example">
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
                ) : (
                  <span />
                )}
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
              <section className="read-section">
                <div className="read-objective">
                  <h2 ref={heading} tabIndex={-1}>
                    Objective 1
                  </h2>
                  <p className="read-text">
                    Help new team members find essential information so they can
                    begin their work with confidence.
                  </p>
                </div>
                <div className="read-goals">
                  <h3>SMART goals</h3>
                  {[
                    "By 31 May, publish a one-page checklist covering the five essential onboarding tasks, checked by the onboarding lead.",
                    "By 30 June, test the checklist with five new team members; at least four can find all five tasks without help.",
                  ].map((goal, i) => (
                    <div className="read-goal" key={goal}>
                      <span className="goal-number">{i + 1}</span>
                      <p className="read-text">{goal}</p>
                    </div>
                  ))}
                </div>
              </section>
              <div className="lesson-footer">
                <button onClick={() => choose("SMART goals")}>
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
