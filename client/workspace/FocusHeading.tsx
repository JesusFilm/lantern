import { useState } from "react";
import type { PositionFocus } from "../../shared/focus.js";
import { FocusConfirmation } from "./FocusConfirmation.js";
import { usePhoneLayout } from "./usePhoneLayout.js";
const date = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("en-NZ", {
  day: "numeric", month: "short", year: "numeric",
});

export function FocusHeading({ focus, member, onBack, onMetadata, onConfirmed }: {
  focus: PositionFocus;
  member: { id: string; name: string };
  onBack: () => void;
  onMetadata?: () => void;
  onConfirmed?: (focus: PositionFocus) => void;
}) {
  const phone = usePhoneLayout();
  const [details, setDetails] = useState(false);
  const period = <p className="muted">{date(focus.start)} – {date(focus.end)}</p>;
  const edit = focus.status === "draft" && onMetadata && <button onClick={onMetadata}>Edit title & dates</button>;
  const confirmation = <FocusConfirmation focus={focus} member={member} onConfirmed={onConfirmed} />;
  return phone ? <div className="phone-focus-heading">
    <div className="focus-context-row">
      <button className="link back" onClick={onBack}>← Position focuses</button>
      <button className="link" aria-expanded={details} aria-controls="focus-details" onClick={() => setDetails(!details)}>
        {focus.status === "draft" ? "Draft" : "Confirmed"} · details
      </button>
    </div>
    <h1>{focus.title}</h1>
    <div id="focus-details" hidden={!details}>
      {period}{edit}{confirmation}
    </div>
  </div> : <>
    <button className="link back" onClick={onBack}>← Position focuses</button>
    <header><div><h1>{focus.title}</h1>{period}</div>{edit}</header>
    {confirmation}
  </>;
}
