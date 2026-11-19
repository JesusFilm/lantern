import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from 'lucide-react';
export function Dialog({
  title,
  children,
  onSave,
  onClose,
  saveLabel = "Save changes",
  saveIcon,
  saveDisabled = false,
  fullScreen = false,
  closeLabel = 'Close dialog',
}: {
  title: string;
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
  saveLabel?: string;
  saveIcon?: ReactNode;
  saveDisabled?: boolean;
  fullScreen?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={fullScreen ? 'fullscreen-dialog' : undefined}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || saveDisabled) return;
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          void onSave(data)
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {fullScreen ? <div className="dialog-heading"><h2 id="dialog-title">{title}</h2>
          <button type="button" className="dialog-close" aria-label={closeLabel} disabled={busy} onClick={onClose}><X size={24} /></button>
        </div> : <h2 id="dialog-title">{title}</h2>}
        <div className="dialog-content">
          <fieldset disabled={busy} className="dialog-fields">
            {children}
          </fieldset>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className={saveIcon ? "primary button-with-icon" : "primary"} disabled={busy || saveDisabled}>
            {!busy && saveIcon}
            {busy ? "Saving…" : saveLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
