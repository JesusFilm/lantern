import { useId, useState } from "react";
import type { ObjectiveKind } from "../../shared/focus.js";
export const objectiveTypes: Record<
  ObjectiveKind,
  { label: string; description: string }
> = {
  normal: {
    label: "Contribution",
    description:
      "A useful outcome your work contributes to. Use this for improving a product, service or team capability.",
  },
  "personal-development": {
    label: "Personal development",
    description:
      "A capability or behaviour you want to develop. Use this for learning, practice and feedback.",
  },
  leadership: {
    label: "Leadership",
    description:
      "Develop leadership through a practical assignment. Use this for helping others succeed, such as facilitating or mentoring.",
  },
};
export function TypeInfo({ kind }: { kind: ObjectiveKind }) {
  const [open, setOpen] = useState(false),
    id = useId();
  return (
    <span className="type-info">
      <button
        type="button"
        className="link"
        aria-label={"About " + objectiveTypes[kind].label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        ⓘ
      </button>
      {open && (
        <span id={id} className="type-explanation">
          {objectiveTypes[kind].description}
        </span>
      )}
    </span>
  );
}
export function ObjectiveType({ kind }: { kind: ObjectiveKind }) {
  return (
    <span className="objective-type">
      <span className="badge">{objectiveTypes[kind].label}</span>
      <TypeInfo kind={kind} />
    </span>
  );
}
export function ObjectiveTypeChoices({
  kind,
  onChange,
  recommended,
}: {
  kind: ObjectiveKind;
  onChange: (kind: ObjectiveKind) => void;
  recommended?: ObjectiveKind;
}) {
  const id = useId();
  return (
    <fieldset className="objective-types">
      <legend>Objective type</legend>
      {(Object.keys(objectiveTypes) as ObjectiveKind[]).map((value) => (
        <div className="type-choice-row" key={value}>
          <label className="type-choice">
            <input
              type="radio"
              name={id}
              value={value}
              checked={kind === value}
              onChange={() => onChange(value)}
            />
            <span>{objectiveTypes[value].label}</span>
          </label>
          {recommended === value && (
            <span className="muted">(recommended)</span>
          )}
          <TypeInfo kind={value} />
        </div>
      ))}
    </fieldset>
  );
}
