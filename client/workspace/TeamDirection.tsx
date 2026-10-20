import { useEffect, useState } from "react";
import type { DepartmentDirection, DirectionDraft } from "../../shared/direction.js";
import { api } from "./api.js";
import { InitiativeDialog } from "./InitiativeDialog.js";
import { InitiativeIdentity } from "./InitiativeIdentity.js";
import { MissionBanner } from "./MissionBanner.js";

export function TeamDirection() {
  const [saved, setSaved] = useState<DepartmentDirection>();
  const [draft, setDraft] = useState<DirectionDraft>();
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState<number>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void api<DepartmentDirection>("/api/department/direction").then(value => {
      if (active) { setSaved(value); setDraft(value); }
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attempt]);
  function change(next: DirectionDraft) { setDraft(next); setNotice(""); setError(""); }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  return (
    <>
      {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => {
        setNotice(""); setAttempt(n => n + 1);
      }}>Reload saved settings</button></p>}
      {!draft ? !error && <p role="status">Loading team direction…</p> : (
        <form className="team-direction" onSubmit={event => {
          event.preventDefault();
          if (busy) return;
          setBusy(true); setError(""); setNotice("");
          void api<DepartmentDirection>("/api/department/direction", "PUT", draft).then(value => {
            setSaved(value); setDraft(value); setNotice("Team direction saved.");
          }).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
        }}>
          <fieldset className="direction-fields" disabled={busy}>
            <section className="card mission-editor">
              <h2><label htmlFor="organizational-mission">Organizational mission</label></h2>
              <p className="muted">A short reminder on Position Focuses. Leave blank to hide the banner.</p>
              <textarea id="organizational-mission" maxLength={1000} rows={3} value={draft.mission}
                onChange={event => change({ ...draft, mission: event.target.value })} />
              <button type="button" className="link" aria-expanded={preview} disabled={!draft.mission.trim()}
                onClick={() => setPreview(value => !value)}>{preview ? "Close preview" : "Preview banner"}</button>
              {preview && <MissionBanner mission={draft.mission.trim()} />}
            </section>
            <section className="card">
              <div className="row">
                <h2>Strategic initiatives</h2>
                <button type="button" className="primary" disabled={draft.initiatives.length >= 100}
                  onClick={() => setEditing(draft.initiatives.length)}>Add initiative</button>
              </div>
              <p className="muted">Members can select more than one for each objective.</p>
              {draft.initiatives.length ? <div className="initiative-table-scroll"><table className="initiative-table">
                <thead><tr><th>Initiative</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>{draft.initiatives.map((item, index) => <tr key={item.id ?? `new-${index}`}>
                  <td><InitiativeIdentity name={item.name} appearance={item.appearance} /></td>
                  <td><span className={`badge ${item.archived ? "archived" : ""}`}>{item.archived ? "Archived" : "Active"}</span></td>
                  <td><div className="initiative-actions">
                    <button type="button" className="link" aria-label={`Edit ${item.name}`} onClick={() => setEditing(index)}>Edit</button>
                    <button type="button" className="link" aria-label={`${item.archived ? "Restore" : "Archive"} ${item.name}`} onClick={() =>
                      change({ ...draft, initiatives: draft.initiatives.map((entry, i) => i === index ? { ...entry, archived: !entry.archived } : entry) })
                    }>{item.archived ? "Restore" : "Archive"}</button>
                  </div></td>
                </tr>)}</tbody>
              </table></div> : <p className="empty-base">No initiatives yet. Add one when your team has agreed its priorities.</p>}
              <p className="muted initiative-help">“Other — none of these apply” is always included. Archiving removes an initiative from new selections and preserves existing objectives.</p>
            </section>
            <div className="direction-save">
              <span className="muted">{dirty ? "Unsaved changes" : "Changes saved"}</span>
              <button type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved); setError(""); setNotice(""); }}>Cancel</button>
              <button className="primary" disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </fieldset>
          {notice && <p role="status">{notice}</p>}
        </form>
      )}
      {draft && editing !== undefined && <InitiativeDialog initial={draft.initiatives[editing]}
        onClose={() => setEditing(undefined)}
        onSave={initiative => {
          if (!initiative.archived && draft.initiatives.some((item, index) => index !== editing && !item.archived && item.name.toLowerCase() === initiative.name.toLowerCase()))
            throw new Error("An active initiative already has this name.");
          const initiatives = [...draft.initiatives];
          initiatives[editing] = initiative;
          change({ ...draft, initiatives }); setEditing(undefined);
        }} />}
    </>
  );
}
