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

## Deferred to later phases

- HTTP route `GET /api/v1/risk/identities` → Phase 5 API layer (the data
  function `getRiskIdentities()` is delivered here).
- Real-time evaluation on Kafka ingest events → depends on Phase 2 completion.
- Behavioral-baseline anomaly detection.
