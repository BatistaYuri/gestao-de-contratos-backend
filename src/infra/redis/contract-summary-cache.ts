import { ContractSummary } from "../../modules/contract/contract.service";

const CONTRACT_SUMMARY_CACHE_KEY = 'cache:contracts:summary';

export interface ContractSummaryCache {
  get(): Promise<ContractSummary | null>;
  set(summary: ContractSummary): Promise<void>;
  invalidate(): Promise<void>;
}

type RedisCommands = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
};

export class RedisContractSummaryCache implements ContractSummaryCache {
  constructor(
    private readonly client: () => Promise<RedisCommands>,
    private readonly ttlSeconds: number,
  ) {}

  async get(): Promise<ContractSummary | null> {
    try {
      const cached = await (await this.client()).get(CONTRACT_SUMMARY_CACHE_KEY);
      if (cached === null) return null;

      const parsed: unknown = JSON.parse(cached);
      return isContractSummary(parsed) ? parsed : null;
    } catch {
      console.error('Unable to read contract summary cache');
      return null;
    }
  }

  async set(summary: ContractSummary): Promise<void> {
    try {
      await (await this.client()).set(
        CONTRACT_SUMMARY_CACHE_KEY,
        JSON.stringify(summary),
        { EX: this.ttlSeconds },
      );
    } catch {
      console.error('Unable to write contract summary cache');
    }
  }

  async invalidate(): Promise<void> {
    try {
      await (await this.client()).del(CONTRACT_SUMMARY_CACHE_KEY);
    } catch {
      console.error('Unable to invalidate contract summary cache');
    }
  }
}

function isContractSummary(value: unknown): value is ContractSummary {
  if (!value || typeof value !== 'object') return false;

  const summary = value as Record<string, unknown>;
  const counts = ['active', 'expired', 'closed', 'total'] as const;
  if (!counts.every((key) => Number.isInteger(summary[key]) && Number(summary[key]) >= 0)) {
    return false;
  }

  return summary.total === Number(summary.active) + Number(summary.expired) + Number(summary.closed);
}
