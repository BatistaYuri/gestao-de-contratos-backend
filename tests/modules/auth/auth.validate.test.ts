import { describe, expect, it } from 'vitest';

import { loginValidate } from '../../../src/modules/auth/auth.validate';

describe('loginValidate', () => {
  it('accepts valid credentials', () => {
    expect(
      loginValidate.parse({ username: 'admin321', password: 'admin123' }),
    ).toEqual({ username: 'admin321', password: 'admin123' });
  });

  it.each([
    {},
    { username: 'invalid', password: 'admin123' },
    { username: 'admin321', password: '' },
    { username: 'admin321', password: 'admin123', extra: true },
  ])('rejects invalid login content: %o', (input) => {
    expect(loginValidate.safeParse(input).success).toBe(false);
  });
});
