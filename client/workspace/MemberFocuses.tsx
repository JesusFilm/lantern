import { useEffect, useState } from "react";
import type { MemberFocusList, MemberFocusDetail } from "../../shared/focus.js";
import { FocusConfirmation } from "./FocusConfirmation.js";
import { api } from "./api.js";
import { FocusDocument } from "./FocusDocument.js";
import { formatFocusDate as date } from "./focusDate.js";

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
    <section className={focusId ? "member-focus-detail" : undefined}>
      {!focusId && (
        <button className="link back" onClick={() => navigate()}>
          ← Department
        </button>
      )}
      {error ? (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </p>
      ) : !data ? (
        <p role="status">Loading member focuses…</p>
      ) : (
        <>
          {"focus" in data ? (
            <>
              <div className="member-context">
                <div className="member-identity">
                  <span className="member-initials" aria-hidden="true">
                    {data.member.name
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <div>
                    <strong>{data.member.name}</strong>
                    <span className="muted">Member</span>
                  </div>
                </div>
                <button className="link" onClick={() => navigate(memberId)}>
                  View all position focuses <span aria-hidden="true">→</span>
                </button>
              </div>
              <header>
                <div>
                  <h1>{data.focus.title}</h1>
                  <p className="muted">
                    {date(data.focus.start)} – {date(data.focus.end)}
                  </p>
                </div>
              </header>
              <FocusConfirmation
                key={data.focus.id}
                focus={data.focus}
                member={data.member}
                onConfirmed={(focus) => setData({ member: data.member, focus })}
              />
              <FocusDocument focus={data.focus} showPeriod={false} />
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
