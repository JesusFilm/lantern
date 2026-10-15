import { Fragment, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { SessionView } from "../shared/access.js";
import { api } from "./workspace/api.js";
import { FocusWorkspace } from "./workspace/FocusWorkspace.js";
import { LearningGuide } from "./workspace/LearningGuide.js";
import { Account } from "./workspace/Account.js";
import { Department } from "./workspace/Department.js";
import "./workspace/style.css";
function App() {
  const [session, setSession] = useState<SessionView>(),
    [error, setError] = useState(""),
    [page, setPage] = useState("focuses");
  const refreshVersion = useRef(0);
  async function refresh() {
    const version = ++refreshVersion.current;
    try {
      const next = await api<SessionView>("/api/session");
      if (version !== refreshVersion.current) return;
      setSession(next);
      setError("");
    } catch (e) {
      if (version === refreshVersion.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
    const run = () => void refresh();
    window.addEventListener("focus", run);
    return () => window.removeEventListener("focus", run);
  }, []);
  return (
    <>
      <aside>
        <div className="brand">Lantern</div>
        <nav aria-label="Main navigation">
          {[
            ["focuses", "Position focuses"],
            ["guide", "Guide"],
            ["account", "Account"],
            ...(!session?.localAccess
              ? [["department", "Department users"]]
              : []),
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id!)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="aside-foot">
          {session?.department?.name}
          <br />
          {session?.user?.name}
        </div>
      </aside>
      <main className="main">
        <div className="workspace">
          {error && (
            <p role="alert">
              {error}
              <button onClick={() => void refresh()}>Try again</button>
            </p>
          )}
          {!session ? (
            <p role="status">Loading…</p>
          ) : !session.user ? (
            <section>
              <h1>Welcome to Lantern</h1>
              {session.signInAvailable ? (
                <a href="/auth/google">Sign in with Google</a>
              ) : (
                <p>Sign-in is awaiting configuration.</p>
              )}
            </section>
          ) : (
            <Fragment
              key={`${session.user.id}:${session.department?.id ?? ""}:${session.department?.role ?? ""}`}
            >
              {!session.localAccess && (
                <button
                  className="sign-out"
                  onClick={() =>
                    void api("/api/sign-out", "POST", {})
                      .then(refresh)
                      .catch((e) => setError(e.message))
                  }
                >
                  Sign out
                </button>
              )}
              {page === "account" ? (
                <Account
                  user={session.user}
                  onChange={(user) =>
                    setSession((current) =>
                      current?.user?.id === user.id
                        ? { ...current, user }
                        : current,
                    )
                  }
                />
              ) : !session.department ? (
                <section>
                  <h1>Your account is ready</h1>
                  <p>
                    Contact your career lead directly and ask them to add you to
                    your department.
                  </p>
                  <button onClick={() => void refresh()}>Check access</button>
                </section>
              ) : page === "focuses" ? (
                <FocusWorkspace />
              ) : page === "department" ? (
                <Department
                  session={{ ...session, department: session.department }}
                />
              ) : (
                <LearningGuide onFocuses={() => setPage("focuses")} />
              )}
            </Fragment>
          )}
        </div>
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
