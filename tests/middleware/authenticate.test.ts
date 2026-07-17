import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createAuthenticate } from '../../src/middleware/authenticate';

function requestWithAuthorization(authorization?: string): Request {
  return { headers: { authorization } } as Request;
}

describe('authenticate', () => {
  it('rejects a request without a token', async () => {
    const verify = vi.fn();
    const next = vi.fn() as NextFunction;
    const middleware = createAuthenticate({ verify });

    await middleware(
      requestWithAuthorization(),
      {} as Response,
      next,
    );

    expect(verify).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it('rejects an invalid Bearer Token', async () => {
    const error = Object.assign(new Error('Invalid token'), { statusCode: 401 });
    const verify = vi.fn().mockRejectedValue(error);
    const next = vi.fn() as NextFunction;
    const middleware = createAuthenticate({ verify });

    await middleware(
      requestWithAuthorization('Bearer invalid-token'),
      {} as Response,
      next,
    );

    expect(verify).toHaveBeenCalledWith('invalid-token');
    expect(next).toHaveBeenCalledWith(error);
  });
});
