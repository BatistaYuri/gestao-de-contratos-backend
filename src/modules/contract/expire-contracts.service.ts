import type { ContractSummaryCache } from '../../infra/redis/contract-summary-cache';
import { ContractStatus } from '@prisma/client';
import type { ContractRepository } from './contract.repository';

export class ExpireContractsService {
  constructor(
    private readonly repository: ContractRepository,
    private readonly summaryCache: ContractSummaryCache,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<number> {
    const now = this.now();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const expiredCount = await this.repository.updateStatusBefore(
      ContractStatus.ACTIVE,
      today,
      ContractStatus.EXPIRED,
    );

    if (expiredCount > 0) {
      await this.summaryCache.invalidate();
    }

    console.log(`Contract expiration processed: ${expiredCount} contract(s) updated`);
    return expiredCount;
  }
}
