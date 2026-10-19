import { useState } from "react";
import type { PositionFocus } from "../../shared/focus.js";
import { Dialog } from "./Dialog.js";
import { api } from "./api.js";

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
      <p className="muted">Draft</p>
      {onConfirmed && (
        <button className="primary" onClick={() => setConfirming(true)}>
          Confirm and lock
        </button>
      )}
      {confirming && (
        <Dialog
          title="Confirm this agreed focus?"
          saveLabel="Confirm and lock"
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
          <p>Confirm “{focus.title}” for {member.name} after your discussion.</p>
          <p>
            This locks the title, dates, objectives and goals for both of you.
            The agreed focus cannot be edited or unlocked here.
          </p>
        </Dialog>
      )}
    </>
  );
}
