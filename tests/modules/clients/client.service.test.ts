import type { Client } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { ClientRepository } from '../../../src/modules/clients/client.repository';
import { ClientService } from '../../../src/modules/clients/client.service';

const client: Client = {
  id: '06f37985-9f78-4ced-95bb-d9328e30f93c',
  name: 'Acme Ltda',
  document: '12345678000190',
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createRepository(): ClientRepository {
  return {
    create: vi.fn().mockResolvedValue(client),
    findByDocument: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    findById: vi.fn().mockResolvedValue(client),
    update: vi.fn().mockResolvedValue(client),
    softDelete: vi.fn().mockResolvedValue(undefined),
    countNonDeletedContracts: vi.fn().mockResolvedValue(0),
    existsActive: vi.fn().mockResolvedValue(true),
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
    vi.mocked(repository.count).mockResolvedValue(2);
    const service = new ClientService(repository);

    await expect(service.list()).resolves.toEqual({
      data: orderedClients,
      pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });
    expect(repository.findMany).toHaveBeenCalledWith({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 20,
    });
  });

  it('applies pagination offsets and returns metadata', async () => {
    const repository = createRepository();
    vi.mocked(repository.findMany).mockResolvedValue([client]);
    vi.mocked(repository.count).mockResolvedValue(41);

    await expect(new ClientService(repository).list({ page: 3, pageSize: 20 })).resolves.toEqual({
      data: [client],
      pagination: { page: 3, pageSize: 20, total: 41, totalPages: 3 },
    });
    expect(repository.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
  });

  it('keeps a soft-deleted client document reserved', async () => {
    const repository = createRepository();
    vi.mocked(repository.findByDocument).mockResolvedValue({
      ...client,
      deletedAt: new Date('2026-07-19T00:00:00.000Z'),
    });

    await expect(new ClientService(repository).create({
      name: 'Another client',
      document: client.document,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('gets an existing client and rejects missing or deleted clients', async () => {
    const repository = createRepository();
    const service = new ClientService(repository);

    await expect(service.getById(client.id)).resolves.toEqual(client);
    vi.mocked(repository.findById).mockResolvedValue(null);
    await expect(service.getById(client.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updates a client and allows it to retain its own document', async () => {
    const repository = createRepository();
    vi.mocked(repository.findByDocument).mockResolvedValue(client);
    const service = new ClientService(repository);
    const input = { name: 'Acme Updated', document: client.document };

    await expect(service.update(client.id, input)).resolves.toEqual(client);
    expect(repository.update).toHaveBeenCalledWith(client.id, input);
  });

  it('rejects an update using another client document', async () => {
    const repository = createRepository();
    vi.mocked(repository.findByDocument).mockResolvedValue({ ...client, id: 'fd47b772-c71d-40e3-9dd0-c074745023ac' });
    const service = new ClientService(repository);

    await expect(service.update(client.id, { name: 'Updated', document: client.document }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects updating a missing client before checking uniqueness', async () => {
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(new ClientService(repository).update(client.id, {
      name: client.name,
      document: client.document,
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.findByDocument).not.toHaveBeenCalled();
  });

  it('soft deletes a client without non-deleted contracts', async () => {
    const repository = createRepository();
    const now = new Date('2026-07-20T12:00:00.000Z');

    await new ClientService(repository, () => now).delete(client.id);

    expect(repository.countNonDeletedContracts).toHaveBeenCalledWith(client.id);
    expect(repository.softDelete).toHaveBeenCalledWith(client.id, now);
  });

  it('blocks deletion when a non-deleted contract exists', async () => {
    const repository = createRepository();
    vi.mocked(repository.countNonDeletedContracts).mockResolvedValue(1);

    await expect(new ClientService(repository).delete(client.id))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('allows deletion when all related contracts are soft-deleted', async () => {
    const repository = createRepository();
    vi.mocked(repository.countNonDeletedContracts).mockResolvedValue(0);

    await new ClientService(repository).delete(client.id);

    expect(repository.softDelete).toHaveBeenCalledOnce();
  });

  it('returns not found when deleting an already deleted client', async () => {
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(new ClientService(repository).delete(client.id))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(repository.countNonDeletedContracts).not.toHaveBeenCalled();
  });
});
