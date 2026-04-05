import { Kafka, type Consumer } from "kafkajs";
import type { IdentityEventEnvelope } from "../messages/envelope.js";
import type { TopicName } from "./topics.js";

export interface ConsumerConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

export type MessageHandler<TPayload = unknown> = (
  envelope: IdentityEventEnvelope<TPayload>,
  ack: () => Promise<void>,
) => Promise<void>;

export interface PrismConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(topic: TopicName, handler: MessageHandler): Promise<void>;
}

export class KafkaConsumer implements PrismConsumer {
  private readonly consumer: Consumer;
  private connected = false;

  constructor(config: ConsumerConfig) {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });
    this.consumer = kafka.consumer({ groupId: config.groupId });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    this.connected = false;
  }

  async subscribe(topic: TopicName, handler: MessageHandler): Promise<void> {
    await this.consumer.subscribe({ topic });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async ({ topic: _topic, partition, message }) => {
        const raw = message.value?.toString();
        if (raw === undefined || raw === null) {
          return;
        }

        const envelope = JSON.parse(raw) as IdentityEventEnvelope<unknown>;

        const ack = async (): Promise<void> => {
          await this.consumer.commitOffsets([
            {
              topic: _topic,
              partition,
              offset: (BigInt(message.offset) + 1n).toString(),
            },
          ]);
        };

        // If handler throws, do not commit - message will be redelivered
        await handler(envelope, ack);
      },
    });
  }
}
