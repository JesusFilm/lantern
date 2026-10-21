import { useId, useState } from "react";
import type { ReactNode } from "react";
import type { ObjectiveKind } from "../../shared/focus.js";

const guidance = {
  normal: {
    title: "Describe a useful change.",
    intro: "Start with the people your contribution serves.",
    questions: ["Who benefits?", "What becomes better for them?", "Can you influence this outcome?"],
    example: "Help engineers diagnose failed releases quickly so service can be restored with confidence.",
    note: "Internal contributions count too. Keep detailed targets for the goals.",
  },
  "personal-development": {
    title: "Build a useful capability.",
    intro: "Personal development is optional. Choose something that helps you grow in your contribution.",
    questions: ["What capability do you want to develop?", "Where will you practise it?", "Who can give you useful feedback?"],
    example: "Build confidence in explaining technical tradeoffs so colleagues can make informed decisions.",
    note: "Use the goals to describe practice, feedback and evidence of progress.",
  },
  leadership: {
    title: "Help others succeed.",
    intro: "Leadership development is optional. Think about how you can support other people.",
    questions: ["Who will you support?", "What will they be better able to do?", "What support do you need yourself?"],
    example: "Help new facilitators lead design discussions with confidence.",
    note: "You can develop leadership without holding a management role.",
  },
  goal: {
    title: "Make progress observable.",
    intro: "Turn the objective into a practical next step.",
    questions: ["What exactly will you do?", "What evidence will show progress?", "What timing and support are realistic?", "How does this support the objective?"],
    example: "By the end of week 2, test the screen with five viewers and record whether they can find the next step.",
    note: "Be specific, measurable, achievable, relevant and time-bound. A useful measure can be a count, a quality check, or an observed result.",
  },
};

/** Help has only display state; the existing draft workflow retains every edit. */
export function WritingHelp({ kind, focusTitle, children }: { kind: ObjectiveKind | "goal"; focusTitle: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const help = guidance[kind];
  return <div className="focus-writing">
    <div className="writing-help-header">
      <p className="muted">Position focus: {focusTitle}</p>
      <button className="link writing-help-toggle" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        {open ? "Hide writing help" : "Show writing help"}
      </button>
    </div>
    <div className={"writing-columns" + (open ? " has-help" : "")}>
      <div className="writing-fields">{children}</div>
      <section className="writing-help" id={id} hidden={!open} aria-labelledby={id + "-title"}>
        <h3 id={id + "-title"}>{help.title}</h3>
        <p>{help.intro}</p>
        <ul>{help.questions.map(question => <li key={question}>{question}</li>)}</ul>
        <h4>For example</h4>
        <p>{help.example}</p>
        <p className="muted">{help.note}</p>
        <p className="muted">Your wording stays in place while you open or close these tips.</p>
      </section>
    </div>
  </div>;
}
