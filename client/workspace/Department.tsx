import { MemberFocuses } from "./MemberFocuses.js";
import { useEffect, useState } from "react";
import type { RegisteredUser, SessionView } from "../../shared/access.js";
import { api as request } from "./api.js";
const api = <T,>(path: string, body?: unknown) =>
  request<T>(path, body === undefined ? "GET" : "POST", body);
const explanation = (user: RegisteredUser) =>
  user.status === "former"
    ? "Rejoining is not yet supported."
    : user.status === "other-department"
      ? `Member of ${user.department}. Unavailable to add.`
      : user.status === "member"
        ? `Already a member of ${user.department}.`
        : "Available to add";

export function Department({
  session,
  accessRevision,
}: {
  accessRevision: number;
  session: SessionView & { department: NonNullable<SessionView["department"]> };
}) {
  const route = () => ({
    member: new URLSearchParams(location.search).get("member"),
    focus: new URLSearchParams(location.search).get("memberFocus"),
  });
  const [selection, setSelection] = useState(route);
  function navigate(member?: string, focus?: string) {
    const url = new URL(location.href);
    url.searchParams.set("page", "department");
    url.searchParams.delete("focus");
    if (member) url.searchParams.set("member", member);
    else url.searchParams.delete("member");
    if (focus) url.searchParams.set("memberFocus", focus);
    else url.searchParams.delete("memberFocus");
    history.pushState(null, "", url);
    setSelection(route());
  }
  useEffect(() => {
    const pop = () => setSelection(route());
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const [members, setMembers] = useState<
      Array<{ id: string; name: string; email: string; role: string }>
    >([]),
    [users, setUsers] = useState<RegisteredUser[]>([]),
    [adding, setAdding] = useState(false),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [loadingMembers, setLoadingMembers] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function refresh() {
    setMembers(
      (await api<{ members: typeof members }>("/api/department")).members,
    );
  }
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (selection.member) return;
    let active = true;
    setMembers([]);
    setLoadingMembers(true);
    void api<{ members: typeof members }>("/api/department")
      .then((result) => {
        if (active) setMembers(result.members);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoadingMembers(false);
      });
    return () => {
      active = false;
    };
  }, [selection.member, accessRevision]);
  const visible = users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (selection.member)
    return (
      <MemberFocuses
        key={`${selection.member}:${selection.focus}:${accessRevision}`}
        memberId={selection.member}
        focusId={selection.focus}
        navigate={navigate}
      />
    );
  return (
    <section>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void act(refresh)}>Try again</button>
        </p>
      )}
      {(busy || loadingMembers) && (
        <p role="status">Loading department users…</p>
      )}
      {notice && <p role="status">{notice}</p>}
      <p className="eyebrow">
        {session.department.name} ·{" "}
        {session.department.role === "career-lead" ? "Career lead" : "Member"}
      </p>
      <h1>Department users</h1>
      <p>Signed in as {session.user?.email}</p>
      <ul className="members">
        {members.map((member) => (
          <li key={member.id}>
            <button className="link" onClick={() => navigate(member.id)}>
              {member.name}
            </button>
            <span>{member.email}</span>
            <small>
              {member.role === "career-lead" ? "Career lead" : "Member"}
            </small>
          </li>
        ))}
      </ul>
      {session.department.role === "career-lead" && (
        <>
          <button
            disabled={busy}
            aria-expanded={adding}
            onClick={() =>
              void act(async () => {
                if (adding) {
                  setAdding(false);
                  return;
                }
                await refresh();
                setUsers(
                  await api<RegisteredUser[]>(
                    "/api/department/registered-users",
                  ),
                );
                setSelected("");
                setSearch("");
                setAdding(true);
              })
            }
          >
            Add user
          </button>
          {adding && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void act(async () => {
                  await api("/api/department/members", { userId: selected });
                  await refresh();
                  setAdding(false);
                  setSelected("");
                  setNotice("User added to the department.");
                });
              }}
            >
              <h2>Add a registered user</h2>
              <label htmlFor="search">Search by name or email address</label>
              <input
                id="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected("");
                }}
              />
              <label htmlFor="user">Registered user</label>
              <select
                id="user"
                required
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Select a registered user</option>
                {visible.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                    disabled={user.status !== "available"}
                    title={explanation(user)}
                  >
                    {user.name} — {user.email}
                    {user.status !== "available"
                      ? ` · ${user.status === "former" ? "Former member" : "✓ " + user.department}`
                      : ""}
                  </option>
                ))}
              </select>
              <ul className="choices">
                {visible.map((user) => (
                  <li key={user.id}>
                    {user.email}{" "}
                    <span
                      className="tag"
                      title={user.department ?? "No department"}
                    >
                      {user.status === "available"
                        ? "Unassigned"
                        : `${user.status === "former" ? "Former member" : "✓ Member"} · ${user.department}`}
                    </span>
                    <small>{explanation(user)}</small>
                  </li>
                ))}
              </ul>
              {!visible.length && <p>No registered users match your search.</p>}
              <button
                className="primary"
                disabled={!selected || busy}
                type="submit"
              >
                Add selected user
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
