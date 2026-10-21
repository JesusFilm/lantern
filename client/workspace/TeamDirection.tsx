import { CircleEllipsis } from "lucide-react";
import { MissionImageDialog } from "./MissionImageDialog.js";
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
  const [busy, setBusy] = useState(false), [choosingImage, setChoosingImage] = useState(false);
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
              <h2>Organizational mission</h2>
              <p className="muted">A short reminder on Position focuses. Leave blank to hide the banner.</p>
              <div className="mission-editor-preview">
                {draft.mission.trim() ? <MissionBanner mission={draft.mission.trim()} image={draft.missionImage}
                  onChooseImage={() => setChoosingImage(true)} /> : <div className="mission-empty-preview">
                  <p>The banner is hidden while the mission statement is blank.</p>
                  <button type="button" onClick={() => setChoosingImage(true)}>Choose banner image</button>
                </div>}
              </div>
              <label htmlFor="organizational-mission">Mission statement</label>
              <textarea id="organizational-mission" aria-label="Organizational mission" maxLength={1000} rows={3} value={draft.mission}
                onChange={event => change({ ...draft, mission: event.target.value })} />
              <p className="muted">Change the image directly in the preview. The whole image fits without cropping.</p>
            </section>
            <section className="card">
              <div className="row">
                <h2>Strategic initiatives</h2>
                <button type="button" className="primary" disabled={draft.initiatives.length >= 100}
                  onClick={() => setEditing(draft.initiatives.length)}>Add initiative</button>
              </div>
              <div className="initiative-table-scroll"><table className="initiative-table">
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
                </tr>)}
                <tr>
                  <td><span className="initiative-identity initiative-other-identity"><span className="initiative-mark" aria-hidden="true"><CircleEllipsis size={20} /></span><span>Other</span></span></td>
                  <td></td><td></td>
                </tr></tbody>
              </table></div>
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
      {draft && choosingImage && <MissionImageDialog initial={draft.missionImage}
        onClose={() => setChoosingImage(false)} onSave={missionImage => {
          change({ ...draft, missionImage }); setChoosingImage(false);
        }} />}
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
