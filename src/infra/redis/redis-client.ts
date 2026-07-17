import { createClient } from 'redis';
import { env } from '../../config/env';

export const redisClient = createClient({
  socket: {
    host: env.redisHost,
    port: env.redisPort,
    reconnectStrategy: false,
  },
});

redisClient.on('error', () => { console.error('Redis client error') });

export async function ensureRedisConnection(): Promise<typeof redisClient> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}
