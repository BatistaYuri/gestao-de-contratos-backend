import { env } from './config/env';
import { ContractExpirationQueue } from './infra/queue/contract-expiration-queue';
import { createRabbitMqChannel } from './infra/queue/rabbitmq-connection';
import { RedisContractSummaryCache } from './infra/redis/contract-summary-cache';
import { ensureRedisConnection } from './infra/redis/redis-client';
import { PrismaContractRepository } from './modules/contract/contract.repository';
import { ExpireContractsService } from './modules/contract/expire-contracts.service';

async function start(): Promise<void> {
  const channel = await createRabbitMqChannel();
  const queue = new ContractExpirationQueue(channel);
  const cache = new RedisContractSummaryCache(
    ensureRedisConnection,
    env.contractSummaryCacheTtlSeconds,
  );
  const service = new ExpireContractsService(new PrismaContractRepository(), cache);

  await queue.setup();
  await queue.consume(async () => {
    await service.execute();
  });
  console.log('Contract expiration worker running');
}

start().catch(() => {
  console.error('Unable to start contract expiration worker');
  process.exitCode = 1;
});
