import { ObjectiveType } from "./ObjectiveType.js";
import { useEffect, useRef, useState } from "react";
import type { ObjectiveKind, PositionFocus } from "../../shared/focus.js";
import type { EditTarget } from "./useDraftFocusWorkflow.js";
import { AlignmentSummary } from "./InitiativeChoices.js";
import { useSwipeNavigation } from "./useSwipeNavigation.js";
import { usePhoneLayout } from "./usePhoneLayout.js";
/** Reading state belongs to this document; edits still use original section indices. */
export function FocusObjectives({ focus, onEdit, onCoach }: {
  focus: PositionFocus;
  onEdit: (target: EditTarget) => void;
  onCoach?: (target: EditTarget) => void;
}) {
  const compact = usePhoneLayout();
  const [index, setIndex] = useState(0);
  const [all, setAll] = useState(false);
  const count = focus.sections.length;
  const active = Math.min(index, Math.max(0, count - 1));
  const editable = focus.status === "draft";
  const heading = useRef<HTMLHeadingElement>(null);
  const previousCount = useRef(count);
  const interacted = useRef(false);
  function move(next: number) {
    interacted.current = true;
    setAll(false);
    setIndex(Math.max(0, Math.min(next, count - 1)));
  }
  useEffect(() => {
    if (count > previousCount.current) move(count - 1);
    else if (count < previousCount.current) move(active);
    previousCount.current = count;
  }, [count]);
  useEffect(() => {
    if (compact && interacted.current && !all) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest(".focus-objectives")?.scrollIntoView({ block: "start" });
    }
  }, [active, all, compact, count]);
  const swipe = useSwipeNavigation(compact && !all && count > 1,
    () => move(active - 1), () => move(active + 1));
  return (
    <div className={"focus-objectives" + (compact && count > 1 && !all ? " is-paged" : "")} {...swipe}>
      {compact && count > 1 && <div className="objective-chooser">
        <label htmlFor="read-objectives">Read objectives {!all && <span aria-hidden="true">· swipe to move</span>}</label>
        <select id="read-objectives" value={all ? "all" : active} onChange={event => {
          if (event.target.value === "all") setAll(true);
          else move(Number(event.target.value));
        }}>
          {focus.sections.map((section, i) => <option key={i} value={i}>
            Objective {i + 1} of {count} · {section.objective.slice(0, 70)}
          </option>)}
          <option value="all">Full document · all {count} objectives</option>
        </select>
      </div>}
      {focus.sections.length ? (
        focus.sections.map((section, i) => (
          <section className="read-section" key={i} hidden={compact && !all && i !== active}>
            <div className="read-objective">
              <div className="row section-heading">
                <div className="section-label">
                  <h2 tabIndex={-1} ref={i === active ? heading : undefined}>Objective {i + 1}</h2>
                  <ObjectiveType kind={section.kind}/>
                </div>
                {editable && <div className="section-tools">
                  <button
                    className="link edit-action"
                    aria-label="Edit objective"
                    onClick={() =>
                      onEdit({ type: "objective", section: i })
                    }
                  >
                    {compact ? "Edit" : "Edit objective"}
                  </button>
                  {onCoach && <button className="link" onClick={() => onCoach({type:"objective",section:i})}>Coach</button>}
                  <button
                    className="link danger small-action"
                    onClick={() =>
                      onEdit({ type: "remove-objective", section: i })
                    }
                  >
                    Remove
                  </button>
                </div>}
              </div>
              <p className="read-text">{section.objective}</p>
              <AlignmentSummary alignment={section.alignment} />
            </div>
            <div className="read-goals">
              <h3>SMART goals</h3>
              {section.goals.map((goal, j) => (
                <div className="read-goal" key={j}>
                  <span className="goal-number">{j + 1}</span>
                  <p className="read-text">{goal}</p>
                  {editable && <div>
                    <button
                      className="link"
                      onClick={() =>
                        onEdit({ type: "goal", section: i, goal: j })
                      }
                    >
                      Edit
                    </button>
                    {onCoach && <button className="link" onClick={() => onCoach({type:"goal",section:i,goal:j})}>Coach</button>}
                    <button
                      className="link danger small-action"
                      onClick={() =>
                        onEdit({
                          type: "remove-goal",
                          section: i,
                          goal: j,
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>}
                </div>
              ))}
              {!section.goals.length && (
                <p className="muted">No goals yet.</p>
              )}
              {editable && <button
                className="link"
                onClick={() =>
                  onEdit({ type: "goal", section: i, adding: true })
                }
              >
                + Add SMART goal
              </button>}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-base">
          <h2 ref={heading} tabIndex={-1}>A blank position focus</h2>
          <p>Add your first objective when you’re ready.</p>
          <button
            className="primary"
            onClick={() =>
              onEdit({ type: "objective", section: 0, adding: true })
            }
          >
            Add objective
          </button>
        </div>
      )}
      {editable && <div className="editor-actions">
        <button
          onClick={() =>
            onEdit({
              type: "objective",
              section: focus.sections.length,
              adding: true,
            })
          }
        >
          + Add objective
        </button>
      </div>}
      {compact && count > 1 && !all && <div className="objective-pager" role="navigation" aria-label="Objective navigation">
        <button aria-label="Previous objective" disabled={active === 0} onClick={() => move(active - 1)}>← Previous</button>
        <span role="status">{active + 1} / {count}</span>
        <button aria-label="Next objective" disabled={active === count - 1} onClick={() => move(active + 1)}>Next →</button>
      </div>}
    </div>
  );
}
