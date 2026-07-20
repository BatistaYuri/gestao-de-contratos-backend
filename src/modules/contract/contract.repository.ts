import type {
  ApprovalStatus,
  Client,
  Contract,
  ContractApprovalRevision,
  Prisma,
} from '@prisma/client';

import { prisma } from '../../infra/database/prisma';
import type { CreateContractInput, UpdateContractInput } from './contract.validate';

export type ContractWithClient = Contract & { client: Client };
export type ContractStatusCount = { status: Contract['status']; _count: number };
export type ContractUpdateData = Partial<UpdateContractInput> & Partial<Pick<Contract, 'status' | 'closedAt'>>;

export interface ContractRepository {
  create(data: CreateContractInput & { status: Contract['status'] }): Promise<ContractWithClient>;
  findByNumber(number: string): Promise<Contract | null>;
  findMany(options: Prisma.ContractFindManyArgs): Promise<ContractWithClient[]>;
  findById(id: string): Promise<ContractWithClient | null>;
  update(id: string, data: ContractUpdateData): Promise<ContractWithClient>;
  submitForApproval(
    id: string,
    snapshot: Prisma.InputJsonValue,
    submittedAt: Date,
  ): Promise<ContractWithClient>;
  decideApproval(
    id: string,
    status: Extract<ApprovalStatus, 'APPROVED' | 'REJECTED'>,
    decidedAt: Date,
    rejectionReason?: string,
  ): Promise<ContractWithClient>;
  findApprovalHistory(id: string): Promise<ContractApprovalRevision[]>;
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

  update(id: string, data: ContractUpdateData): Promise<ContractWithClient> {
    return prisma.contract.update({ where: { id }, data, include: includeClient });
  }

  async submitForApproval(
    id: string,
    snapshot: Prisma.InputJsonValue,
    submittedAt: Date,
  ): Promise<ContractWithClient> {
    return prisma.$transaction(async (transaction) => {
      const latest = await transaction.contractApprovalRevision.findFirst({
        where: { contractId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await transaction.contractApprovalRevision.create({
        data: {
          contractId: id,
          version: (latest?.version ?? 0) + 1,
          snapshot,
          submittedAt,
        },
      });
      return transaction.contract.update({
        where: { id },
        data: { approvalStatus: 'PENDING' },
        include: includeClient,
      });
    });
  }

  async decideApproval(
    id: string,
    status: Extract<ApprovalStatus, 'APPROVED' | 'REJECTED'>,
    decidedAt: Date,
    rejectionReason?: string,
  ): Promise<ContractWithClient> {
    return prisma.$transaction(async (transaction) => {
      const revision = await transaction.contractApprovalRevision.findFirstOrThrow({
        where: { contractId: id, status: 'PENDING' },
        orderBy: { version: 'desc' },
      });
      await transaction.contractApprovalRevision.update({
        where: { id: revision.id },
        data: { status, decidedAt, rejectionReason },
      });
      return transaction.contract.update({
        where: { id },
        data: { approvalStatus: status },
        include: includeClient,
      });
    });
  }

  findApprovalHistory(id: string): Promise<ContractApprovalRevision[]> {
    return prisma.contractApprovalRevision.findMany({
      where: { contractId: id },
      orderBy: { version: 'asc' },
    });
  }

  async softDelete(id: string, deletedAt: Date): Promise<void> {
    await prisma.contract.update({ where: { id }, data: { deletedAt } });
  }

  async countByStatus(): Promise<ContractStatusCount[]> {
    const counts = await prisma.contract.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });
    return counts;
  }

  async updateStatusBefore(currentStatus: Contract['status'], dueBefore: Date, newStatus: Contract['status']): Promise<number> {
    const result = await prisma.contract.updateMany({
      where: { status: currentStatus, dueDate: { lt: dueBefore }, deletedAt: null },
      data: { status: newStatus },
    });
    return result.count;
  }
}
