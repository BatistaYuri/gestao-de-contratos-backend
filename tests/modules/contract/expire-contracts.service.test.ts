import { describe, expect, it, vi } from 'vitest';
import { ContractStatus } from '@prisma/client';

import type { ContractSummaryCache } from '../../../src/infra/redis/contract-summary-cache';
import type { ContractRepository } from '../../../src/modules/contract/contract.repository';
import { ExpireContractsService } from '../../../src/modules/contract/expire-contracts.service';

function repository(updated = 0): ContractRepository {
  return {
    create: vi.fn(),
    findByNumber: vi.fn(),
    findMany: vi.fn(),
    findById: vi.fn(),
    countByStatus: vi.fn(),
    updateStatusBefore: vi.fn().mockResolvedValue(updated),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
}

function cache(): ContractSummaryCache {
  return {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
}

const now = () => new Date('2026-07-17T15:00:00.000Z');

describe('ExpireContractsService', () => {
  it('expires only active contracts due before today', async () => {
    const repo = repository(2);
    await expect(new ExpireContractsService(repo, cache(), now).execute()).resolves.toBe(2);
    expect(repo.updateStatusBefore).toHaveBeenCalledWith(
      ContractStatus.ACTIVE,
      new Date('2026-07-17T00:00:00.000Z'),
      ContractStatus.EXPIRED,
    );
  });

  it('does not invalidate the cache when future, today, or closed contracts are unchanged', async () => {
    const summaryCache = cache();
    await new ExpireContractsService(repository(0), summaryCache, now).execute();
    expect(summaryCache.invalidate).not.toHaveBeenCalled();
  });

  it('invalidates the summary only when contracts change', async () => {
    const summaryCache = cache();
    await new ExpireContractsService(repository(1), summaryCache, now).execute();
    expect(summaryCache.invalidate).toHaveBeenCalledOnce();
  });

  it('is idempotent when a repeated execution finds no active overdue contracts', async () => {
    const repo = repository();
    vi.mocked(repo.updateStatusBefore)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const summaryCache = cache();
    const service = new ExpireContractsService(repo, summaryCache, now);

    await expect(service.execute()).resolves.toBe(1);
    await expect(service.execute()).resolves.toBe(0);
    expect(summaryCache.invalidate).toHaveBeenCalledOnce();
  });
});
