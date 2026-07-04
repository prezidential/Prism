import type { ViewId } from "../App.tsx";

interface NavDef {
  id: ViewId;
  label: string;
  icon: string;
}

const NAV: NavDef[] = [
  { id: "overview", label: "Overview", icon: "◎" },
  { id: "graph", label: "Identograph", icon: "⬡" },
  { id: "identities", label: "Identities", icon: "☰" },
  { id: "agents", label: "Agent Scope", icon: "⚑" },
  { id: "alerts", label: "Alerts", icon: "◈" },
];

export function Sidebar({
  active,
  onSelect,
  criticalCount,
  onStartTour,
}: {
  active: ViewId;
  onSelect: (v: ViewId) => void;
  criticalCount: number;
  onStartTour: () => void;
}): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        Idem
        <small>Identograph</small>
      </div>
      {NAV.map((n) => (
        <button
          key={n.id}
          className={`nav-item${active === n.id ? " active" : ""}`}
          onClick={() => onSelect(n.id)}
        >
          <span aria-hidden>{n.icon}</span>
          {n.label}
          {n.id === "alerts" && criticalCount > 0 ? (
            <span className="nav-badge">{criticalCount}</span>
          ) : null}
        </button>
      ))}
      <div style={{ marginTop: "auto" }}>
        <button className="btn ghost" style={{ width: "100%" }} onClick={onStartTour}>
          ▶ Demo walkthrough
        </button>
      </div>
    </aside>
  );
}
