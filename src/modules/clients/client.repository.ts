import { prisma } from '../../infra/database/prisma';
import type { Client, Prisma } from '@prisma/client';
import type { CreateClientInput, UpdateClientInput } from './client.validate';

export interface ClientRepository {
  create(data: CreateClientInput): Promise<Client>;
  findByDocument(document: string): Promise<Client | null>;
  findMany(options: Prisma.ClientFindManyArgs): Promise<Client[]>;
  count(): Promise<number>;
  findById(id: string): Promise<Client | null>;
  update(id: string, data: UpdateClientInput): Promise<Client>;
  softDelete(id: string, deletedAt: Date): Promise<void>;
  countNonDeletedContracts(id: string): Promise<number>;
  existsActive(id: string): Promise<boolean>;
}

export class PrismaClientRepository implements ClientRepository {
  create(data: CreateClientInput): Promise<Client> {
    return prisma.client.create({ data });
  }

  findByDocument(document: string): Promise<Client | null> {
    return prisma.client.findUnique({ where: { document } });
  }

  findMany(options: Prisma.ClientFindManyArgs): Promise<Client[]> {
    return prisma.client.findMany({ ...options, where: { deletedAt: null } });
  }

  count(): Promise<number> {
    return prisma.client.count({ where: { deletedAt: null } });
  }

  findById(id: string): Promise<Client | null> {
    return prisma.client.findFirst({ where: { id, deletedAt: null } });
  }

  update(id: string, data: UpdateClientInput): Promise<Client> {
    return prisma.client.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedAt: Date): Promise<void> {
    await prisma.client.update({ where: { id }, data: { deletedAt } });
  }

  countNonDeletedContracts(id: string): Promise<number> {
    return prisma.contract.count({ where: { clientId: id, deletedAt: null } });
  }

  async existsActive(id: string): Promise<boolean> {
    return (await prisma.client.count({ where: { id, deletedAt: null } })) > 0;
  }
}
