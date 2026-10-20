import { useId, useState } from "react";

export function MissionBanner({ mission, storageKey }: { mission: string; storageKey?: string }) {
  const contentId = useId(), headingId = useId();
  const [expanded, setExpanded] = useState(() => {
    try { return !storageKey || localStorage.getItem(storageKey) !== "false"; }
    catch { return true; }
  });
  if (!mission) return null;
  return (
    <section className={`mission-banner ${expanded ? "expanded" : "collapsed"}`} aria-labelledby={headingId}>
      <span className="mission-quote" aria-hidden="true">“</span>
      <div className="mission-body">
        <h2 id={headingId}>Our mission</h2>
        <p id={contentId} hidden={!expanded}>{mission}</p>
      </div>
      <button type="button" aria-controls={contentId} aria-expanded={expanded} onClick={() => {
        const next = !expanded;
        setExpanded(next);
        try { if (storageKey) localStorage.setItem(storageKey, String(next)); } catch { /* The current visit still works without storage. */ }
      }}>
        {expanded ? "Hide mission" : "Show mission"} <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
    </section>
  );
}
