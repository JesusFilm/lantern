import { useAppearance } from "./workspace/appearance.js";
import {CoachWorkspace} from "./coach/CoachWorkspace.js";
import { Fragment, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { SessionView } from "../shared/access.js";
import { api } from "./workspace/api.js";
import { FocusWorkspace } from "./workspace/FocusWorkspace.js";
import { LearningGuide } from "./workspace/LearningGuide.js";
import { Sidebar } from "./workspace/Sidebar.js";
import { Account } from "./workspace/Account.js";
import { MyTeam } from "./workspace/MyTeam.js";
import { MyWeek } from "./workspace/MyWeek.js";
import { Department } from "./workspace/Department.js";
import "./workspace/style.css";
import "./workspace/dark.css";
import { workspaceHistoryIndex } from "./workspace/useDraftFocusWorkflow.js";
history.replaceState(
  { ...history.state, lanternHistoryIndex: workspaceHistoryIndex() },
  "",
);
function currentPage(): keyof typeof pageTitles {
  const page = new URLSearchParams(location.search).get("page");
  return page === "department" || page === "guide" || page === "account" || page === "reviews" || page === "week" || page === "team"
    ? page
    : "focuses";
}
const pageTitles = {
  focuses: "Position focuses",
  week: "My week",
  team: "My team",
  guide: "Guide",
  account: "Account",
  department: "Department",
  reviews: "Review requests",
};
function pageHref(page: string) {
  const url = new URL(location.href);
  url.searchParams.delete("view");
  url.searchParams.delete("reviewFocus");
  url.searchParams.delete("member");
  url.searchParams.delete("memberFocus");
  if (page === "team" && currentPage() !== "team") url.searchParams.delete("date");
  if (page === "week" && currentPage() !== "week") url.searchParams.delete("week");
  if (page === "focuses") url.searchParams.delete("page");
  else url.searchParams.set("page", page);
  return url.pathname + url.search + url.hash;
}
function navigatePage(page: string) {
  if(!window.dispatchEvent(new Event("lantern-coach-leave", {cancelable:true})))return;
  history.pushState(
    { lanternHistoryIndex: workspaceHistoryIndex() + 1 },
    "",
    pageHref(page),
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function App() {
  const { appearance, choose } = useAppearance();
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
      if (!next.user && next.signInAvailable && !new URLSearchParams(location.search).has("signInError")) {
        setSession(undefined);
        setError("");
        location.replace("/auth/jesusfilm");
        return;
      }
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
    const pop = (event: PopStateEvent) => {
      const traversal = new CustomEvent("lantern-focus-history", {
        cancelable: true,
        detail: { browser: event.isTrusted },
      });
      if (window.dispatchEvent(traversal)) setPage(currentPage());
    };
    window.addEventListener("focus", run);
    window.addEventListener("lantern-access-changed", denied);
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("lantern-access-changed", denied);
      window.removeEventListener("focus", run);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  const activePage = session?.user ? page : "";
  const pageTitle = !session?.user ? "Lantern" : `${pageTitles[page]} — Lantern`;
  useEffect(() => { document.title = pageTitle; }, [pageTitle]);
  return (
    <>
      <Sidebar session={session} activePage={activePage} onNavigate={navigatePage} hrefForPage={pageHref} />
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
                <a className="identity-sign-in" href="/auth/jesusfilm">
                  <img src="/lantern.svg" alt="" width="24" height="24" />
                  Sign in with Jesus Film
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
              {page === "reviews" ? (
                <CoachWorkspace key={page} session={session} lead={page === "reviews"}/>
              ) : page === "account" ? (
                <Account
                  teamAPIEnabled={!!session.department && session.features.includes("team-api") && session.features.includes("team-updates")}
                  githubEnabled={!!session.department && session.features.includes('weekly-updates')}
                  appearance={appearance}
                  onAppearanceChange={choose}
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
              ) : page === "team" ? (
                session.features?.includes("team-updates") ? <MyTeam /> : <section><h1>Page unavailable</h1></section>
              ) : page === "week" ? (
                session.features?.includes("weekly-updates") ? <MyWeek targetEnabled={session.features.includes("weekly-focus-links")} privacyEnabled={session.features.includes("weekly-goal-privacy")} copyEnabled={session.features.includes("weekly-goal-copy")} /> : <section><h1>Page unavailable</h1></section>
              ) : page === "focuses" ||
                (page === "department" &&
                  session.department.role !== "career-lead") ? (
                <FocusWorkspace member={session.user} departmentId={session.department.id} canConfirm={session.department.role === "career-lead"} coachAvailable={!!session.coachAvailable} session={session} onGuide={() => navigatePage("guide")} />
              ) : page === "department" &&
                session.department.role === "career-lead" ? (
                <Department
                  accessRevision={accessRevision}
                  viewerId={session.user.id}
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
