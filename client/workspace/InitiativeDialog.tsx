import { useState } from "react";
import type { DirectionDraft } from "../../shared/direction.js";
import { initiativeColors, initiativeIcons, isPresetAppearance, validateInitiativeAppearance } from "../../shared/initiative-appearance.js";
import type { InitiativeAppearance } from "../../shared/initiative-appearance.js";
import { Dialog } from "./Dialog.js";
import { InitiativeIdentity, InitiativeIconGraphic, initiativeIconLabels } from "./InitiativeIdentity.js";

type Initiative = DirectionDraft["initiatives"][number];
export function InitiativeDialog({ initial, onClose, onSave }: {
  initial?: Initiative; onClose: () => void; onSave: (initiative: Initiative) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [appearance, setAppearance] = useState<InitiativeAppearance | undefined>(initial?.appearance);
  const color = initiativeColors.find(option => option.value === appearance?.color)?.value ?? "#526578";
  function choose(next: InitiativeAppearance | undefined) { setAppearance(next); }
  return <Dialog title={initial ? "Edit initiative" : "Add initiative"}
    saveLabel={initial ? "Update initiative" : "Add initiative"} onClose={onClose}
    onSave={async () => {
      if (!name.trim()) throw new Error("Enter an initiative name.");
      const { appearance: _previousAppearance, ...existing } = initial ?? { archived: false };
      onSave({ ...existing, name: name.trim(),
        ...(appearance ? { appearance: validateInitiativeAppearance(appearance) } : {}) });
    }}>
    <div className="initiative-editor">
      <label htmlFor="initiative-name">Initiative name</label>
      <input id="initiative-name" name="name" autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)} />
      <div className="initiative-palette-layout">
        <div>
          <fieldset className="initiative-palette">
            <legend>Icon</legend>
            <div className="initiative-icon-grid">{initiativeIcons.map(icon =>
              <button type="button" key={icon} aria-label={initiativeIconLabels[icon]} aria-pressed={appearance?.icon === icon}
                onClick={() => choose({ color, icon })}><InitiativeIconGraphic icon={icon} /></button>)}</div>
          </fieldset>
          {(appearance?.icon || appearance?.svg) && <button type="button" className="link" onClick={() => choose({ color })}>Remove icon</button>}
        </div>
        <div>
          <fieldset className="initiative-palette">
            <legend>Initiative color</legend>
            <div className="initiative-swatches">{initiativeColors.map(swatch =>
              <button type="button" key={swatch.value} aria-label={swatch.name} aria-pressed={appearance?.color === swatch.value}
                style={{ backgroundColor: swatch.value }} onClick={() => choose({ ...(appearance?.icon ? { icon: appearance.icon } : {}), color: swatch.value })} />)}</div>
          </fieldset>
          <h3 className="initiative-preview-title">Preview</h3>
          <div className="initiative-preview" aria-label="Appearance preview" role="group">
            <InitiativeIdentity name={name || "Initiative name"} appearance={appearance} />
          </div>
          {appearance && <button type="button" className="link" onClick={() => choose(undefined)}>Clear appearance</button>}
        </div>
      </div>
      {appearance && !isPresetAppearance(appearance) && <p className="muted">This initiative uses an earlier appearance. Selecting a preset will replace it.</p>}
      <p className="muted">Use Save changes on the panel to save this initiative with the mission.</p>
    </div>
  </Dialog>;
}
