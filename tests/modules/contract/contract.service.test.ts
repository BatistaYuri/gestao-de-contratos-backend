import { ContractStatus, type Client, type Contract } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { ContractRepository, ContractWithClient } from '../../../src/modules/contract/contract.repository';
import { ContractService } from '../../../src/modules/contract/contract.service';
import { ContractSummaryCache } from '../../../src/infra/redis/contract-summary-cache';

const client: Client = {
  id: '06f37985-9f78-4ced-95bb-d9328e30f93c',
  name: 'Acme',
  document: '123',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const contract: ContractWithClient = {
  id: 'fd47b772-c71d-40e3-9dd0-c074745023ac',
  number: 'CTR-001',
  clientId: client.id,
  value: 100 as unknown as Contract['value'],
  dueDate: new Date('2026-07-18T00:00:00.000Z'),
  status: ContractStatus.ACTIVE,
  closedAt: null,
  deletedAt: null,
  createdAt: new Date('2026-07-17T10:00:00.000Z'),
  updatedAt: new Date('2026-07-17T10:00:00.000Z'),
  client,
};

const input = {
  number: contract.number,
  clientId: contract.clientId,
  value: 100,
  dueDate: contract.dueDate,
};

function repository(): ContractRepository {
  return {
    clientExists: vi.fn().mockResolvedValue(true),
    create: vi.fn().mockResolvedValue(contract),
    findByNumber: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(contract),
    update: vi.fn().mockResolvedValue(contract),
    softDelete: vi.fn().mockResolvedValue(undefined),
    countByStatus: vi.fn().mockResolvedValue([]),
  };
}

function summaryCache(): ContractSummaryCache {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
}

const now = () => new Date('2026-07-17T15:00:00.000Z');

describe('ContractService', () => {
  it.each([
    ['future', '2026-07-18', ContractStatus.ACTIVE],
    ['past', '2026-07-16', ContractStatus.EXPIRED],
    ['today', '2026-07-17', ContractStatus.ACTIVE],
  ])('creates a %s contract with the expected status', async (_name, date, status) => {
    const repo = repository();
    const service = new ContractService(repo, undefined, now);
    await service.create({ ...input, dueDate: new Date(`${date}T00:00:00.000Z`) });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status }));
  });

  it('rejects a missing client', async () => {
    const repo = repository();
    vi.mocked(repo.clientExists).mockResolvedValue(false);
    await expect(new ContractService(repo, undefined, now).create(input)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate number', async () => {
    const repo = repository();
    vi.mocked(repo.findByNumber).mockResolvedValue(contract);
    await expect(new ContractService(repo, undefined, now).create(input)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('requests the required listing order', async () => {
    const repo = repository();
    await new ContractService(repo, undefined, now).list();
    expect(repo.findMany).toHaveBeenCalledWith({
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  });

  it('finds a contract by ID and rejects a missing one', async () => {
    const repo = repository();
    const service = new ContractService(repo, undefined, now);
    await expect(service.getById(contract.id)).resolves.toEqual(contract);
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.getById(contract.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates a non-closed contract and recalculates its status', async () => {
    const repo = repository();
    const changed = { ...input, number: 'CTR-002', dueDate: new Date('2026-07-16T00:00:00.000Z') };
    await new ContractService(repo, undefined, now).update(contract.id, changed);
    expect(repo.update).toHaveBeenCalledWith(contract.id, {
      ...changed,
      status: ContractStatus.EXPIRED,
      closedAt: null,
    });
  });

  it('closes an active or expired contract with a timestamp', async () => {
    const repo = repository();
    await new ContractService(repo, undefined, now).close(contract.id);
    expect(repo.update).toHaveBeenCalledWith(contract.id, {
      status: ContractStatus.CLOSED,
      closedAt: now(),
    });
  });

  it('rejects duplicate closing', async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, status: ContractStatus.CLOSED, closedAt: now() });
    await expect(new ContractService(repo, undefined, now).close(contract.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('preserves status and closedAt when editing a closed contract', async () => {
    const repo = repository();
    const closedAt = new Date('2026-07-10T12:00:00.000Z');
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, status: ContractStatus.CLOSED, closedAt });
    await new ContractService(repo, undefined, now).update(contract.id, input);
    expect(repo.update).toHaveBeenCalledWith(contract.id, {
      ...input,
      status: ContractStatus.CLOSED,
      closedAt,
    });
  });

  it('logically deletes an existing contract', async () => {
    const repo = repository();
    await new ContractService(repo, undefined, now).delete(contract.id);
    expect(repo.softDelete).toHaveBeenCalledWith(contract.id, now());
  });

  it('returns zero for every summary count when there are no contracts', async () => {
    const summary = await new ContractService(repository(), undefined, now).summary();

    expect(summary).toEqual({ active: 0, expired: 0, closed: 0, total: 0 });
  });

  it('normalizes summary counts by status and calculates the total', async () => {
    const repo = repository();
    vi.mocked(repo.countByStatus).mockResolvedValue([
      { status: ContractStatus.ACTIVE, _count: 4 },
      { status: ContractStatus.EXPIRED, _count: 2 },
      { status: ContractStatus.CLOSED, _count: 3 },
    ]);

    await expect(new ContractService(repo, undefined, now).summary()).resolves.toEqual({
      active: 4,
      expired: 2,
      closed: 3,
      total: 9,
    });
  });

  it('returns zero when a status is absent from the summary aggregation', async () => {
    const repo = repository();
    vi.mocked(repo.countByStatus).mockResolvedValue([
      { status: ContractStatus.ACTIVE, _count: 1 },
      { status: ContractStatus.CLOSED, _count: 2 },
    ]);

    await expect(new ContractService(repo, undefined, now).summary()).resolves.toEqual({
      active: 1,
      expired: 0,
      closed: 2,
      total: 3,
    });
  });

  it('returns a cache hit without querying PostgreSQL', async () => {
    const repo = repository();
    const cache = summaryCache();
    const cached = { active: 4, expired: 2, closed: 1, total: 7 };
    vi.mocked(cache.get).mockResolvedValue(cached);

    await expect(new ContractService(repo, cache, now).summary()).resolves.toEqual(cached);
    expect(repo.countByStatus).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('queries PostgreSQL on a cache miss and caches the normalized summary', async () => {
    const repo = repository();
    const cache = summaryCache();
    vi.mocked(repo.countByStatus).mockResolvedValue([
      { status: ContractStatus.ACTIVE, _count: 2 },
    ]);

    const result = await new ContractService(repo, cache, now).summary();

    expect(result).toEqual({ active: 2, expired: 0, closed: 0, total: 2 });
    expect(cache.set).toHaveBeenCalledWith(result);
  });

  it.each(['create', 'update', 'close', 'delete'] as const)(
    'invalidates the summary cache after %s',
    async (operation) => {
      const repo = repository();
      const cache = summaryCache();
      const service = new ContractService(repo, cache, now);

      if (operation === 'create') await service.create(input);
      if (operation === 'update') await service.update(contract.id, input);
      if (operation === 'close') await service.close(contract.id);
      if (operation === 'delete') await service.delete(contract.id);

      expect(cache.invalidate).toHaveBeenCalledOnce();
    },
  );
});
