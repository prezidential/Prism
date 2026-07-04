// The demo walkthrough script — a guided ~10-minute tour that drives the active
// view and selection. Pure data so it can be unit-tested and reused.

import type { ViewId } from "../App.tsx";

export interface WalkthroughStep {
  title: string;
  narrative: string;
  view: ViewId;
  focusId?: string;
}

export const WALKTHROUGH: WalkthroughStep[] = [
  {
    title: "One graph for every identity",
    narrative:
      "Idem governs humans, AI agents, and machine identities from a single Identograph. Start with the risk overview — the highest-risk principals bubble to the top.",
    view: "overview",
  },
  {
    title: "The Identograph",
    narrative:
      "Access flows left-to-right: people and agents, through the entitlements they hold, to the resources those reach. Node size is risk. deploy-copilot is the largest node in the graph.",
    view: "graph",
    focusId: "agent-deploy",
  },
  {
    title: "An agent outside its lane",
    narrative:
      "deploy-copilot declared three operations, but acted outside that scope three times — including reading the customer-PII bucket and deleting an RDS snapshot. Declared intent vs. actual execution, side by side.",
    view: "agents",
    focusId: "agent-deploy",
  },
  {
    title: "A dormant admin",
    narrative:
      "ci-deployer is an AWS IAM user idle for 214 days — yet it still holds AdministratorAccess, which it also shares with the deploy agent (a separation-of-duties overlap).",
    view: "identities",
    focusId: "nhi-ci",
  },
  {
    title: "Real-time, standards-based alerts",
    narrative:
      "Every finding is a CAEP security-event signal, derived by traversing the graph, materialized back into it, and streamed to this feed as the graph changes.",
    view: "alerts",
  },
  {
    title: "Unify · score · govern",
    narrative:
      "That's the loop: unify human, agent, and machine identity in one graph; score risk by traversal; and govern continuously. No rule engine, no batch jobs — only the graph.",
    view: "overview",
  },
];
