// Script to initialize Kafka topics with correct config.
// Run once before starting any agents.
import { Kafka } from "kafkajs";
import { TOPIC_CONFIGS } from "./topics.js";

const brokers = (process.env["KAFKA_BROKERS"] ?? "localhost:9092").split(",");
const kafka = new Kafka({ clientId: "prism-topic-init", brokers });
const admin = kafka.admin();

async function initTopics() {
  await admin.connect();
  console.log("Connected to Kafka. Creating topics...");
  await admin.createTopics({
    waitForLeaders: true,
    topics: TOPIC_CONFIGS.map((t) => ({
      topic: t.name,
      numPartitions: t.partitions,
      replicationFactor: t.replicationFactor,
      configEntries: [{ name: "retention.ms", value: String(t.retentionMs) }],
    })),
  });
  console.log("Topics created.");
  await admin.disconnect();
}

initTopics().catch((err) => {
  console.error(err);
  process.exit(1);
});
