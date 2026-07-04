import type { AgentScopeView as AgentScope, DashboardData } from "../data/types.ts";
import { formatScore } from "../lib/format.ts";
import { relativeTime } from "../lib/format.ts";

function ScopeCard({
  agent,
  now,
  selected,
  onSelect,
}: {
  agent: AgentScope;
  now: string;
  selected: boolean;
  onSelect: (id: string) => void;
}): JSX.Element {
  const pct = Math.round(agent.deviationScore * 100);
  const clean = agent.outOfScopeCount === 0;
  return (
    <div className="panel" style={selected ? { outline: "1px solid var(--accent)" } : undefined}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, cursor: "pointer" }} onClick={() => onSelect(agent.agentId)}>
          {agent.agentName}
        </h2>
        <span className="pill">{agent.model}</span>
      </div>

      <div style={{ margin: "12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
          <span>Scope deviation</span>
          <span style={{ color: clean ? "var(--ok)" : "var(--crit)" }}>{formatScore(agent.deviationScore)}</span>
        </div>
        <div className="gauge">
          <span style={{ width: `${pct}%`, background: clean ? "var(--ok)" : "var(--crit)" }} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
        Declared scope: {agent.declaredScope.map((s) => (
          <span key={s} className="chip" style={{ background: "var(--bg-elev)", marginRight: 5 }}>{s}</span>
        ))}
      </div>

      <div style={{ fontSize: 12, marginBottom: 8 }}>
        {agent.inScopeCount}/{agent.totalEvents} actions in scope
      </div>

      {clean ? (
        <div style={{ color: "var(--ok)", fontSize: 13 }}>✓ No scope violations observed</div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: "var(--crit)", marginBottom: 6 }}>
            Out-of-scope actions
          </div>
          {agent.outOfScopeEvents.map((ev, i) => (
            <div className="event" key={i}>
              <span>
                <strong>{ev.action}</strong>
                {ev.targetType ? <span style={{ color: "var(--text-dim)" }}> · {ev.targetType}</span> : null}
              </span>
              <span style={{ color: ev.outcome === "denied" ? "var(--warn)" : "var(--crit)" }}>
                {ev.outcome} · {relativeTime(ev.executedAt, now)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentScopePanel({
  data,
  selectedId,
  onSelect,
}: {
  data: DashboardData;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  if (data.agents.length === 0) {
    return <div className="panel" style={{ color: "var(--text-dim)" }}>No agent activity available from this data source.</div>;
  }
  return (
    <div>
      {data.agents.map((a) => (
        <ScopeCard
          key={a.agentId}
          agent={a}
          now={data.generatedAt}
          selected={a.agentId === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
