import type {
  ApprovalStatus,
  Client,
  Contract,
  ContractApprovalRevision,
  ContractItem,
  Prisma,
} from '@prisma/client';

import { prisma } from '../../infra/database/prisma';
import type { CreateContractInput, ListContractsInput, UpdateContractInput } from './contract.validate';

export type ContractWithClient = Contract & { client: Client; items: ContractItem[] };
export type ContractStatusCount = { status: Contract['status']; _count: number };
export type ContractUpdateData = Partial<Omit<UpdateContractInput, 'items'>> & Partial<Pick<Contract, 'status' | 'closedAt'>>;
export type ContractWriteData = Omit<CreateContractInput, 'items'> & {
  items: CreateContractInput['items'];
  subtotal: Prisma.Decimal;
  value: Prisma.Decimal;
  status: Contract['status'];
};

export interface ContractRepository {
  create(data: ContractWriteData): Promise<ContractWithClient>;
  findByNumber(number: string): Promise<Contract | null>;
  findMany(options: Prisma.ContractFindManyArgs): Promise<ContractWithClient[]>;
  findById(id: string): Promise<ContractWithClient | null>;
  update(id: string, data: ContractUpdateData): Promise<ContractWithClient>;
  replace(id: string, data: ContractWriteData): Promise<ContractWithClient>;
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
  countByStatus(filters?: ListContractsInput): Promise<ContractStatusCount[]>;
  updateStatusBefore(currentStatus: Contract['status'], dueBefore: Date, newStatus: Contract['status']): Promise<number>;
}

const includeContractRelations = { client: true, items: true } as const;

export class PrismaContractRepository implements ContractRepository {
  create({ items, ...data }: ContractWriteData): Promise<ContractWithClient> {
    return prisma.$transaction((transaction) => transaction.contract.create({
      data: { ...data, items: { create: items } },
      include: includeContractRelations,
    }));
  }

  findByNumber(number: string): Promise<Contract | null> {
    return prisma.contract.findUnique({ where: { number } });
  }

  findMany(options: Prisma.ContractFindManyArgs): Promise<ContractWithClient[]> {
    return prisma.contract.findMany({
      ...options,
      where: { ...options.where, deletedAt: null },
      include: includeContractRelations,
    }) as Promise<ContractWithClient[]>;
  }

  findById(id: string): Promise<ContractWithClient | null> {
    return prisma.contract.findFirst({
      where: { id, deletedAt: null },
      include: includeContractRelations,
    });
  }

  update(id: string, data: ContractUpdateData): Promise<ContractWithClient> {
    return prisma.contract.update({ where: { id }, data, include: includeContractRelations });
  }

  replace(id: string, { items, ...data }: ContractWriteData): Promise<ContractWithClient> {
    return prisma.$transaction(async (transaction) => {
      await transaction.contractItem.deleteMany({ where: { contractId: id } });
      return transaction.contract.update({
        where: { id },
        data: { ...data, items: { create: items } },
        include: includeContractRelations,
      });
    });
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
        include: includeContractRelations,
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
        include: includeContractRelations,
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

  async countByStatus(filters: ListContractsInput = {}): Promise<ContractStatusCount[]> {
    const counts = await prisma.contract.groupBy({
      by: ['status'],
      where: { ...filters, deletedAt: null },
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
