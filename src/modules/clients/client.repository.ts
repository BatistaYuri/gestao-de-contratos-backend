import { prisma } from '../../infra/database/prisma';
import type { Client } from '@prisma/client';
import type { CreateClientInput } from './client.validate';

export interface ClientRepository {
  create(data: CreateClientInput): Promise<Client>;
  findByDocument(document: string): Promise<Client | null>;
  findMany(options: { orderBy: { name: 'asc' } }): Promise<Client[]>;
}

export class PrismaClientRepository implements ClientRepository {
  create(data: CreateClientInput): Promise<Client> {
    return prisma.client.create({ data });
  }

  findByDocument(document: string): Promise<Client | null> {
    return prisma.client.findUnique({ where: { document } });
  }

  findMany(options: { orderBy: { name: 'asc' } }): Promise<Client[]> {
    return prisma.client.findMany(options);
  }
}
