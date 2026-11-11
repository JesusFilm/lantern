import { useEffect, useState } from "react";
import { BookOpen, Building2, ClipboardCheck, FileText, PanelLeftClose, PanelLeftOpen, UserRound, type LucideIcon } from "lucide-react";
import type { SessionView } from "../../shared/access.js";
import "./sidebar.css";

const preferenceKey = "lantern-sidebar";
function readCollapsed() {
  try { return localStorage.getItem(preferenceKey) === "collapsed"; }
  catch { return false; }
}

export function Sidebar({ session, activePage, onNavigate }: {
  session?: SessionView;
  activePage: string;
  onNavigate: (page: string) => void;
}) {
  const [preferredCollapsed, setCollapsed] = useState(readCollapsed);
  const canCollapse = session?.features?.includes("sidebar-collapse") ?? false;
  const collapsed = canCollapse && preferredCollapsed;
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === preferenceKey || event.key === null) setCollapsed(readCollapsed());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(preferenceKey, next ? "collapsed" : "expanded"); }
    catch { /* Keep the control usable when browser storage is unavailable. */ }
  }
  const items: { id: string; label: string; icon: LucideIcon }[] = [
    ...(session?.user ? [
      { id: "focuses", label: "Position focuses", icon: FileText },
      ...(session.department?.role === "career-lead" ? [{ id: "reviews", label: "Review requests", icon: ClipboardCheck }] : []),
      { id: "guide", label: "Guide", icon: BookOpen },
    ] : []),
    { id: "account", label: "Account", icon: UserRound },
    ...(session?.department?.role === "career-lead" && !session.localAccess ? [{ id: "department", label: "Department", icon: Building2 }] : []),
  ];
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>
    <div className="sidebar-heading">
      <div className="brand" role="img" aria-label="Lantern">
        <img src="/lantern.svg" alt="" width="36" height="36" />
        <span className="brand-name">Lantern</span>
      </div>
    </div>
    <nav id="main-navigation" aria-label="Main navigation">
      {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={label} title={collapsed ? label : undefined} aria-current={activePage === id ? "page" : undefined} className={activePage === id ? "active" : ""} onClick={() => onNavigate(id)}>
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        <span className="sidebar-label">{label}</span>
      </button>)}
    </nav>
    {canCollapse && <div className="sidebar-actions">
      <button className="sidebar-toggle" type="button" aria-label={toggleLabel} title={toggleLabel} aria-expanded={!collapsed} aria-controls="main-navigation" onClick={toggle}>
        <ToggleIcon size={18} aria-hidden="true" />
        <span className="sidebar-label">{toggleLabel}</span>
      </button>
    </div>}
    <div className="aside-foot" title={collapsed && session?.user ? `${session.user.name}${session.department ? ` · ${session.department.name}` : ""}` : undefined}>
      {session?.user && <>
        <span className="sidebar-avatar" aria-hidden="true">{session.user.name.trim().charAt(0).toUpperCase()}</span>
        <div className="sidebar-identity"><span>{session.user.name}</span><small>{session.department?.name}</small></div>
      </>}
    </div>
  </aside>;
}
