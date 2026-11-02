import { useId, type Ref } from "react";
import type { PositionFocus } from "../../shared/focus.js";
import type { EditTarget } from "./useDraftFocusWorkflow.js";
import { AlignmentSummary } from "./InitiativeChoices.js";
import { ObjectiveType } from "./ObjectiveType.js";
import { formatFocusDate } from "./focusDate.js";

type DocumentAction = (target: EditTarget, source: PositionFocus) => void;
interface DocumentProps {
  focus: PositionFocus;
  onEdit?: DocumentAction;
  onGuide?: DocumentAction;
}

/** Actions always carry the exact document snapshot the member is reading. */
export function FocusObjective({
  focus,
  index,
  onEdit,
  onGuide,
  hidden,
  headingRef,
}: DocumentProps & {
  index: number;
  hidden?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const id = useId();
  const section = focus.sections[index]!;
  const editable = focus.status === "draft" && !!onEdit;
  return (
    <section className="read-section" aria-labelledby={id} hidden={hidden}>
      <div className="read-objective">
        <div className="row section-heading">
          <div className="section-label">
            <h2 id={id} tabIndex={-1} ref={headingRef}>
              Objective {index + 1}
            </h2>
            <ObjectiveType kind={section.kind} />
          </div>
          {editable && (
            <div className="section-tools">
              <button
                className="link edit-action"
                onClick={() =>
                  onEdit({ type: "objective", section: index }, focus)
                }
              >
                Edit objective
              </button>
              {onGuide && (
                <button
                  className="link"
                  onClick={() =>
                    onGuide({ type: "objective", section: index }, focus)
                  }
                >
                  Guide with AI
                </button>
              )}
              <button
                className="link danger small-action"
                onClick={() =>
                  onEdit({ type: "remove-objective", section: index }, focus)
                }
              >
                Remove
              </button>
            </div>
          )}
        </div>
        <p className="read-text">{section.objective}</p>
        <AlignmentSummary alignment={section.alignment} />
      </div>
      <div className="read-goals">
        <h3 id={id + "-goals"}>SMART goals</h3>
        {section.goals.length ? (
          <ol className="read-goal-list" aria-labelledby={id + "-goals"}>
            {section.goals.map((goal, goalIndex) => (
              <li className="read-goal" key={goalIndex}>
                <span className="goal-number" aria-hidden="true">
                  {goalIndex + 1}
                </span>
                <p className="read-text">{goal}</p>
                {editable && (
                  <div className="goal-tools">
                    <button
                      className="link"
                      onClick={() =>
                        onEdit(
                          { type: "goal", section: index, goal: goalIndex },
                          focus,
                        )
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="link danger small-action"
                      onClick={() =>
                        onEdit(
                          {
                            type: "remove-goal",
                            section: index,
                            goal: goalIndex,
                          },
                          focus,
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No goals yet.</p>
        )}
        {editable && (
          <button
            className="link"
            onClick={() =>
              onEdit({ type: "goal", section: index, adding: true }, focus)
            }
          >
            + Add SMART goal
          </button>
        )}
      </div>
    </section>
  );
}

export function FocusDocument({
  focus,
  onEdit,
  onGuide,
  showPeriod = true,
}: DocumentProps & { showPeriod?: boolean }) {
  return (
    <div className="focus-document cp-document">
      {showPeriod && (
        <p className="focus-period muted">
          <time dateTime={focus.start}>{formatFocusDate(focus.start)}</time> –{" "}
          <time dateTime={focus.end}>{formatFocusDate(focus.end)}</time>
        </p>
      )}
      {focus.sections.map((_, index) => (
        <FocusObjective
          key={index}
          focus={focus}
          index={index}
          onEdit={onEdit}
          onGuide={onGuide}
        />
      ))}
      {!focus.sections.length && <p className="muted">No objectives yet.</p>}
    </div>
  );
}
