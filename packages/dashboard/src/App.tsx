import { useEffect, useState } from "react";
import { AgentScopePanel } from "./components/AgentScopeView.tsx";
import { AlertFeed } from "./components/AlertFeed.tsx";
import { DetailPanel } from "./components/DetailPanel.tsx";
import { IdentographGraph } from "./components/IdentographGraph.tsx";
import { Overview } from "./components/Overview.tsx";
import { RiskTable } from "./components/RiskTable.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { Walkthrough } from "./components/Walkthrough.tsx";
import { ApiDataSource, DemoDataSource, type DataSource } from "./data/data-source.ts";
import type { DashboardData } from "./data/types.ts";
import { countBySeverity } from "./lib/alerts.ts";
import { WALKTHROUGH } from "./lib/walkthrough.ts";

export type ViewId = "overview" | "graph" | "identities" | "agents" | "alerts";

const VIEW_TITLES: Record<ViewId, { title: string; sub: string }> = {
  overview: { title: "Governance Overview", sub: "Live risk posture across all identities" },
  graph: { title: "Identograph", sub: "Interactive human · agent · machine access graph" },
  identities: { title: "Identities", sub: "Risk-ranked, filterable identity inventory" },
  agents: { title: "Agent Scope", sub: "Declared intent vs. observed execution" },
  alerts: { title: "Alert Feed", sub: "CAEP risk signals, newest first" },
};

function resolveDataSource(): { source: DataSource; label: string } {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const api = params.get("api");
  if (api) {
    return { source: new ApiDataSource(api, params.get("tenant") ?? "demo"), label: "live API" };
  }
  return { source: new DemoDataSource(), label: "demo data" };
}

export function App(): JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState("demo data");
  const [view, setView] = useState<ViewId>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);

  useEffect(() => {
    const { source, label } = resolveDataSource();
    setSourceLabel(label);
    source.load().then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Walkthrough drives the active view + focused node.
  useEffect(() => {
    if (tourStep === null) return;
    const step = WALKTHROUGH[tourStep];
    if (!step) return;
    setView(step.view);
    setSelectedId(step.focusId ?? null);
  }, [tourStep]);

  if (error) {
    return <div style={{ padding: 40, color: "var(--crit)" }}>Failed to load data: {error}</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Loading Identograph…</div>;
  }

  const criticalCount = countBySeverity(data.signals).critical;

  const handleSelect = (id: string): void => {
    setSelectedId(id);
    if (view === "overview" || view === "alerts") setView("graph");
  };

  const head = VIEW_TITLES[view];
  const withDetail = view === "graph" || view === "identities" || view === "agents";

  const body = ((): JSX.Element => {
    switch (view) {
      case "overview":
        return <Overview data={data} onSelect={handleSelect} />;
      case "graph":
        return <IdentographGraph data={data} selectedId={selectedId} onSelect={setSelectedId} />;
      case "identities":
        return <RiskTable data={data} selectedId={selectedId} onSelect={setSelectedId} />;
      case "agents":
        return <AgentScopePanel data={data} selectedId={selectedId} onSelect={setSelectedId} />;
      case "alerts":
        return <AlertFeed data={data} onSelect={handleSelect} />;
    }
  })();

  return (
    <div className="app">
      <Sidebar
        active={view}
        onSelect={(v) => setView(v)}
        criticalCount={criticalCount}
        onStartTour={() => setTourStep(0)}
      />
      <main className="main">
        <div className="view-head">
          <div>
            <h1>{head.title}</h1>
            <div className="sub">{head.sub}</div>
          </div>
          <div className="sub">
            tenant <strong>{data.tenantId}</strong> · {sourceLabel}
          </div>
        </div>

        {withDetail ? (
          <div className="two-col">
            <div>{body}</div>
            <DetailPanel
              data={data}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
        ) : (
          body
        )}
      </main>

      {tourStep !== null ? (
        <Walkthrough
          step={tourStep}
          onPrev={() => setTourStep((s) => (s === null ? s : Math.max(0, s - 1)))}
          onNext={() => setTourStep((s) => (s === null ? s : Math.min(WALKTHROUGH.length - 1, s + 1)))}
          onExit={() => setTourStep(null)}
        />
      ) : null}
    </div>
  );
}
