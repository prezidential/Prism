export const TOPICS = {
  IDENTITY_EVENTS_RAW: "identity.events.raw",
  IDENTITY_EVENTS_PROCESSED: "identity.events.processed",
  AUDIT_LOG: "audit.log",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

export interface TopicConfig {
  name: TopicName;
  partitions: number;
  replicationFactor: number;
  retentionMs: number;
}

export const TOPIC_CONFIGS: TopicConfig[] = [
  {
    name: TOPICS.IDENTITY_EVENTS_RAW,
    partitions: 6,
    replicationFactor: 1,
    retentionMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    name: TOPICS.IDENTITY_EVENTS_PROCESSED,
    partitions: 6,
    replicationFactor: 1,
    retentionMs: 30 * 24 * 60 * 60 * 1000,
  },
  {
    name: TOPICS.AUDIT_LOG,
    partitions: 3,
    replicationFactor: 1,
    retentionMs: 365 * 24 * 60 * 60 * 1000,
  },
];
