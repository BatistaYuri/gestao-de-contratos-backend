import { ContractStatus, type Contract } from '@prisma/client';

import { AppError } from '../../erros/app-error';
import type {
  ContractRepository,
  ContractStatusCount,
  ContractWithClient,
} from './contract.repository';
import type {
  CreateContractInput,
  UpdateContractInput,
} from './contract.validate';
import { ContractSummaryCache } from '../../infra/redis/contract-summary-cache';
import type { ClientRepository } from '../clients/client.repository';

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
    const contract = await this.repository.create({ ...input, status: this.statusFor(input.dueDate) });
    await this.summaryCache?.invalidate();
    return contract;
  }

  list(): Promise<ContractWithClient[]> {
    return this.repository.findMany({
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: string): Promise<ContractWithClient> {
    return this.requireContract(id);
  }

  async update(id: string, input: UpdateContractInput): Promise<ContractWithClient> {
    const contract = await this.requireContract(id);
    await this.ensureClientExists(input.clientId);
    await this.ensureUniqueNumber(input.number, id);

    const lifecycle = contract.status === ContractStatus.CLOSED
      ? { status: ContractStatus.CLOSED, closedAt: contract.closedAt }
      : { status: this.statusFor(input.dueDate), closedAt: null };

    const updated = await this.repository.update(id, { ...input, ...lifecycle });
    await this.summaryCache?.invalidate();
    return updated;
  }

  async close(id: string): Promise<ContractWithClient> {
    const contract = await this.requireContract(id);
    if (contract.status === ContractStatus.CLOSED) {
      throw new AppError('Contract is already closed', 409);
    }
    const closed = await this.repository.update(id, { status: ContractStatus.CLOSED, closedAt: this.now()});
    await this.summaryCache?.invalidate();
    return closed;
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
    if (!(await this.clientRepository.existsActive(id))) {
      throw new AppError('Client not found', 404);
    }
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

  private normalizeSummary(counts: ContractStatusCount[]) {
    const countByStatus = new Map(counts.map(({ status, _count }) => [status, _count]));
    const active = countByStatus.get(ContractStatus.ACTIVE) ?? 0;
    const expired = countByStatus.get(ContractStatus.EXPIRED) ?? 0;
    const closed = countByStatus.get(ContractStatus.CLOSED) ?? 0;
    return { active, expired, closed, total: active + expired + closed };
  }
}
