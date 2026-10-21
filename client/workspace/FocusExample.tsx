import type { Ref } from "react";
import type { ObjectiveAlignment } from "../../shared/focus.js";
import { AlignmentSummary } from "./InitiativeChoices.js";

// Illustrative alignment, independent of a member's live department settings.
const exampleAlignment: Record<"simple" | "engineering", ObjectiveAlignment> = {
  simple: { other: false, initiatives: [
    { id: "example-role-clarity", name: "Role Clarity And Growth", appearance: { icon: "sprout", color: "#267c65" } },
  ] },
  engineering: { other: false, initiatives: [
    { id: "example-love-what-we-build", name: "Love What We Build", appearance: { icon: "heart", color: "#c74998" } },
    { id: "example-rethink-how-we-build", name: "Rethink How We Build", appearance: { icon: "lightbulb", color: "#3276b0" } },
  ] },
};

export function FocusExample({ engineering, onChoose, heading }: {
  engineering: boolean;
  onChoose: (engineering: boolean) => void;
  heading: Ref<HTMLHeadingElement>;
}) {
  const goals = engineering ? [
    "By the end of week 2, agree the intended next step with Product, test the current screen with five viewers, and record where they struggle.",
    "By the end of week 6, release an agreed improvement with QA checks and repeat the task with five viewers. Aim for at least four to find the next step without help; record remaining difficulties.",
  ] : [
    "By 31 May, publish a one-page checklist covering the five essential onboarding tasks, checked by the onboarding lead.",
    "By 30 June, test the checklist with five new team members; at least four can find all five tasks without help.",
  ];
  return <>
    <div className="focus-example-switch" aria-label="Choose a worked example">
      <button aria-pressed={!engineering} onClick={() => onChoose(false)}>Simple example</button>
      <button aria-pressed={engineering} onClick={() => onChoose(true)}>Engineering example</button>
    </div>
    <section className="read-section">
      <div className="read-objective">
        <h2 ref={heading} tabIndex={-1}>Objective 1</h2>
        <p className="read-text">{engineering
          ? "Help viewers understand how to take a meaningful next step after watching a film."
          : "Help new team members find essential information so they can begin their work with confidence."}</p>
        <AlignmentSummary alignment={exampleAlignment[engineering ? "engineering" : "simple"]} />
      </div>
      <div className="read-goals">
        <h3>SMART goals</h3>
        {goals.map((goal, i) => <div className="read-goal" key={goal}>
          <span className="goal-number">{i + 1}</span>
          <p className="read-text">{goal}</p>
        </div>)}
      </div>
    </section>
  </>;
}
