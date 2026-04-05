import { Kafka, type Producer } from "kafkajs";
import type { IdentityEventEnvelope } from "../messages/envelope.js";
import type { TopicName } from "./topics.js";

export interface ProducerConfig {
  brokers: string[];
  clientId: string;
}

export interface PublishOptions {
  key?: string;
  headers?: Record<string, string>;
}

export interface PrismProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish<TPayload>(
    topic: TopicName,
    envelope: IdentityEventEnvelope<TPayload>,
    opts?: PublishOptions,
  ): Promise<void>;
}

export class KafkaProducer implements PrismProducer {
  private readonly producer: Producer;
  private connected = false;

  constructor(config: ProducerConfig) {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });
    this.producer = kafka.producer();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.connected = false;
  }

  async publish<TPayload>(
    topic: TopicName,
    envelope: IdentityEventEnvelope<TPayload>,
    opts?: PublishOptions,
  ): Promise<void> {
    if (!this.connected) {
      throw new Error("KafkaProducer is not connected. Call connect() before publish().");
    }

    const headers: Record<string, string> = opts?.headers ?? {};

    await this.producer.send({
      topic,
      messages: [
        {
          key: opts?.key,
          value: JSON.stringify(envelope),
          headers,
        },
      ],
    });
  }
}
