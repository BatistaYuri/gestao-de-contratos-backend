import { env } from './config/env';
import { ContractExpirationQueue } from './infra/queue/contract-expiration-queue';
import { ContractExpirationScheduler } from './infra/queue/contract-expiration-scheduler';
import { createRabbitMqChannel } from './infra/queue/rabbitmq-connection';

async function start(): Promise<void> {
  const channel = await createRabbitMqChannel();
  const queue = new ContractExpirationQueue(channel);
  const scheduler = new ContractExpirationScheduler(queue, env.contractExpirationIntervalMs);
  await scheduler.start();
  console.log('Contract expiration scheduler running');
}

start().catch(() => {
  console.error('Unable to start contract expiration scheduler');
  process.exitCode = 1;
});
