import { ApprovalStatus, ContractStatus, ContractType, Prisma, type Client, type Contract, type ContractItem } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { ContractRepository, ContractWithClient } from '../../../src/modules/contract/contract.repository';
import { ContractService } from '../../../src/modules/contract/contract.service';
import { ContractSummaryCache } from '../../../src/infra/redis/contract-summary-cache';
import type { ClientRepository } from '../../../src/modules/clients/client.repository';

const client: Client = {
  id: '06f37985-9f78-4ced-95bb-d9328e30f93c',
  name: 'Acme',
  document: '123',
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const contract: ContractWithClient = {
  id: 'fd47b772-c71d-40e3-9dd0-c074745023ac',
  number: 'CTR-001',
  clientId: client.id,
  value: 100 as unknown as Contract['value'],
  subtotal: 100 as unknown as Contract['subtotal'],
  type: ContractType.SERVICE,
  approvalStatus: ApprovalStatus.DRAFT,
  currency: 'BRL',
  discount: 0 as unknown as Contract['discount'],
  additionalFees: 0 as unknown as Contract['additionalFees'],
  dueDate: new Date('2026-07-18T00:00:00.000Z'),
  status: ContractStatus.ACTIVE,
  closedAt: null,
  deletedAt: null,
  createdAt: new Date('2026-07-17T10:00:00.000Z'),
  updatedAt: new Date('2026-07-17T10:00:00.000Z'),
  client,
  items: [{
    id: '3cd41f54-36d9-4c83-8162-c58514c347fa',
    contractId: 'fd47b772-c71d-40e3-9dd0-c074745023ac',
    description: 'Consulting',
    quantity: 1 as unknown as ContractItem['quantity'],
    unitPrice: 100 as unknown as ContractItem['unitPrice'],
    createdAt: new Date('2026-07-17T10:00:00.000Z'),
    updatedAt: new Date('2026-07-17T10:00:00.000Z'),
  }],
};

const input = {
  number: contract.number,
  clientId: contract.clientId,
  type: ContractType.SERVICE,
  dueDate: contract.dueDate,
  currency: 'BRL' as const,
  discount: '0',
  additionalFees: '0',
  items: [{ description: 'Consulting', quantity: '1', unitPrice: '100.00' }],
};

function repository(): ContractRepository {
  return {
    create: vi.fn().mockResolvedValue(contract),
    findByNumber: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(contract),
    update: vi.fn().mockResolvedValue(contract),
    replace: vi.fn().mockResolvedValue(contract),
    submitForApproval: vi.fn().mockResolvedValue(contract),
    decideApproval: vi.fn().mockResolvedValue(contract),
    findApprovalHistory: vi.fn().mockResolvedValue([]),
    softDelete: vi.fn().mockResolvedValue(undefined),
    countByStatus: vi.fn().mockResolvedValue([]),
    updateStatusBefore: vi.fn().mockResolvedValue(0),
  };
}

function clientLookup(): Pick<ClientRepository, 'existsActive'> {
  return { existsActive: vi.fn().mockResolvedValue(true) };
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
    const service = new ContractService(repo, clientLookup(), undefined, now);
    await service.create({ ...input, dueDate: new Date(`${date}T00:00:00.000Z`) });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status }));
  });

  it('rejects a missing or soft-deleted client', async () => {
    const repo = repository();
    const clients = clientLookup();
    vi.mocked(clients.existsActive).mockResolvedValue(false);
    await expect(new ContractService(repo, clients, undefined, now).create(input)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate number', async () => {
    const repo = repository();
    vi.mocked(repo.findByNumber).mockResolvedValue(contract);
    await expect(new ContractService(repo, clientLookup(), undefined, now).create(input)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('calculates subtotal and total from multiple items, discount, and fees', async () => {
    const repo = repository();
    await new ContractService(repo, clientLookup(), undefined, now).create({
      ...input,
      discount: '100.00',
      additionalFees: '25.00',
      items: [
        { description: 'Consulting', quantity: '10', unitPrice: '150.00' },
        { description: 'Support', quantity: '2', unitPrice: '500.00' },
      ],
    });
    const persisted = vi.mocked(repo.create).mock.calls[0][0];
    expect(persisted.subtotal.toString()).toBe('2500');
    expect(persisted.value.toString()).toBe('2425');
  });

  it('rounds the summed fractional item totals to two decimal places', async () => {
    const repo = repository();
    await new ContractService(repo, clientLookup(), undefined, now).create({
      ...input,
      items: [{ description: 'Fractional item', quantity: '1.005', unitPrice: '10.00' }],
    });
    const persisted = vi.mocked(repo.create).mock.calls[0][0];
    expect(persisted.subtotal.toString()).toBe('10.05');
    expect(persisted.value.toString()).toBe('10.05');
  });

  it('requests the required listing order', async () => {
    const repo = repository();
    await new ContractService(repo, clientLookup(), undefined, now).list();
    expect(repo.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  });

  it('passes contract filters to the repository', async () => {
    const repo = repository();
    const filters = {
      status: ContractStatus.ACTIVE,
      type: ContractType.SERVICE,
      approvalStatus: ApprovalStatus.PENDING,
      clientId: client.id,
    };
    await new ContractService(repo, clientLookup(), undefined, now).list(filters);
    expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: filters }));
  });

  it('finds a contract by ID and rejects a missing one', async () => {
    const repo = repository();
    const service = new ContractService(repo, clientLookup(), undefined, now);
    await expect(service.getById(contract.id)).resolves.toEqual(contract);
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.getById(contract.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates a non-closed contract and recalculates its status', async () => {
    const repo = repository();
    const changed = { ...input, number: 'CTR-002', dueDate: new Date('2026-07-16T00:00:00.000Z') };
    await new ContractService(repo, clientLookup(), undefined, now).update(contract.id, changed);
    expect(repo.replace).toHaveBeenCalledWith(contract.id, {
      ...changed,
      subtotal: expect.any(Prisma.Decimal),
      value: expect.any(Prisma.Decimal),
      status: ContractStatus.EXPIRED,
    });
  });

  it('replaces all items through the atomic repository operation', async () => {
    const repo = repository();
    const changed = {
      ...input,
      items: [{ description: 'Replacement', quantity: '2.5', unitPrice: '40.00' }],
    };
    await new ContractService(repo, clientLookup(), undefined, now).update(contract.id, changed);
    expect(repo.replace).toHaveBeenCalledWith(contract.id, expect.objectContaining({
      items: changed.items,
      subtotal: expect.any(Prisma.Decimal),
      value: expect.any(Prisma.Decimal),
    }));
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects updating a contract to use a soft-deleted client', async () => {
    const repo = repository();
    const clients = clientLookup();
    vi.mocked(clients.existsActive).mockResolvedValue(false);

    await expect(new ContractService(repo, clients, undefined, now).update(contract.id, input))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(repo.replace).not.toHaveBeenCalled();
  });

  it('closes an active or expired contract with a timestamp', async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, approvalStatus: ApprovalStatus.APPROVED });
    await new ContractService(repo, clientLookup(), undefined, now).close(contract.id);
    expect(repo.update).toHaveBeenCalledWith(contract.id, {
      status: ContractStatus.CLOSED,
      closedAt: now(),
    });
  });

  it('rejects duplicate closing', async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, status: ContractStatus.CLOSED, closedAt: now() });
    await expect(new ContractService(repo, clientLookup(), undefined, now).close(contract.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('rejects closing a contract that is not approved', async () => {
    const repo = repository();
    await expect(new ContractService(repo, clientLookup(), undefined, now).close(contract.id))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each([ApprovalStatus.DRAFT, ApprovalStatus.REJECTED])('submits a %s contract', async (approvalStatus) => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, approvalStatus });
    await new ContractService(repo, clientLookup(), undefined, now).submit(contract.id);
    expect(repo.submitForApproval).toHaveBeenCalledWith(
      contract.id,
      expect.objectContaining({ number: contract.number, value: '100', subtotal: '100', type: ContractType.SERVICE }),
      now(),
    );
  });

  it('approves a pending contract', async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, approvalStatus: ApprovalStatus.PENDING });
    await new ContractService(repo, clientLookup(), undefined, now).approve(contract.id);
    expect(repo.decideApproval).toHaveBeenCalledWith(
      contract.id, ApprovalStatus.APPROVED, now(), undefined,
    );
  });

  it('rejects a pending contract with its reason', async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, approvalStatus: ApprovalStatus.PENDING });
    await new ContractService(repo, clientLookup(), undefined, now).reject(contract.id, 'Commercial mismatch');
    expect(repo.decideApproval).toHaveBeenCalledWith(
      contract.id, ApprovalStatus.REJECTED, now(), 'Commercial mismatch',
    );
  });

  it('returns the approval history after ensuring the contract exists', async () => {
    const repo = repository();
    const history = [{ id: 'revision-1', version: 1 }];
    vi.mocked(repo.findApprovalHistory).mockResolvedValue(history as never);
    await expect(new ContractService(repo, clientLookup(), undefined, now).approvalHistory(contract.id))
      .resolves.toEqual(history);
    expect(repo.findById).toHaveBeenCalledWith(contract.id);
    expect(repo.findApprovalHistory).toHaveBeenCalledWith(contract.id);
  });

  it.each([
    ['submit', ApprovalStatus.PENDING],
    ['approve', ApprovalStatus.DRAFT],
    ['reject', ApprovalStatus.APPROVED],
  ] as const)('rejects the forbidden %s transition', async (operation, approvalStatus) => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, approvalStatus });
    const service = new ContractService(repo, clientLookup(), undefined, now);
    const result = operation === 'reject'
      ? service.reject(contract.id, 'Reason')
      : service[operation](contract.id);
    await expect(result).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.submitForApproval).not.toHaveBeenCalled();
    expect(repo.decideApproval).not.toHaveBeenCalled();
  });

  it('rejects editing an approved contract', async () => {
    const repo = repository();
    vi.mocked(repo.findById).mockResolvedValue({ ...contract, approvalStatus: ApprovalStatus.APPROVED });
    await expect(new ContractService(repo, clientLookup(), undefined, now).update(contract.id, input))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repo.replace).not.toHaveBeenCalled();
  });

  it('logically deletes an existing contract', async () => {
    const repo = repository();
    await new ContractService(repo, clientLookup(), undefined, now).delete(contract.id);
    expect(repo.softDelete).toHaveBeenCalledWith(contract.id, now());
  });

  it('returns zero for every summary count when there are no contracts', async () => {
    const summary = await new ContractService(repository(), clientLookup(), undefined, now).summary();

    expect(summary).toEqual({ active: 0, expired: 0, closed: 0, total: 0 });
  });

  it('normalizes summary counts by status and calculates the total', async () => {
    const repo = repository();
    vi.mocked(repo.countByStatus).mockResolvedValue([
      { status: ContractStatus.ACTIVE, _count: 4 },
      { status: ContractStatus.EXPIRED, _count: 2 },
      { status: ContractStatus.CLOSED, _count: 3 },
    ]);

    await expect(new ContractService(repo, clientLookup(), undefined, now).summary()).resolves.toEqual({
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

    await expect(new ContractService(repo, clientLookup(), undefined, now).summary()).resolves.toEqual({
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

    await expect(new ContractService(repo, clientLookup(), cache, now).summary()).resolves.toEqual(cached);
    expect(repo.countByStatus).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('queries PostgreSQL on a cache miss and caches the normalized summary', async () => {
    const repo = repository();
    const cache = summaryCache();
    vi.mocked(repo.countByStatus).mockResolvedValue([
      { status: ContractStatus.ACTIVE, _count: 2 },
    ]);

    const result = await new ContractService(repo, clientLookup(), cache, now).summary();

    expect(result).toEqual({ active: 2, expired: 0, closed: 0, total: 2 });
    expect(cache.set).toHaveBeenCalledWith(result);
  });

  it('applies the list filters to the summary and bypasses the global cache', async () => {
    const repo = repository();
    const cache = summaryCache();
    const filters = {
      status: ContractStatus.ACTIVE,
      type: ContractType.SERVICE,
      approvalStatus: ApprovalStatus.APPROVED,
      clientId: client.id,
    };
    vi.mocked(repo.countByStatus).mockResolvedValue([
      { status: ContractStatus.ACTIVE, _count: 2 },
    ]);

    await expect(new ContractService(repo, clientLookup(), cache, now).summary(filters)).resolves.toEqual({
      active: 2,
      expired: 0,
      closed: 0,
      total: 2,
    });
    expect(repo.countByStatus).toHaveBeenCalledWith(filters);
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it.each(['create', 'update', 'close', 'delete'] as const)(
    'invalidates the summary cache after %s',
    async (operation) => {
      const repo = repository();
      const cache = summaryCache();
      const service = new ContractService(repo, clientLookup(), cache, now);

      if (operation === 'create') await service.create(input);
      if (operation === 'update') await service.update(contract.id, input);
      if (operation === 'close') {
        vi.mocked(repo.findById).mockResolvedValue({ ...contract, approvalStatus: ApprovalStatus.APPROVED });
        await service.close(contract.id);
      }
      if (operation === 'delete') await service.delete(contract.id);

      expect(cache.invalidate).toHaveBeenCalledOnce();
    },
  );
});
