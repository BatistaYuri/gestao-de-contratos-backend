import type { RequestHandler } from 'express';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AppError } from '../../src/erros/app-error';

export function createAuthenticate(
  service: Pick<AuthService, 'verify'>,
): RequestHandler {
  return async (request, _response, next) => {
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer (\S+)$/);

    if (!match) {
      next(new AppError('Authentication token required', 401));
      return;
    }

    try {
      await service.verify(match[1]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
