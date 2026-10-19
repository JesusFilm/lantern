import { useState } from "react";
import type { PositionFocus } from "../../shared/focus.js";
import { Dialog } from "./Dialog.js";
import { api } from "./api.js";

function LockIcon() {
  return <svg className="lock-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="10" width="14" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
  </svg>;
}
const date = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("en-NZ", {
  day: "numeric", month: "short", year: "numeric",
});

export function FocusConfirmation({
  focus,
  member,
  onConfirmed,
}: {
  focus: PositionFocus;
  member: { id: string; name: string };
  onConfirmed?: (focus: PositionFocus) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (focus.status === "confirmed")
    return (
      <p className="muted" role="status">
        Confirmed by {focus.confirmedBy?.name} on{" "}
        {new Date(focus.confirmedAt!).toLocaleString("en-NZ")}. This agreed focus
        is read-only.
      </p>
    );
  return (
    <>
      <div className="focus-confirmation-row">
      <span className="focus-draft">Draft</span>
      {onConfirmed && (
        <button className="primary button-with-icon" onClick={() => setConfirming(true)}>
          <LockIcon />Confirm and lock
        </button>
      )}
      </div>
      {confirming && (
        <Dialog
          title="Confirm and lock this focus?"
          saveLabel="Confirm and lock"
          saveIcon={<LockIcon />}
          onClose={() => setConfirming(false)}
          onSave={async () => {
            const saved = await api<PositionFocus>(
              `/api/department/members/${encodeURIComponent(member.id)}/focuses/${encodeURIComponent(focus.id)}/confirm`,
              "POST",
              { version: focus.version },
            );
            onConfirmed?.(saved);
            setConfirming(false);
          }}
        >
          <p>Confirm after your discussion with {member.name}.</p>
          <div className="confirmation-summary">
            <h3>Focus summary</h3>
            <dl>
              <dt>Person</dt><dd><strong>{member.name}</strong></dd>
              <dt>Focus</dt><dd>{focus.title}</dd>
              <dt>Dates</dt><dd>{date(focus.start)} – {date(focus.end)}</dd>
            </dl>
          </div>
          <section className="confirmation-warning" aria-labelledby="lock-warning-title">
            <LockIcon />
            <div>
              <h3 id="lock-warning-title">This focus will become read-only.</h3>
              <p>Locks the title, dates, objectives and goals for both of you.</p>
              <p>It cannot be edited or unlocked here.</p>
            </div>
          </section>
        </Dialog>
      )}
    </>
  );
}
