import { Fragment, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { SessionView } from "../shared/access.js";
import { api } from "./workspace/api.js";
import { FocusWorkspace } from "./workspace/FocusWorkspace.js";
import { LearningGuide } from "./workspace/LearningGuide.js";
import { Account } from "./workspace/Account.js";
import { Department } from "./workspace/Department.js";
import "./workspace/style.css";
function currentPage() {
  const page = new URLSearchParams(location.search).get("page");
  return page === "department" || page === "guide" || page === "account"
    ? page
    : "focuses";
}
function navigatePage(page: string) {
  const url = new URL(location.href);
  url.searchParams.delete("member");
  url.searchParams.delete("memberFocus");
  if (page === "focuses") url.searchParams.delete("page");
  else url.searchParams.set("page", page);
  history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function App() {
  const [session, setSession] = useState<SessionView>(),
    [error, setError] = useState(""),
    [page, setPage] = useState(currentPage);
  const refreshVersion = useRef(0);
  const [accessRevision, setAccessRevision] = useState(0);
  async function refresh() {
    const version = ++refreshVersion.current;
    try {
      const next = await api<SessionView>("/api/session");
      if (version !== refreshVersion.current) return;
      setSession(next);
      setAccessRevision(version);
      setError("");
    } catch (e) {
      if (version === refreshVersion.current) {
        setSession(undefined);
        setError((e as Error).message);
      }
    }
  }
  useEffect(() => {
    void refresh();
    const run = () => void refresh();
    const denied = (event: Event) => {
      // A forbidden target/action does not necessarily revoke the actor's session.
      // Recheck authority, retaining form errors if the current identity is unchanged.
      if ((event as CustomEvent<{ status: number }>).detail.status === 401)
        setSession(undefined);
      void refresh();
    };
    const pop = () => setPage(currentPage());
    window.addEventListener("focus", run);
    window.addEventListener("lantern-access-changed", denied);
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("lantern-access-changed", denied);
      window.removeEventListener("focus", run);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  const activePage = session?.user ? page : "account";
  return (
    <>
      <aside>
        <div className="brand">Lantern</div>
        <nav aria-label="Main navigation">
          {[
            ...(session?.user
              ? [["focuses", "Position focuses"], ["guide", "Guide"]]
              : []),
            ["account", "Account"],
            ...(session?.department?.role === "career-lead" &&
            !session.localAccess
              ? [["department", "Department users"]]
              : []),
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={activePage === id ? "page" : undefined}
              className={activePage === id ? "active" : ""}
              onClick={() => navigatePage(id!)}
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
              {new URLSearchParams(window.location.search).has(
                "signInError",
              ) && (
                <p role="alert">
                  Sign-in could not be completed. Try again or contact your
                  career lead.
                </p>
              )}
              {session.signInAvailable ? (
                <a className="google-sign-in" href="/auth/google">
                  <img src="/google-sign-in.png" alt="Sign in with Google" width="180" height="40" />
                </a>
              ) : (
                <p>Sign-in is awaiting configuration.</p>
              )}
            </section>
          ) : (
            <Fragment
              key={`${session.user.id}:${session.department?.id ?? ""}:${session.department?.role ?? ""}`}
            >
              {!session.localAccess && page === "account" && (
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
              ) : page === "focuses" ||
                (page === "department" &&
                  session.department.role !== "career-lead") ? (
                <FocusWorkspace member={session.user} canConfirm={session.department.role === "career-lead"} />
              ) : page === "department" &&
                session.department.role === "career-lead" ? (
                <Department
                  accessRevision={accessRevision}
                  session={{ ...session, department: session.department }}
                />
              ) : (
                <LearningGuide onFocuses={() => navigatePage("focuses")} />
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
