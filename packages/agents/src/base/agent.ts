export interface IngestAgentConfig {
  sourceSystemId: string;
  tenantId: string;
  kafkaBrokers: string[];
  pollIntervalMs: number; // minimum 30000
}

export interface IngestAgentStatus {
  sourceSystemId: string;
  state: "initializing" | "active" | "idle" | "failed" | "terminated";
  lastRunAt?: string;
  lastEventAt?: string;
  totalEventsEmitted: number;
  errorCount: number;
}

export interface IngestAgent {
  readonly config: IngestAgentConfig;
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): IngestAgentStatus;
  runFullDiscovery(): Promise<void>;
}
