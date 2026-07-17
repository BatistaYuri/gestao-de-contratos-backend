import type { Client, Contract, Prisma } from '@prisma/client';

import { prisma } from '../../database/prisma';
import type {
  CreateContractInput,
  UpdateContractInput,
} from './contract.validate';

export type ContractWithClient = Contract & { client: Client };

export interface ContractRepository {
  clientExists(id: string): Promise<boolean>;
  create(data: CreateContractInput & { status: Contract['status'] }): Promise<ContractWithClient>;
  findByNumber(number: string): Promise<Contract | null>;
  findMany(options: Prisma.ContractFindManyArgs): Promise<ContractWithClient[]>;
  findById(id: string): Promise<ContractWithClient | null>;
  update(id: string, data: Partial<UpdateContractInput> & Pick<Contract, 'status' | 'closedAt'>): Promise<ContractWithClient>;
  softDelete(id: string, deletedAt: Date): Promise<void>;
}

const includeClient = { client: true } as const;

export class PrismaContractRepository implements ContractRepository {
  async clientExists(id: string): Promise<boolean> {
    return (await prisma.client.count({ where: { id } })) > 0;
  }

  create(data: CreateContractInput & { status: Contract['status'] }): Promise<ContractWithClient> {
    return prisma.contract.create({ data, include: includeClient });
  }

  findByNumber(number: string): Promise<Contract | null> {
    return prisma.contract.findUnique({ where: { number } });
  }

  findMany(options: Prisma.ContractFindManyArgs): Promise<ContractWithClient[]> {
    return prisma.contract.findMany({
      ...options,
      where: { ...options.where, deletedAt: null },
      include: includeClient,
    }) as Promise<ContractWithClient[]>;
  }

  findById(id: string): Promise<ContractWithClient | null> {
    return prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: includeClient,
    });
  }

  update(id: string, data: Partial<UpdateContractInput> & Pick<Contract, 'status' | 'closedAt'>): Promise<ContractWithClient> {
    return prisma.contract.update({ where: { id }, data, include: includeClient });
  }

  async softDelete(id: string, deletedAt: Date): Promise<void> {
    await prisma.contract.update({ where: { id }, data: { deletedAt } });
  }
}
