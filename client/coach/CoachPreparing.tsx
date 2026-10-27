import { useEffect, useRef, useState } from "react";

export type CoachStage = "clarify" | "objective" | "actions" | "goal";
const labels: Record<CoachStage, string> = {
  clarify: "Finding the next useful question",
  objective: "Shaping your objective",
  actions: "Exploring possible next steps",
  goal: "Putting your goal into words",
};

export function CoachPreparing({
  stage,
  onBack,
}: {
  stage: CoachStage | null;
  onBack: () => void;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const [lastStage, setLastStage] = useState<CoachStage>("clarify");
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const dialog = panel.current;
    if (!stage) {
      setVisible(false);
      // Let the overlay fade off the retained screen instead of disappearing abruptly.
      const timer = setTimeout(() => dialog?.close(), 150);
      return () => clearTimeout(timer);
    }
    setLastStage(stage);
    setSeconds(0);
    if (!dialog?.open) dialog?.showModal();
    dialog?.focus({ preventScroll: true });
    setVisible(true);
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [stage]);
  useEffect(() => {
    const dialog = panel.current;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={panel}
      tabIndex={-1}
      className="cp-coach-wait"
      data-visible={visible}
      aria-labelledby="coach-preparing-title"
      onCancel={(event) => {
        event.preventDefault();
        if (stage) onBack();
      }}
      onClose={() =>
        document
          .querySelector<HTMLFieldSetElement>(".cp-fields")
          ?.focus({ preventScroll: true })
      }
    >
      <div className="cp-wait-content">
        <span className="cp-wait-spinner" aria-hidden="true" />
        <div role="status" aria-live="polite" aria-atomic="true">
          <h2 id="coach-preparing-title">{labels[stage ?? lastStage]}</h2>
          {seconds >= 15 && (
            <p className="cp-wait-detail">Taking a little longer…</p>
          )}
        </div>
      </div>
      <div className="cp-wait-footer">
        <span className="cp-wait-time" aria-live="off">
          {seconds}s elapsed
        </span>
        <button className="link" disabled={!stage} onClick={onBack}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
