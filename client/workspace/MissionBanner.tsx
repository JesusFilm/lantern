import { useId } from "react";
import { DEFAULT_MISSION_IMAGE } from "../../shared/mission-image.js";

export function MissionBanner({ mission, image = DEFAULT_MISSION_IMAGE, onChooseImage }: {
  mission: string; image?: string | null; onChooseImage?: () => void;
}) {
  const headingId = useId();
  if (!mission) return null;
  return (
    <section className="mission-banner" aria-labelledby={headingId}>
      <span className="mission-quote" aria-hidden="true">“</span>
      <div className="mission-body">
        <h2 id={headingId}>Our mission</h2>
        <p>{mission}</p>
      </div>
      {(image || onChooseImage) && <div className={`mission-art-slot${onChooseImage ? " editable" : ""}`}>
        {image ? <img className={`mission-art${image === DEFAULT_MISSION_IMAGE ? " default-mission-art" : ""}`}
          src={image} alt="" width="240" height="240" /> : <span className="muted">No image</span>}
        {onChooseImage && <button type="button" onClick={onChooseImage}>Change image</button>}
      </div>}
    </section>
  );
}
