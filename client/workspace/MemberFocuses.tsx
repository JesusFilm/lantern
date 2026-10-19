import { useEffect, useState } from "react";
import type { MemberFocusList, MemberFocusDetail } from "../../shared/focus.js";
import { FocusConfirmation } from "./FocusConfirmation.js";
import { api } from "./api.js";

const date = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const labels = {
  normal: "Normal Objectives",
  "personal-development": "Personal Development Objectives",
  leadership: "Leadership Objectives",
};

export function MemberFocuses({
  memberId,
  focusId,
  navigate,
}: {
  memberId: string;
  focusId: string | null;
  navigate: (member?: string, focus?: string) => void;
}) {
  const [data, setData] = useState<MemberFocusList | MemberFocusDetail>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError("");
    const path =
      `/api/department/members/${encodeURIComponent(memberId)}/focuses` +
      (focusId ? `/${encodeURIComponent(focusId)}` : "");
    void api<MemberFocusList | MemberFocusDetail>(path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [memberId, focusId, attempt]);
  return (
    <section>
      <button className="link back" onClick={() => navigate()}>
        ← Department users
      </button>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </p>
      ) : !data ? (
        <p role="status">Loading member focuses…</p>
      ) : (
        <>
          <p className="eyebrow">
            {data.member.name} · {data.member.email}
          </p>
          {"focus" in data ? (
            <>
              <button className="link back" onClick={() => navigate(memberId)}>
                ← {data.member.name}’s position focuses
              </button>
              <header>
                <div>
                  <h1>{data.focus.title}</h1>
                  <p className="muted">
                    {date(data.focus.start)} – {date(data.focus.end)}
                  </p>
                </div>
              </header>
              <p className="muted">Read-only member focus</p>
              <FocusConfirmation key={data.focus.id} focus={data.focus} member={data.member}
                onConfirmed={(focus) => setData({member: data.member, focus})} />
              {data.focus.sections.map((section, i) => (
                <section className="read-section" key={i}>
                  <div className="read-objective">
                    <h2>Objective {i + 1}</h2>
                    <span className="badge">{labels[section.kind]}</span>
                    <p className="read-text">{section.objective}</p>
                  </div>
                  <div className="read-goals">
                    <h3>SMART goals</h3>
                    {section.goals.map((goal, j) => (
                      <div className="read-goal" key={j}>
                        <span className="goal-number">{j + 1}</span>
                        <p className="read-text">{goal}</p>
                      </div>
                    ))}
                    {!section.goals.length && (
                      <p className="muted">No goals yet.</p>
                    )}
                  </div>
                </section>
              ))}
              {!data.focus.sections.length && <p>No objectives yet.</p>}
            </>
          ) : (
            <>
              <h1>{data.member.name}’s position focuses</h1>
              <p>{data.member.email}</p>
              {data.focuses.length ? (
                <table className="focus-list">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.focuses.map((focus) => (
                      <tr key={focus.id}>
                        <td>
                          <button onClick={() => navigate(memberId, focus.id)}>
                            {focus.title}
                          </button>
                        </td>
                        <td>
                          {date(focus.start)} – {date(focus.end)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No position focuses yet.</p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
