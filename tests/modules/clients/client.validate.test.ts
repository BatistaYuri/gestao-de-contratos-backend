import { describe, expect, it } from 'vitest';
import {
  clientParamsValidate,
  createClientValidate,
  updateClientValidate,
  listClientsValidate,
} from '../../../src/modules/clients/client.validate';

describe('createClientValidate', () => {
  it('accepts a valid client and normalizes the document', () => {
    const result = createClientValidate.parse({
      name: '  Acme Ltda  ',
      document: '12.345.678/0001-90',
    });

    expect(result).toEqual({
      name: 'Acme Ltda',
      document: '12345678000190',
    });
  });

  it.each([
    {},
    { name: '', document: '123' },
    { name: 'A', document: '123' },
    { name: 'Acme', document: '' },
    { name: 'Acme', document: 'abc' },
  ])('rejects invalid input: %o', (input) => {
    expect(createClientValidate.safeParse(input).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = createClientValidate.safeParse({
      name: 'Acme Ltda',
      document: '12345678000190',
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });
});

describe('client list validation', () => {
  it('applies pagination defaults and coerces query strings', () => {
    expect(listClientsValidate.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(listClientsValidate.parse({ page: '2', pageSize: '10' })).toEqual({ page: 2, pageSize: 10 });
  });

  it('rejects invalid pagination', () => {
    expect(listClientsValidate.safeParse({ page: 0 }).success).toBe(false);
    expect(listClientsValidate.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe('client update and parameter validation', () => {
  it('normalizes updates with the same rules as creation', () => {
    expect(updateClientValidate.parse({
      name: '  Updated client  ',
      document: '123.456-7',
    })).toEqual({ name: 'Updated client', document: '1234567' });
  });

  it('validates client IDs as UUIDs', () => {
    expect(clientParamsValidate.safeParse({ id: '06f37985-9f78-4ced-95bb-d9328e30f93c' }).success).toBe(true);
    expect(clientParamsValidate.safeParse({ id: 'invalid' }).success).toBe(false);
  });
});
