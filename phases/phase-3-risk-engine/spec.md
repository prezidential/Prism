# Phase 3 — Risk Engine Spec

The risk engine reduces the Identograph to per-identity risk. Every score is a
pure function of graph traversal — no rule engine, no batch jobs. It lives in
`packages/risk-engine` and depends only on a structural `GraphClient`
(`query` / `command`), so it is decoupled from `@prism/identograph`'s build
output and trivially mockable.

## Pipeline

```
scorers → findings → aggregate (noisy-OR) → profiles
                          ↓
              signal writer (RiskSignal vertices)
                          ↓
         persist composite score onto identity vertex
                          ↓
              getRiskIdentities() (Risk API data layer)
```

## Scorers

Each scorer returns `RiskFinding[]` with a normalized `score` in `[0, 1]`, a
CAEP event classification, a human-readable `rationale`, and structured
`evidence`. Scorers carry a `weight` used by aggregation.

| Scorer | id | Weight | What it flags |
|---|---|---|---|
| Delegation depth | `delegation-depth` | 0.20 | Identities at the end of deep / transitively re-delegable delegation chains |
| Dormant entitlement | `dormant-entitlement` | 0.20 | Identities holding privileged entitlements while inactive past a grace window |
| Agent scope deviation | `agent-scope-deviation` | 0.30 | Agents whose ExecutionEvents fall outside declared scope (successful > denied) |
| Entitlement overlap | `entitlement-overlap` | 0.15 | Identities sharing a privileged entitlement with another (separation-of-duties) |
| Blast radius | `blast-radius` | 0.15 | Identities that reach many resources / privilege / downstream identities |

## Aggregation

Composite risk combines a subject's findings with a weighted noisy-OR:

```
composite = 1 - Π_i (1 - weight_i * score_i)
```

Independent risk factors compound but the result stays bounded in `[0, 1]`. The
highest finding severity becomes the profile's `topSeverity`.

## Signal materialization

Findings at or above `signalThreshold` (default `0.4`) are written as
`RiskSignal` vertices shaped like SSF/CAEP Security Event Tokens (`jti`, `iss`,
`iat`, `subjectRef`, `caepEventType`, `eventTypeUri`, `score`, `severity`,
`eventPayload`). The Phase 1 `risk-surface` traversal reads them back by
`subjectRef`, closing the derive → materialize → read loop.

## Red-team scenarios

`__tests__/evaluate.test.ts` drives a single crafted graph that trips all five
scorers at once (deep transitive delegation to an agent that also acted out of
scope; a dormant privileged NHI sharing admin access with a peer and fanning out
to a delegate). It asserts finding counts, which findings cross the signal
threshold, score persistence, and that every scorer contributes.

## Runtime model

The risk engine is a **library**, not a batch job. Everything under
`packages/risk-engine` is a pure function of the graph: `evaluateRisk()` and the
individual scorers take a `GraphClient` and return findings/signals. That design
is deliberate so the same engine can be driven by whatever calls it.

`npm run risk:evaluate` (`cli/evaluate.ts`) is only a **developer / demo
entrypoint** — a convenient way to score the current graph from a terminal. It is
*not* how risk runs in production.

In production the platform is continuous and ambient — risk re-evaluates as the
Identograph changes, not on a cron or a manual command. The intended drivers of
the same `evaluateRisk()` core are:

1. **Event-driven consumer (primary).** A long-running service subscribes to the
   Phase 2 identity event bus (Kafka). When an ingest/mutation event touches an
   identity, it re-scores that identity (and its neighborhood) and writes the
   resulting `RiskSignal`s / updated `riskScore` back to the graph in near-real
   time. This is the "active running system." It is deferred here only because it
   depends on Phase 2 ingestion being wired end-to-end.
2. **On-demand API (Phase 5).** `getRiskIdentities()` already backs a future
   `GET /api/v1/risk/identities`; the API layer can also trigger an ad-hoc
   re-evaluation for a subject.

So: the npm command is scaffolding for this phase. The real deployment target is
the event-driven consumer, which reuses this exact engine unchanged.

## Deferred to later phases

- HTTP route `GET /api/v1/risk/identities` → Phase 5 API layer (the data
  function `getRiskIdentities()` is delivered here).
- Real-time evaluation on Kafka ingest events (the primary runtime, see above)
  → depends on Phase 2 completion.
- Behavioral-baseline anomaly detection.
