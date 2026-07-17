import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { describe, expect, it, vi } from 'vitest';
import { CONTRACT_EXPIRATION_MESSAGE_TYPE, ContractExpirationQueue } from '../../src/infra/queue/contract-expiration-queue';

function channel() {
  return {
    ack: vi.fn(),
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    consume: vi.fn(),
    nack: vi.fn(),
    prefetch: vi.fn(),
    publish: vi.fn().mockReturnValue(true),
    waitForConfirms: vi.fn().mockResolvedValue(undefined),
  };
}

function message(attempt = 1): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify({ type: CONTRACT_EXPIRATION_MESSAGE_TYPE })),
    fields: {} as ConsumeMessage['fields'],
    properties: {
      headers: { attempt },
      type: CONTRACT_EXPIRATION_MESSAGE_TYPE,
    } as unknown as ConsumeMessage['properties'],
  };
}

describe('ContractExpirationQueue consumer coordination', () => {
  it('acknowledges a message only after successful processing', async () => {
    const rabbit = channel();
    const handler = vi.fn().mockResolvedValue(undefined);
    await new ContractExpirationQueue(rabbit as unknown as ConfirmChannel).handle(
      message(),
      handler,
    );
    expect(handler).toHaveBeenCalledOnce();
    expect(rabbit.ack).toHaveBeenCalledOnce();
  });

  it('publishes a persistent confirmed retry after a processing failure', async () => {
    const rabbit = channel();
    await new ContractExpirationQueue(rabbit as unknown as ConfirmChannel).handle(
      message(1),
      vi.fn().mockRejectedValue(new Error('failure')),
    );

    expect(rabbit.publish).toHaveBeenCalledWith(
      'contracts',
      'contracts.expire.retry.2',
      expect.any(Buffer),
      expect.objectContaining({
        headers: { attempt: 2 },
        persistent: true,
        type: CONTRACT_EXPIRATION_MESSAGE_TYPE,
      }),
    );
    expect(rabbit.waitForConfirms).toHaveBeenCalledOnce();
    expect(rabbit.ack).toHaveBeenCalledOnce();
  });

  it('sends the message to the dead-letter queue after the third failure', async () => {
    const rabbit = channel();
    await new ContractExpirationQueue(rabbit as unknown as ConfirmChannel).handle(
      message(3),
      vi.fn().mockRejectedValue(new Error('failure')),
    );
    expect(rabbit.publish).toHaveBeenCalledWith(
      'contracts',
      'contracts.expire.dead',
      expect.any(Buffer),
      expect.objectContaining({ headers: { attempt: 4 } }),
    );
    expect(rabbit.ack).toHaveBeenCalledOnce();
  });

  it('requeues the original message when retry publication is not confirmed', async () => {
    const rabbit = channel();
    rabbit.waitForConfirms.mockRejectedValue(new Error('not confirmed'));
    await new ContractExpirationQueue(rabbit as unknown as ConfirmChannel).handle(
      message(),
      vi.fn().mockRejectedValue(new Error('failure')),
    );
    expect(rabbit.ack).not.toHaveBeenCalled();
    expect(rabbit.nack).toHaveBeenCalledWith(expect.anything(), false, true);
  });
});
