import type { Client } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { ClientRepository } from '../../src/modules/clients/client.repository';
import { ClientService } from '../../src/modules/clients/client.service';

const client: Client = {
  id: '06f37985-9f78-4ced-95bb-d9328e30f93c',
  name: 'Acme Ltda',
  document: '12345678000190',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createRepository(): ClientRepository {
  return {
    create: vi.fn().mockResolvedValue(client),
    findByDocument: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  };
}

describe('ClientService', () => {
  it('creates a valid client', async () => {
    const repository = createRepository();
    const service = new ClientService(repository);

    await expect(
      service.create({ name: client.name, document: client.document }),
    ).resolves.toEqual(client);
    expect(repository.findByDocument).toHaveBeenCalledWith(client.document);
    expect(repository.create).toHaveBeenCalledWith({
      name: client.name,
      document: client.document,
    });
  });

  it('rejects a duplicated document with conflict', async () => {
    const repository = createRepository();
    vi.mocked(repository.findByDocument).mockResolvedValue(client);
    const service = new ClientService(repository);

    await expect(
      service.create({ name: client.name, document: client.document }),
    ).rejects.toMatchObject({
      name: 'AppError',
      message: 'A client with this document already exists',
      statusCode: 409,
    });
    expect(repository.findByDocument).toHaveBeenCalledWith(client.document);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('requests the client list ordered by name', async () => {
    const repository = createRepository();
    const orderedClients = [
      { ...client, name: 'Acme Ltda' },
      { ...client, id: 'fd47b772-c71d-40e3-9dd0-c074745023ac', name: 'Beta' },
    ];
    vi.mocked(repository.findMany).mockResolvedValue(orderedClients);
    const service = new ClientService(repository);

    await expect(service.list()).resolves.toEqual(orderedClients);
    expect(repository.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
  });
});
