import type { Client, Contract, Prisma } from '@prisma/client';

import { prisma } from '../../infra/database/prisma';
import type {
  CreateContractInput,
  UpdateContractInput,
} from './contract.validate';

export type ContractWithClient = Contract & { client: Client };
export type ContractStatusCount = { status: Contract['status']; _count: number; };

export interface ContractRepository {
  create(data: CreateContractInput & { status: Contract['status'] }): Promise<ContractWithClient>;
  findByNumber(number: string): Promise<Contract | null>;
  findMany(options: Prisma.ContractFindManyArgs): Promise<ContractWithClient[]>;
  findById(id: string): Promise<ContractWithClient | null>;
  update(id: string, data: Partial<UpdateContractInput> & Pick<Contract, 'status' | 'closedAt'>): Promise<ContractWithClient>;
  softDelete(id: string, deletedAt: Date): Promise<void>;
  countByStatus(): Promise<ContractStatusCount[]>;
  updateStatusBefore(currentStatus: Contract['status'], dueBefore: Date, newStatus: Contract['status']): Promise<number>;
}

const includeClient = { client: true } as const;

export class PrismaContractRepository implements ContractRepository {
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

  async countByStatus(): Promise<ContractStatusCount[]> {
    const counts = await prisma.contract.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true});
    return counts;
  }

  async updateStatusBefore(currentStatus: Contract['status'], dueBefore: Date, newStatus: Contract['status']): Promise<number> {
    const result = await prisma.contract.updateMany({
      where: {
        status: currentStatus,
        dueDate: { lt: dueBefore },
        deletedAt: null,
      },
      data: { status: newStatus },
    });

    return result.count;
  }
}
