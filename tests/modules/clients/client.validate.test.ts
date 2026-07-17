import { describe, expect, it } from 'vitest';
import { createClientValidate } from '../../../src/modules/clients/client.validate';

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
