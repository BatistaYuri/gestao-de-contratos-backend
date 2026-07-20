import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clientFindMany, clientFindFirst, clientCount, contractCount } = vi.hoisted(() => ({
  clientFindMany: vi.fn(),
  clientFindFirst: vi.fn(),
  clientCount: vi.fn(),
  contractCount: vi.fn(),
}));

vi.mock('../../../src/infra/database/prisma', () => ({
  prisma: {
    client: {
      findMany: clientFindMany,
      findFirst: clientFindFirst,
      count: clientCount,
    },
    contract: { count: contractCount },
  },
}));

import { PrismaClientRepository } from '../../../src/modules/clients/client.repository';

describe('PrismaClientRepository soft-deletion queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('excludes soft-deleted clients from the alphabetical listing', async () => {
    clientFindMany.mockResolvedValue([]);

    await new PrismaClientRepository().findMany({ orderBy: { name: 'asc' } });

    expect(clientFindMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      where: { deletedAt: null },
    });
  });

  it('excludes soft-deleted clients from detail lookup', async () => {
    clientFindFirst.mockResolvedValue(null);
    const id = '06f37985-9f78-4ced-95bb-d9328e30f93c';

    await new PrismaClientRepository().findById(id);

    expect(clientFindFirst).toHaveBeenCalledWith({
      where: { id, deletedAt: null },
    });
  });

  it('counts only non-deleted contracts when deciding whether deletion is allowed', async () => {
    contractCount.mockResolvedValue(0);
    const id = '06f37985-9f78-4ced-95bb-d9328e30f93c';

    await new PrismaClientRepository().countNonDeletedContracts(id);

    expect(contractCount).toHaveBeenCalledWith({
      where: { clientId: id, deletedAt: null },
    });
  });

  it('considers only non-deleted clients eligible for contracts', async () => {
    clientCount.mockResolvedValue(0);
    const id = '06f37985-9f78-4ced-95bb-d9328e30f93c';

    await expect(new PrismaClientRepository().existsActive(id)).resolves.toBe(false);
    expect(clientCount).toHaveBeenCalledWith({
      where: { id, deletedAt: null },
    });
  });
});
