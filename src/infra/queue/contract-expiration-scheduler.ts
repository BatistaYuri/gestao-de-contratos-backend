import { ContractExpirationQueue } from './contract-expiration-queue';

export class ContractExpirationScheduler {
  constructor(
    private readonly queue: ContractExpirationQueue,
    private readonly intervalMs: number,
  ) {}

  async start(): Promise<void> {
    await this.queue.setup();
    await this.publish();
    setInterval(() => void this.publish(), this.intervalMs);
  }

  private async publish(): Promise<void> {
    try {
      await this.queue.publish();
      console.log('Contract expiration message published');
    } catch {
      console.error('Unable to publish contract expiration message');
    }
  }
}
