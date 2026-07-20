import { describe, expect, it } from 'vitest';
import {
  contractParamsValidate,
  createContractValidate,
  updateContractValidate,
  listContractsValidate,
  rejectContractValidate,
} from '../../../src/modules/contract/contract.validate';

const valid = {
  number: 'CTR-001',
  clientId: '06f37985-9f78-4ced-95bb-d9328e30f93c',
  value: 1500.5,
  type: 'SERVICE',
  dueDate: '2026-07-18',
};

describe('contract validation', () => {
  it('parses a valid contract and converts its due date', () => {
    expect(createContractValidate.parse(valid)).toEqual({
      ...valid,
      dueDate: new Date('2026-07-18T00:00:00.000Z'),
      currency: 'BRL',
      discount: '0',
      additionalFees: '0',
    });
  });

  it.each([
    { ...valid, number: '' },
    { ...valid, clientId: 'invalid' },
    { ...valid, value: 0 },
    { ...valid, type: 'INVALID' },
    { ...valid, currency: 'USD' },
    { ...valid, discount: '-1' },
    { ...valid, additionalFees: '-1' },
    { ...valid, discount: '1500.51' },
    { ...valid, dueDate: '2026-02-30' },
    { ...valid, dueDate: '18/07/2026' },
    { ...valid, status: 'CLOSED' },
    { ...valid, closedAt: '2026-07-17' },
  ])('rejects invalid creation input: %o', (input) => {
    expect(createContractValidate.safeParse(input).success).toBe(false);
  });

  it('also rejects lifecycle fields during updates', () => {
    expect(
      updateContractValidate.safeParse({ ...valid, status: 'ACTIVE' }).success,
    ).toBe(false);
    expect(
      updateContractValidate.safeParse({ ...valid, closedAt: null }).success,
    ).toBe(false);
  });

  it('validates contract IDs as UUIDs', () => {
    expect(contractParamsValidate.safeParse({ id: valid.clientId }).success).toBe(
      true,
    );
    expect(contractParamsValidate.safeParse({ id: '1' }).success).toBe(false);
  });

  it('validates list filters and rejects unknown values', () => {
    expect(listContractsValidate.safeParse({ type: 'SERVICE', approvalStatus: 'PENDING' }).success).toBe(true);
    expect(listContractsValidate.safeParse({ type: 'INVALID' }).success).toBe(false);
    expect(listContractsValidate.safeParse({ clientId: 'invalid' }).success).toBe(false);
  });

  it('requires a non-empty rejection reason', () => {
    expect(rejectContractValidate.parse({ reason: '  Invalid value  ' })).toEqual({ reason: 'Invalid value' });
    expect(rejectContractValidate.safeParse({ reason: '  ' }).success).toBe(false);
  });
});
