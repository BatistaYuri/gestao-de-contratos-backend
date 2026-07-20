import {
  ApprovalStatus,
  ContractStatus,
  Prisma,
  type Contract,
  type ContractApprovalRevision,
} from '@prisma/client';

import { AppError } from '../../erros/app-error';
import { ContractSummaryCache } from '../../infra/redis/contract-summary-cache';
import type { ClientRepository } from '../clients/client.repository';
import type {
  ContractRepository,
  ContractStatusCount,
  ContractWithClient,
} from './contract.repository';
import type {
  CreateContractInput,
  ListContractsInput,
  UpdateContractInput,
} from './contract.validate';

export type ContractSummary = {
  active: number;
  expired: number;
  closed: number;
  total: number;
};

export class ContractService {
  constructor(
    private readonly repository: ContractRepository,
    private readonly clientRepository: Pick<ClientRepository, 'existsActive'>,
    private readonly summaryCache?: ContractSummaryCache,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: CreateContractInput): Promise<ContractWithClient> {
    await this.ensureClientExists(input.clientId);
    await this.ensureUniqueNumber(input.number);
    const totals = this.calculateTotals(input);
    const contract = await this.repository.create({ ...input, ...totals, status: this.statusFor(input.dueDate) });
    await this.summaryCache?.invalidate();
    return contract;
  }

  list(filters: ListContractsInput = {}): Promise<ContractWithClient[]> {
    return this.repository.findMany({
      where: filters,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string): Promise<ContractWithClient> {
    return this.requireContract(id);
  }

  async update(id: string, input: UpdateContractInput): Promise<ContractWithClient> {
    const contract = await this.requireContract(id);
    this.ensureEditable(contract);
    await this.ensureClientExists(input.clientId);
    await this.ensureUniqueNumber(input.number, id);

    const updated = await this.repository.replace(id, {
      ...input,
      ...this.calculateTotals(input),
      status: this.statusFor(input.dueDate),
    });
    await this.summaryCache?.invalidate();
    return updated;
  }

  async close(id: string): Promise<ContractWithClient> {
    const contract = await this.requireContract(id);
    if (contract.status === ContractStatus.CLOSED) {
      throw new AppError('Contract is already closed', 409);
    }
    if (contract.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new AppError('Only approved contracts can be closed', 409);
    }
    const closed = await this.repository.update(id, { status: ContractStatus.CLOSED, closedAt: this.now() });
    await this.summaryCache?.invalidate();
    return closed;
  }

  async submit(id: string): Promise<ContractWithClient> {
    const contract = await this.requireContract(id);
    if (contract.approvalStatus !== ApprovalStatus.DRAFT && contract.approvalStatus !== ApprovalStatus.REJECTED) {
      throw new AppError('Only draft or rejected contracts can be submitted', 409);
    }
    const updated = await this.repository.submitForApproval(
      id,
      this.snapshot(contract),
      this.now(),
    );
    await this.summaryCache?.invalidate();
    return updated;
  }

  async approve(id: string): Promise<ContractWithClient> {
    const contract = await this.requireContract(id);
    this.ensurePending(contract);
    return this.decideApproval(id, ApprovalStatus.APPROVED);
  }

  async reject(id: string, reason: string): Promise<ContractWithClient> {
    const contract = await this.requireContract(id);
    this.ensurePending(contract);
    return this.decideApproval(id, ApprovalStatus.REJECTED, reason);
  }

  async approvalHistory(id: string): Promise<ContractApprovalRevision[]> {
    await this.requireContract(id);
    return this.repository.findApprovalHistory(id);
  }

  async delete(id: string): Promise<void> {
    await this.requireContract(id);
    await this.repository.softDelete(id, this.now());
    await this.summaryCache?.invalidate();
  }

  async summary(): Promise<ContractSummary> {
    const cached = await this.summaryCache?.get();
    if (cached) return cached;

    const summary = this.normalizeSummary(await this.repository.countByStatus());
    await this.summaryCache?.set(summary);
    return summary;
  }

  private statusFor(dueDate: Date): Contract['status'] {
    const now = this.now();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    return dueDate < today ? ContractStatus.EXPIRED : ContractStatus.ACTIVE;
  }

  private async ensureClientExists(id: string): Promise<void> {
    if (!(await this.clientRepository.existsActive(id))) throw new AppError('Client not found', 404);
  }

  private async ensureUniqueNumber(number: string, currentId?: string): Promise<void> {
    const existing = await this.repository.findByNumber(number);
    if (existing && existing.id !== currentId) {
      throw new AppError('A contract with this number already exists', 409);
    }
  }

  private async requireContract(id: string): Promise<ContractWithClient> {
    const contract = await this.repository.findById(id);
    if (!contract) throw new AppError('Contract not found', 404);
    return contract;
  }

  private ensureEditable(contract: Contract): void {
    if (contract.approvalStatus !== ApprovalStatus.DRAFT && contract.approvalStatus !== ApprovalStatus.REJECTED) {
      throw new AppError('Only draft or rejected contracts can be edited', 409);
    }
  }

  private ensurePending(contract: Contract): void {
    if (contract.approvalStatus !== ApprovalStatus.PENDING) {
      throw new AppError('Only pending contracts can be approved or rejected', 409);
    }
  }

  private snapshot(contract: ContractWithClient): Prisma.InputJsonValue {
    return {
      number: contract.number,
      clientId: contract.clientId,
      value: contract.value.toString(),
      type: contract.type,
      dueDate: contract.dueDate.toISOString().slice(0, 10),
      currency: contract.currency,
      discount: contract.discount.toString(),
      additionalFees: contract.additionalFees.toString(),
      subtotal: contract.subtotal.toString(),
      items: contract.items.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
      })),
    };
  }

  private calculateTotals(input: CreateContractInput): { subtotal: Prisma.Decimal; value: Prisma.Decimal } {
    const subtotal = input.items.reduce(
      (sum, item) => sum.plus(new Prisma.Decimal(item.quantity).times(item.unitPrice)),
      new Prisma.Decimal(0),
    ).toDecimalPlaces(2);
    return {
      subtotal,
      value: subtotal.minus(input.discount).plus(input.additionalFees).toDecimalPlaces(2),
    };
  }

  private async decideApproval(
    id: string,
    status: typeof ApprovalStatus.APPROVED | typeof ApprovalStatus.REJECTED,
    reason?: string,
  ): Promise<ContractWithClient> {
    const updated = await this.repository.decideApproval(id, status, this.now(), reason);
    await this.summaryCache?.invalidate();
    return updated;
  }

  private normalizeSummary(counts: ContractStatusCount[]) {
    const countByStatus = new Map(counts.map(({ status, _count }) => [status, _count]));
    const active = countByStatus.get(ContractStatus.ACTIVE) ?? 0;
    const expired = countByStatus.get(ContractStatus.EXPIRED) ?? 0;
    const closed = countByStatus.get(ContractStatus.CLOSED) ?? 0;
    return { active, expired, closed, total: active + expired + closed };
  }
}
