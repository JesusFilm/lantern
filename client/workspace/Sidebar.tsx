import { useEffect, useRef, useState } from "react";
import { NotebookText, Menu, X, BookOpen, Building2, CalendarDays, UsersRound, ClipboardCheck, FileText, PanelLeftClose, PanelLeftOpen, UserRound, type LucideIcon } from "lucide-react";
import type { SessionView } from "../../shared/access.js";
import "./sidebar.css";
import { usePhoneLayout } from "./usePhoneLayout.js";

import { useReviewActivity } from "./useReviewActivity.js";

const preferenceKey = "lantern-sidebar";
function readCollapsed() {
  try { return localStorage.getItem(preferenceKey) === "collapsed"; }
  catch { return false; }
}

export function Sidebar({ session, activePage, onNavigate, hrefForPage }: {
  session?: SessionView;
  activePage: string;
  onNavigate: (page: string) => void;
  hrefForPage: (page: string) => string;
}) {
  const phone = usePhoneLayout();
  const activity = useReviewActivity(session?.department?.role === "career-lead" && !!session.features?.includes("review-activity"));
  const canCollapse = session?.features?.includes("sidebar-collapse") ?? false;
  const mobileMenu = phone && canCollapse;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = menuRef.current;
    if (!dialog) return;
    if (mobileMenu && menuOpen) dialog.showModal();
    else dialog.close();
  }, [mobileMenu, menuOpen]);
  useEffect(() => { setMenuOpen(false); }, [mobileMenu, session?.user?.id]);
  const [preferredCollapsed, setCollapsed] = useState(readCollapsed);
  const collapsed = !phone && canCollapse && preferredCollapsed;
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
      ...(session.department ? [{ id: "week", label: "My week", icon: CalendarDays }] : []),
      ...(session.department ? [{ id: "team", label: "My team", icon: UsersRound }] : []),
      ...(session.department && session.features?.includes("changelog") ? [{ id: "changelog", label: "Changelog", icon: NotebookText }] : []),
      ...(session.department?.role === "career-lead" ? [{ id: "reviews", label: "Review requests", icon: ClipboardCheck }] : []),
      { id: "guide", label: "Guide", icon: BookOpen },
      { id: "account", label: "Account", icon: UserRound },
    ] : []),
    ...(session?.department?.role === "career-lead" && !session.localAccess ? [{ id: "department", label: "Department", icon: Building2 }] : []),
  ];
  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const contents = <>
    <div className="sidebar-heading">
      <div className="brand" role="img" aria-label="Lantern">
        <img src="/lantern.svg" alt="" width="36" height="36" />
        <span className="brand-name">Lantern</span>
      </div>
      {mobileMenu && <button type="button" className="mobile-menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={22} /></button>}
    </div>
    <nav id="main-navigation" aria-label="Main navigation">
      {items.map(({ id, label, icon: Icon }) => <a key={id} href={hrefForPage(id)} aria-label={label} aria-describedby={id === "reviews" && activity.items.length ? "review-unread-count" : undefined} title={collapsed ? label : undefined} aria-current={activePage === id ? "page" : undefined} className={`sidebar-link${activePage === id ? " active" : ""}`} onClick={event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(id); setMenuOpen(false);
      }}>
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        <span className="sidebar-label">{label}</span>
        {id === 'reviews' && activity.items.length > 0 && <span id="review-unread-count" className="review-unread-count" aria-label={`${activity.items.length} ${activity.items.length === 1 ? 'focus' : 'focuses'} with unread review activity`}>{activity.items.length > 99 ? '99+' : activity.items.length}</span>}
      </a>)}
    </nav>
    {activity.error && <p className="sidebar-activity-error">Review activity unavailable. <button className="link" onClick={activity.retry}>Retry</button></p>}
    {!phone && canCollapse && <div className="sidebar-actions">
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
  </>;
  if (mobileMenu) return <>
    <header className="mobile-header">
      <div className="brand" role="img" aria-label="Lantern"><img src="/lantern.svg" alt="" width="30" height="30" /><span>Lantern</span></div>
      <button type="button" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen(true)}><Menu size={24} aria-hidden="true" /></button>
    </header>
    <dialog ref={menuRef} id="mobile-menu" className="sidebar mobile-menu" aria-label="Menu"
      onCancel={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)}
      onClick={event => { if (event.target === event.currentTarget && event.clientX < event.currentTarget.getBoundingClientRect().left) setMenuOpen(false); }}>
      {contents}
    </dialog>
  </>;
  return <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`}>{contents}</aside>;
}
