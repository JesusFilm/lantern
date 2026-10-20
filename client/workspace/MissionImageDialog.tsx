import { useEffect, useRef, useState } from "react";
import { DEFAULT_MISSION_IMAGE } from "../../shared/mission-image.js";
import { Dialog } from "./Dialog.js";
import { prepareMissionImage } from "./mission-image.js";

export function MissionImageDialog({ initial, onClose, onSave }: {
  initial?: string | null; onClose: () => void; onSave: (image: string | null) => void;
}) {
  const [image, setImage] = useState(initial === undefined ? DEFAULT_MISSION_IMAGE : initial);
  const [processing, setProcessing] = useState(false), [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  function choose(value: string | null) { generation.current++; setImage(value); setProcessing(false); setError(""); }
  return <Dialog title="Banner image" saveLabel="Use image" saveDisabled={processing || !!error}
    onClose={onClose} onSave={async () => { onSave(image); }}>
    <div className="mission-image-dialog">
      <p className="muted">Choose a portrait, seasonal illustration or another image for your mission.</p>
      {image ? <img className={image === DEFAULT_MISSION_IMAGE ? "default-mission-art" : ""} src={image} alt="Selected banner image" />
        : <p className="empty-base">No image selected</p>}
      <label htmlFor="mission-image-file">Choose image</label>
      <input id="mission-image-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.target.files?.[0];
        if (!file) return;
        const current = ++generation.current;
        setProcessing(true); setError("");
        void prepareMissionImage(file).then(value => { if (current === generation.current) setImage(value); })
          .catch((e: Error) => { if (current === generation.current) setError(e.message); })
          .finally(() => { if (current === generation.current) setProcessing(false); });
      }} />
      <p className="muted">PNG, JPEG or WebP, up to 10 MB and 16 million pixels. Images are resized automatically.</p>
      <div className="row"><button type="button" onClick={() => choose(DEFAULT_MISSION_IMAGE)}>Use default</button>
        <button type="button" onClick={() => choose(null)}>Remove image</button></div>
      {processing && <p role="status">Preparing image…</p>}
      {error && <p role="alert">{error}</p>}
      <p className="muted">The whole image fits without cropping or stretching. Use Save changes on the department panel to save it.</p>
    </div>
  </Dialog>;
}
