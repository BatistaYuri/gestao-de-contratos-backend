import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisContractSummaryCache } from '../../src/infra/redis/contract-summary-cache';

const summary = { active: 2, expired: 1, closed: 3, total: 6 };

function redisDouble() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

describe('RedisContractSummaryCache', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a valid cached summary', async () => {
    const redis = redisDouble();
    redis.get.mockResolvedValue(JSON.stringify(summary));

    await expect(
      new RedisContractSummaryCache(async () => redis, 60).get(),
    ).resolves.toEqual(summary);
  });

  it.each([
    'not-json',
    JSON.stringify({ active: 2, expired: 1, closed: 3, total: 99 }),
  ])('treats invalid cached content as a miss', async (content) => {
    const redis = redisDouble();
    redis.get.mockResolvedValue(content);

    await expect(
      new RedisContractSummaryCache(async () => redis, 60).get(),
    ).resolves.toBeNull();
  });

  it('writes the summary with the configured TTL', async () => {
    const redis = redisDouble();
    await new RedisContractSummaryCache(async () => redis, 45).set(summary);

    expect(redis.set).toHaveBeenCalledWith(
      'cache:contracts:summary',
      JSON.stringify(summary),
      { EX: 45 },
    );
  });

  it('does not propagate Redis unavailability', async () => {
    const unavailable = async () => {
      throw new Error('connection details');
    };
    const cache = new RedisContractSummaryCache(unavailable, 60);

    await expect(cache.get()).resolves.toBeNull();
    await expect(cache.set(summary)).resolves.toBeUndefined();
    await expect(cache.invalidate()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(3);
  });
});
