/**
 * Top-level application shell and hash-based navigation.
 * Clinical pages remain separate modules so each workflow can evolve without
 * coupling it to sidebar or header presentation code.
 */
import { useEffect, useState } from "react";
import {
  Activity,
  CalendarCheck2,
  LayoutDashboard,
  Menu,
  UsersRound,
  X,
} from "lucide-react";
import Dashboard from "./pages/Dashboard.jsx";
import Patients from "./pages/Patients.jsx";
import FollowUps from "./pages/FollowUps.jsx";

const pages = {
  dashboard: { label: "Overview", icon: LayoutDashboard },
  patients: { label: "Patients", icon: UsersRound },
  followups: { label: "Follow-ups", icon: CalendarCheck2 },
};

// Resolve the URL hash to a supported page and recover safely from bad links.
const currentPage = () => {
  const requested = location.hash.slice(1) || "dashboard";
  if (pages[requested]) return requested;
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#dashboard`,
  );
  return "dashboard";
};

/** Renders the persistent application layout and the page selected by the hash. */
export default function App() {
  const [page, setPage] = useState(currentPage);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onHash = () => setPage(currentPage());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="app-root">
      <div className="shell">
        {/* ── Sidebar ── */}
        <aside className={open ? "sidebar open" : "sidebar"}>
          {open && (
            <button
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                border: 0,
                background: "rgba(255,255,255,.1)",
                borderRadius: 6,
                padding: 6,
                cursor: "pointer",
                color: "#fff",
                display: "flex",
                zIndex: 5,
              }}
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
          <div className="sidebar-inner">
            <div className="brand">
              <div className="brand-icon">
                <Activity size={20} color="#fff" />
              </div>
              <div className="brand-text">
                <strong>LittleCare</strong>
                <small>Clinical workspace</small>
              </div>
            </div>

            <p className="sidebar-section-label">Workspace</p>
            <nav>
              {Object.entries(pages).map(([key, item]) => {
                const Icon = item.icon;
                return (
                  <a
                    key={key}
                    className={page === key ? "active" : ""}
                    href={`#${key}`}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={18} className="nav-icon" />
                    {item.label}
                  </a>
                );
              })}
            </nav>

            <div className="workspace-footnote">
              <span className="workspace-footnote-dot" />
              Training data
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <main>
          <header>
            <button
              className="menu"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
            <div className="header-breadcrumb">
              <span className="eyebrow">Pediatric care</span>
              <h1>{pages[page]?.label || "Overview"}</h1>
            </div>
            <div className="header-right">
              <span className="header-date">
                {new Date().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </header>

          <div className="content">
            {page === "patients" ? (
              <Patients />
            ) : page === "followups" ? (
              <FollowUps />
            ) : (
              <Dashboard />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
