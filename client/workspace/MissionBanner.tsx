import { useId } from "react";

export function MissionBanner({ mission }: { mission: string }) {
  const headingId = useId();
  if (!mission) return null;
  return (
    <section className="mission-banner" aria-labelledby={headingId}>
      <span className="mission-quote" aria-hidden="true">“</span>
      <div className="mission-body">
        <h2 id={headingId}>Our mission</h2>
        <p>{mission}</p>
      </div>
      <img className="mission-art" src="/mission-jesus-geometric.png" alt="" width="240" height="240" />
    </section>
  );
}
