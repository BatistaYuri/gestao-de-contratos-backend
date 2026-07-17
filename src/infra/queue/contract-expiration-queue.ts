import type { ConfirmChannel, ConsumeMessage, Options } from 'amqplib';

const CONTRACTS_EXCHANGE = 'contracts';
const CONTRACT_EXPIRATION_QUEUE = 'contracts.expire';
const CONTRACT_EXPIRATION_ROUTING_KEY = 'contracts.expire';
export const CONTRACT_EXPIRATION_MESSAGE_TYPE = 'expire-contracts';

const DEAD_LETTER_QUEUE = 'contracts.expire.dead';
const DEAD_LETTER_ROUTING_KEY = 'contracts.expire.dead';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1_000, 2_000] as const;

type ExpirationMessageHandler = () => Promise<void>;

type ConsumerChannel = Pick<
  ConfirmChannel,
  'ack' | 'assertExchange' | 'assertQueue' | 'bindQueue' | 'consume' | 'nack' | 'prefetch' | 'publish' | 'waitForConfirms'
>;

export class ContractExpirationQueue {
  constructor(private readonly channel: ConsumerChannel) {}

  async setup(): Promise<void> {
    await this.channel.assertExchange(CONTRACTS_EXCHANGE, 'direct', { durable: true });
    await this.channel.assertQueue(CONTRACT_EXPIRATION_QUEUE, { durable: true });
    await this.channel.bindQueue(
      CONTRACT_EXPIRATION_QUEUE,
      CONTRACTS_EXCHANGE,
      CONTRACT_EXPIRATION_ROUTING_KEY,
    );

    for (const [index, delay] of RETRY_DELAYS_MS.entries()) {
      const attempt = index + 2;
      const queue = retryQueue(attempt);
      await this.channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: CONTRACTS_EXCHANGE,
        deadLetterRoutingKey: CONTRACT_EXPIRATION_ROUTING_KEY,
        messageTtl: delay,
      });
      await this.channel.bindQueue(queue, CONTRACTS_EXCHANGE, retryRoutingKey(attempt));
    }

    await this.channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await this.channel.bindQueue(
      DEAD_LETTER_QUEUE,
      CONTRACTS_EXCHANGE,
      DEAD_LETTER_ROUTING_KEY,
    );
  }

  async publish(): Promise<void> {
    this.publishMessage(CONTRACT_EXPIRATION_ROUTING_KEY, { attempt: 1 });
    await this.channel.waitForConfirms();
  }

  async consume(handler: ExpirationMessageHandler): Promise<void> {
    await this.channel.prefetch(1);
    await this.channel.consume(CONTRACT_EXPIRATION_QUEUE, async (message) => {
      if (!message) return;
      await this.handle(message, handler);
    });
  }

  async handle(message: ConsumeMessage, handler: ExpirationMessageHandler): Promise<void> {
    if (message.properties.type !== CONTRACT_EXPIRATION_MESSAGE_TYPE) {
      this.channel.nack(message, false, false);
      return;
    }

    try {
      await handler();
      this.channel.ack(message);
    } catch {
      const attempt = messageAttempt(message);
      const nextAttempt = attempt + 1;
      const routingKey = attempt < MAX_ATTEMPTS
        ? retryRoutingKey(nextAttempt)
        : DEAD_LETTER_ROUTING_KEY;

      try {
        this.publishMessage(routingKey, { attempt: nextAttempt });
        await this.channel.waitForConfirms();
        this.channel.ack(message);
      } catch {
        this.channel.nack(message, false, true);
      }
    }
  }

  private publishMessage(routingKey: string, headers: Record<string, number>): void {
    const options: Options.Publish = {
      contentType: 'application/json',
      headers,
      persistent: true,
      type: CONTRACT_EXPIRATION_MESSAGE_TYPE,
    };
    this.channel.publish(
      CONTRACTS_EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify({ type: CONTRACT_EXPIRATION_MESSAGE_TYPE })),
      options,
    );
  }
}

function retryQueue(attempt: number): string {
  return `contracts.expire.retry.${attempt}`;
}

function retryRoutingKey(attempt: number): string {
  return `contracts.expire.retry.${attempt}`;
}

function messageAttempt(message: ConsumeMessage): number {
  const attempt = message.properties.headers?.attempt;
  return typeof attempt === 'number' && Number.isInteger(attempt) && attempt > 0
    ? attempt
    : 1;
}
